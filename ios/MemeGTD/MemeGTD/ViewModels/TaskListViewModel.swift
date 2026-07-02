import Combine
import os
import SwiftUI

enum SearchMode: String, CaseIterable {
    case keyword = "Keyword"
    case semantic = "Semantic"
}

private let logger = Logger(subsystem: "name.kumac.MemeGTD", category: "TaskList")

@MainActor
class TaskListViewModel: ObservableObject {
    @Published var isLoading: Bool = false
    @Published var isLoadingMore: Bool = false
    @Published var error: String?

    // Filters
    @Published var statusFilter: TaskStatusFilter = .next
    @Published var labelFilters: Set<String> = []
    @Published var projectFilters: Set<Int> = []
    @Published var includeNoProject: Bool = false
    @Published var bookmarkFilter: Bool = false
    @Published var searchQuery: String = ""
    @Published var searchMode: SearchMode = .keyword
    @Published var scheduledFrom: Date?
    @Published var scheduledTo: Date?

    // Labels for picker
    @Published var allLabels: [IssueLabel] = []

    // Projects for picker
    @Published var allProjects: [Project] = []

    // Search match info (issueId -> match label + snippet)
    @Published var searchMatchInfos: [Int: String] = [:]

    // Semantic search relevance scores (issueId -> score 0-1)
    @Published var relevanceScores: [Int: Double] = [:]
    @Published var semanticSearchTimeMs: Double?

    var store: TaskStore?

    /// Data source seam. Views overwrite this with the app-wide provider from
    /// the environment (same wiring point as `store`).
    var dataSources = DataSourceProvider()

    private let pageSize = 20

    private static let dateFormatter: DateFormatter = {
        let f = DateFormatter()
        f.dateFormat = "yyyy-MM-dd"
        f.locale = Locale(identifier: "en_US_POSIX")
        return f
    }()

    // MARK: - Query building

    /// Whether the current request should use a search API
    var isSearching: Bool { !searchQuery.isEmpty }

    /// Whether semantic search is active
    var isSemanticSearching: Bool { isSearching && searchMode == .semantic }

    private func buildListQueryItems(offset: Int) -> [URLQueryItem] {
        var items: [URLQueryItem] = [
            URLQueryItem(name: "limit", value: String(pageSize)),
            URLQueryItem(name: "offset", value: String(offset)),
        ]
        if let apiValue = statusFilter.apiValue {
            items.append(URLQueryItem(name: "status", value: apiValue))
        }
        if !labelFilters.isEmpty {
            items.append(URLQueryItem(name: "label", value: labelFilters.joined(separator: ",")))
        }
        if !projectFilters.isEmpty || includeNoProject {
            var parts: [String] = []
            if includeNoProject { parts.append("none") }
            parts.append(contentsOf: projectFilters.map(String.init))
            items.append(URLQueryItem(name: "projectId", value: parts.joined(separator: ",")))
        }
        if bookmarkFilter {
            items.append(URLQueryItem(name: "bookmarked", value: "true"))
        }
        if let from = scheduledFrom {
            items.append(URLQueryItem(name: "scheduledFrom", value: Self.dateFormatter.string(from: from)))
        }
        if let to = scheduledTo {
            items.append(URLQueryItem(name: "scheduledTo", value: Self.dateFormatter.string(from: to)))
        }
        return items
    }

    private func buildSearchQueryItems(offset: Int) -> [URLQueryItem] {
        var items: [URLQueryItem] = [
            URLQueryItem(name: "q", value: searchQuery),
            URLQueryItem(name: "types", value: "task"),
            URLQueryItem(name: "limit", value: String(pageSize)),
            URLQueryItem(name: "offset", value: String(offset)),
        ]
        if let apiValue = statusFilter.apiValue {
            items.append(URLQueryItem(name: "status", value: apiValue))
        }
        if !labelFilters.isEmpty {
            items.append(URLQueryItem(name: "label", value: labelFilters.joined(separator: ",")))
        }
        if bookmarkFilter {
            items.append(URLQueryItem(name: "bookmarked", value: "true"))
        }
        return items
    }

    // MARK: - Load

    // MARK: - Keyword search helpers

    private func fetchKeywordSearch(offset: Int) async throws -> TaskListResponse {
        let response: KeywordSearchResponse = try await dataSources.search.keywordSearch(
            queryItems: buildSearchQueryItems(offset: offset)
        )
        var infos: [Int: String] = [:]
        for item in response.results {
            if let snippet = item.matchSnippet(searchQuery: searchQuery) {
                infos[item.id] = snippet
            }
        }
        searchMatchInfos = infos
        let tasks = response.results.map { $0.toTaskItem() }
        return TaskListResponse(data: tasks, total: response.total, limit: response.limit, offset: response.offset)
    }

    // MARK: - Semantic search helpers

    private func fetchSemanticSearch() async throws -> TaskListResponse {
        let queryItems = [
            URLQueryItem(name: "q", value: searchQuery.trimmingCharacters(in: .whitespaces)),
            URLQueryItem(name: "types", value: "task"),
            URLQueryItem(name: "limit", value: "50"),
        ]
        let response: SemanticSearchResponse = try await dataSources.search.semanticSearch(
            queryItems: queryItems
        )
        var scores: [Int: Double] = [:]
        for item in response.results {
            scores[item.issue.id] = item.score
        }
        relevanceScores = scores
        semanticSearchTimeMs = response.meta.searchTimeMs
        searchMatchInfos = [:]
        let tasks = response.results.map { $0.toTaskItem() }
        return TaskListResponse(data: tasks, total: response.meta.totalResults, limit: 50, offset: 0)
    }

    // MARK: - Load

    func loadTasks() async {
        logger.info("loadTasks called")
        isLoading = true
        error = nil

        do {
            let response: TaskListResponse
            if isSemanticSearching {
                response = try await fetchSemanticSearch()
            } else if isSearching {
                relevanceScores = [:]
                semanticSearchTimeMs = nil
                response = try await fetchKeywordSearch(offset: 0)
            } else {
                searchMatchInfos = [:]
                relevanceScores = [:]
                semanticSearchTimeMs = nil
                response = try await dataSources.tasks.listTasks(
                    queryItems: buildListQueryItems(offset: 0)
                )
            }
            store?.setItems(response.data, total: response.total)
            logger.info("loadTasks done: count=\(response.data.count), total=\(response.total)")
        } catch {
            self.error = error.localizedDescription
            logger.error("loadTasks error: \(error.localizedDescription)")
        }

        isLoading = false
    }

    // MARK: - Fetch without UI update (for pull-to-refresh)

    func fetchTasks() async -> TaskListResponse? {
        do {
            if isSemanticSearching {
                return try await fetchSemanticSearch()
            }
            if isSearching {
                return try await fetchKeywordSearch(offset: 0)
            }
            return try await dataSources.tasks.listTasks(
                queryItems: buildListQueryItems(offset: 0)
            )
        } catch {
            self.error = error.localizedDescription
            return nil
        }
    }

    func fetchOlderTasks() async -> TaskListResponse? {
        guard let store, store.hasMore, !isLoadingMore else { return nil }
        do {
            if isSearching {
                return try await fetchKeywordSearch(offset: store.tasks.count)
            }
            return try await dataSources.tasks.listTasks(
                queryItems: buildListQueryItems(offset: store.tasks.count)
            )
        } catch is CancellationError {
            return nil
        } catch {
            self.error = error.localizedDescription
            return nil
        }
    }

    func applyTasks(_ response: TaskListResponse) {
        store?.setItems(response.data, total: response.total)
    }

    func applyOlderTasks(_ response: TaskListResponse) {
        store?.appendItems(response.data, total: response.total)
    }

    func loadOlderTasks() async {
        guard let store else { return }
        logger.info("loadOlderTasks: hasMore=\(store.hasMore), isLoadingMore=\(self.isLoadingMore), count=\(store.tasks.count), total=\(store.total)")
        guard store.hasMore, !isLoadingMore else {
            logger.info("loadOlderTasks skipped")
            return
        }
        isLoadingMore = true

        do {
            let response: TaskListResponse
            if isSearching {
                response = try await fetchKeywordSearch(offset: store.tasks.count)
            } else {
                response = try await dataSources.tasks.listTasks(
                    queryItems: buildListQueryItems(offset: store.tasks.count)
                )
            }
            store.appendItems(response.data, total: response.total)
            logger.info("loadOlderTasks done: count=\(store.tasks.count), total=\(store.total)")
        } catch is CancellationError {
            logger.info("loadOlderTasks cancelled")
        } catch {
            self.error = error.localizedDescription
            logger.error("loadOlderTasks error: \(error.localizedDescription)")
        }

        isLoadingMore = false
    }

    // MARK: - Load labels for filter picker

    func loadLabels() async {
        do {
            allLabels = try await dataSources.labels.listLabels()
        } catch {
            logger.error("loadLabels error: \(error.localizedDescription)")
        }
    }

    // MARK: - Load projects for filter picker

    func loadProjects() async {
        do {
            allProjects = try await dataSources.projects.listProjects()
        } catch {
            logger.error("loadProjects error: \(error.localizedDescription)")
        }
    }

    // MARK: - Filter actions

    func setStatusFilter(_ status: TaskStatusFilter) {
        statusFilter = status
        Task { await loadTasks() }
    }

    func setLabelFilters(_ labels: Set<String>) {
        labelFilters = labels
        Task { await loadTasks() }
    }

    func setProjectFilters(_ projectIds: Set<Int>, includeNone: Bool) {
        projectFilters = projectIds
        includeNoProject = includeNone
        Task { await loadTasks() }
    }

    func toggleBookmarkFilter() {
        bookmarkFilter.toggle()
        Task { await loadTasks() }
    }

    func setDateFilter(from: Date?, to: Date?) {
        scheduledFrom = from
        scheduledTo = to
        Task { await loadTasks() }
    }

    func clearDateFilter() {
        scheduledFrom = nil
        scheduledTo = nil
        Task { await loadTasks() }
    }

    func search() {
        Task { await loadTasks() }
    }

    // MARK: - Copy / export search results

    @Published var isExporting: Bool = false
    @Published var showCopiedFeedback: Bool = false

    /// Calls `POST /api/search/export` with the currently loaded task IDs and
    /// filter snapshot, then writes the server's JSON response to the
    /// pasteboard. Also records a `search.exported` entry in activity_log.
    func exportAndCopy(includeComments: Bool) async {
        guard let store, !store.tasks.isEmpty else { return }
        isExporting = true
        defer { isExporting = false }

        let filters = SearchExportFilters(
            query: searchQuery.isEmpty ? nil : searchQuery,
            searchMode: searchQuery.isEmpty ? nil : searchMode.rawValue.lowercased(),
            labels: labelFilters.isEmpty ? nil : Array(labelFilters),
            dateFrom: scheduledFrom.map { Self.dateFormatter.string(from: $0) },
            dateTo: scheduledTo.map { Self.dateFormatter.string(from: $0) },
            bookmarked: bookmarkFilter ? true : nil,
            projectIds: projectFilters.isEmpty ? nil : Array(projectFilters),
            includeNoProject: includeNoProject ? true : nil,
            status: statusFilter.apiValue
        )

        let matchedComments: [String: String]? = searchMatchInfos.isEmpty
            ? nil
            : Dictionary(
                uniqueKeysWithValues: searchMatchInfos.map { (String($0.key), $0.value) }
            )

        let matchedScores: [String: Double]? = relevanceScores.isEmpty
            ? nil
            : Dictionary(
                uniqueKeysWithValues: relevanceScores.map { (String($0.key), $0.value) }
            )

        let request = SearchExportRequest(
            type: "tasks",
            filters: filters,
            itemIds: store.tasks.map { $0.id },
            matchedComments: matchedComments,
            matchedScores: matchedScores,
            includeComments: includeComments
        )

        do {
            let json = try await dataSources.search.exportSearchResults(request)
            UIPasteboard.general.string = json
            HapticManager.notification(.success)
            showCopiedFeedback = true
            Task {
                try? await Task.sleep(nanoseconds: 1_500_000_000)
                await MainActor.run { self.showCopiedFeedback = false }
            }
        } catch {
            self.error = error.localizedDescription
            HapticManager.notification(.error)
        }
    }
}

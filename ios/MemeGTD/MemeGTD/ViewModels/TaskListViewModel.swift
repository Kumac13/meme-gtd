import Combine
import os
import SwiftUI

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

    // Labels for picker
    @Published var allLabels: [IssueLabel] = []

    // Projects for picker
    @Published var allProjects: [Project] = []

    // Search match info (issueId -> match label + snippet)
    @Published var searchMatchInfos: [Int: String] = [:]

    var store: TaskStore?

    private let pageSize = 20

    // MARK: - Query building

    /// Whether the current request should use the keyword search API
    var isSearching: Bool { !searchQuery.isEmpty }

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
        let response: KeywordSearchResponse = try await APIClient.shared.get(
            path: "/api/search/keyword",
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

    // MARK: - Load

    func loadTasks() async {
        logger.info("loadTasks called")
        isLoading = true
        error = nil

        do {
            let response: TaskListResponse
            if isSearching {
                response = try await fetchKeywordSearch(offset: 0)
            } else {
                searchMatchInfos = [:]
                response = try await APIClient.shared.get(
                    path: "/api/tasks",
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
            if isSearching {
                return try await fetchKeywordSearch(offset: 0)
            }
            return try await APIClient.shared.get(
                path: "/api/tasks",
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
            return try await APIClient.shared.get(
                path: "/api/tasks",
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
                response = try await APIClient.shared.get(
                    path: "/api/tasks",
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
            allLabels = try await APIClient.shared.get(path: "/api/labels")
        } catch {
            logger.error("loadLabels error: \(error.localizedDescription)")
        }
    }

    // MARK: - Load projects for filter picker

    func loadProjects() async {
        do {
            allProjects = try await APIClient.shared.get(path: "/api/projects")
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

    func search() {
        Task { await loadTasks() }
    }
}

import Combine
import os
import SwiftUI

private let logger = Logger(subsystem: "name.kumac.MemeGTD", category: "MemoList")

@MainActor
class MemoListViewModel: ObservableObject {
    @Published var isLoading: Bool = false
    @Published var isLoadingMore: Bool = false
    @Published var error: String?
    @Published var newMemoBody: String = ""
    @Published var isCreating: Bool = false
    @Published var searchQuery: String = ""
    @Published var searchMode: SearchMode = .keyword
    @Published var bookmarkFilter: Bool = false
    @Published var labelFilters: Set<String> = []
    @Published var createdFrom: Date?
    @Published var createdTo: Date?
    @Published var projectFilters: Set<Int> = []
    @Published var includeNoProject: Bool = false
    @Published var allLabels: [IssueLabel] = []
    @Published var allProjects: [Project] = []

    // Search match info (issueId -> match label + snippet)
    @Published var searchMatchInfos: [Int: String] = [:]

    // Semantic search relevance scores (issueId -> score 0-1)
    @Published var relevanceScores: [Int: Double] = [:]
    @Published var semanticSearchTimeMs: Double?

    var store: MemoStore?

    private let pageSize = 20

    /// Tracks the most recently spawned reload task so a new filter change can
    /// cancel an in-flight `loadAllMemos`/`loadMemos` and prevent races where
    /// the prior load appends stale pages to the store.
    private var activeReloadTask: Task<Void, Never>?

    private static let dateFormatter: DateFormatter = {
        let f = DateFormatter()
        f.dateFormat = "yyyy-MM-dd"
        f.locale = Locale(identifier: "en_US_POSIX")
        return f
    }()

    // MARK: - Query parsing (matches Web UI queryParser.ts)

    private struct ParsedQuery {
        var labels: [String] = []
        var freeText: String = ""
    }

    private func parseSearchQuery(_ query: String) -> ParsedQuery {
        var result = ParsedQuery()
        let trimmed = query.trimmingCharacters(in: .whitespaces)
        guard !trimmed.isEmpty else { return result }

        var freeTextParts: [String] = []

        for token in trimmed.components(separatedBy: .whitespaces) {
            let lower = token.lowercased()
            if lower.hasPrefix("label:") {
                let value = String(token.dropFirst(6))
                let labels = value.split(separator: ",").map { $0.trimmingCharacters(in: .whitespaces) }.filter { !$0.isEmpty }
                result.labels.append(contentsOf: labels)
            } else if !token.isEmpty {
                freeTextParts.append(token)
            }
        }

        result.freeText = freeTextParts.joined(separator: " ")
        return result
    }

    /// Whether the current request should use a search API
    var isSearching: Bool {
        if searchQuery.isEmpty { return false }
        let parsed = parseSearchQuery(searchQuery)
        return !parsed.freeText.isEmpty
    }

    /// Whether semantic search is active
    var isSemanticSearching: Bool { isSearching && searchMode == .semantic }

    /// Whether a schedule (created date range) filter is active. Search ignores
    /// the date filter (see buildSearchQueryItems), so this is false while searching.
    var isDateFiltered: Bool { (createdFrom != nil || createdTo != nil) && !isSearching }

    private func buildListQueryItems(offset: Int) -> [URLQueryItem] {
        var queryItems: [URLQueryItem] = [
            URLQueryItem(name: "limit", value: String(pageSize)),
            URLQueryItem(name: "offset", value: String(offset)),
        ]
        // Schedule (date) filter active → request ascending so the oldest of
        // the range arrives first. Aligns array order with display order so the
        // ScrollView's natural top position shows the oldest, no scrolling.
        if isDateFiltered {
            queryItems.append(URLQueryItem(name: "order", value: "asc"))
        }
        if bookmarkFilter {
            queryItems.append(URLQueryItem(name: "bookmarked", value: "true"))
        }

        var allLabelFilters = Array(labelFilters)
        if !searchQuery.isEmpty {
            let parsed = parseSearchQuery(searchQuery)
            allLabelFilters.append(contentsOf: parsed.labels)
        }

        if !allLabelFilters.isEmpty {
            queryItems.append(URLQueryItem(name: "label", value: allLabelFilters.joined(separator: ",")))
        }
        if let from = createdFrom {
            queryItems.append(URLQueryItem(name: "createdFrom", value: Self.dateFormatter.string(from: from)))
        }
        if let to = createdTo {
            queryItems.append(URLQueryItem(name: "createdTo", value: Self.dateFormatter.string(from: to)))
        }

        if !projectFilters.isEmpty || includeNoProject {
            var parts: [String] = []
            if includeNoProject { parts.append("none") }
            parts.append(contentsOf: projectFilters.map(String.init))
            queryItems.append(URLQueryItem(name: "projectId", value: parts.joined(separator: ",")))
        }

        return queryItems
    }

    private func buildSearchQueryItems(offset: Int) -> [URLQueryItem] {
        let parsed = parseSearchQuery(searchQuery)
        var items: [URLQueryItem] = [
            URLQueryItem(name: "q", value: parsed.freeText),
            URLQueryItem(name: "types", value: "memo"),
            URLQueryItem(name: "limit", value: String(pageSize)),
            URLQueryItem(name: "offset", value: String(offset)),
        ]

        if bookmarkFilter {
            items.append(URLQueryItem(name: "bookmarked", value: "true"))
        }

        var allLabelFilters = Array(labelFilters)
        allLabelFilters.append(contentsOf: parsed.labels)
        if !allLabelFilters.isEmpty {
            items.append(URLQueryItem(name: "label", value: allLabelFilters.joined(separator: ",")))
        }

        return items
    }

    // MARK: - Load

    // MARK: - Keyword search helpers

    private func fetchKeywordSearch(offset: Int) async throws -> MemoListResponse {
        let response: KeywordSearchResponse = try await APIClient.shared.get(
            path: "/api/search/keyword",
            queryItems: buildSearchQueryItems(offset: offset)
        )
        var infos: [Int: String] = [:]
        for item in response.results {
            if let snippet = item.matchSnippet(searchQuery: searchQuery, isBodyVisible: true) {
                infos[item.id] = snippet
            }
        }
        searchMatchInfos = infos
        let memos = response.results.map { $0.toMemo() }
        return MemoListResponse(data: memos, total: response.total, limit: response.limit, offset: response.offset)
    }

    // MARK: - Semantic search helpers

    private func fetchSemanticSearch() async throws -> MemoListResponse {
        let parsed = parseSearchQuery(searchQuery)
        let queryItems = [
            URLQueryItem(name: "q", value: parsed.freeText),
            URLQueryItem(name: "types", value: "memo"),
            URLQueryItem(name: "limit", value: "50"),
        ]
        let response: SemanticSearchResponse = try await APIClient.shared.get(
            path: "/api/search/semantic",
            queryItems: queryItems
        )
        var scores: [Int: Double] = [:]
        for item in response.results {
            scores[item.issue.id] = item.score
        }
        relevanceScores = scores
        semanticSearchTimeMs = response.meta.searchTimeMs
        searchMatchInfos = [:]
        let memos = response.results.map { $0.toMemo() }
        return MemoListResponse(data: memos, total: response.meta.totalResults, limit: 50, offset: 0)
    }

    // MARK: - Load

    func loadMemos() async {
        logger.info("loadMemos called")
        isLoading = true
        defer { isLoading = false }
        error = nil

        // Phase 1: paint the SwiftData cache so the list is usable even when
        // offline. No-op until the App has injected a ModelContext.
        store?.refreshFromCache()
        let hadCachedMemos = !(store?.memos.isEmpty ?? true)

        do {
            let response: MemoListResponse
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
                response = try await APIClient.shared.get(
                    path: "/api/memos",
                    queryItems: buildListQueryItems(offset: 0)
                )
                // Persist the fresh first page so the next offline launch
                // shows what the user just saw.
                store?.persistToCache(response.data)
            }
            store?.setItems(response.data, total: response.total)
            logger.info("loadMemos done: count=\(response.data.count), total=\(response.total)")
        } catch is CancellationError {
            logger.info("loadMemos cancelled")
        } catch {
            if Task.isCancelled {
                logger.info("loadMemos cancelled (URLError)")
                return
            }
            // Silent failure when the cache already has something visible.
            // The list stays usable; surfacing an error on top would just
            // create noise during normal offline browsing.
            if !hadCachedMemos {
                self.error = error.localizedDescription
            }
            logger.error("loadMemos error: \(error.localizedDescription)")
        }
    }

    /// Loads every memo matching the current (non-search) filters by paging
    /// until `hasMore` is exhausted, then signals the view to scroll to the
    /// oldest item. Used when a schedule/date filter is active so the user sees
    /// the full filtered range starting from its oldest entry. The extra
    /// requests trade latency for completeness, which is acceptable here.
    func loadAllMemos() async {
        guard let store else { return }
        logger.info("loadAllMemos called")
        isLoading = true
        defer { isLoading = false }
        error = nil

        do {
            searchMatchInfos = [:]
            relevanceScores = [:]
            semanticSearchTimeMs = nil

            // Clear immediately so the spinner overlay (memos.isEmpty &&
            // isLoading) shows and the previous (un-filtered) content doesn't
            // bleed into the new filter while we page. Single batched setItems
            // at the end ensures the ScrollView re-anchors only once, instead
            // of chasing every appendItems mid-load.
            store.setItems([], total: 0)

            var accumulated: [Memo] = []
            var finalTotal = 0

            while true {
                try Task.checkCancellation()
                let resp: MemoListResponse = try await APIClient.shared.get(
                    path: "/api/memos",
                    queryItems: buildListQueryItems(offset: accumulated.count)
                )
                try Task.checkCancellation()
                if resp.data.isEmpty {
                    // Server reported more items than it returned. Trust the
                    // accumulated count so `hasMore` settles to false.
                    finalTotal = accumulated.count
                    break
                }
                accumulated.append(contentsOf: resp.data)
                finalTotal = resp.total
                if accumulated.count >= finalTotal { break }
            }

            store.setItems(accumulated, total: finalTotal)

            logger.info("loadAllMemos done: count=\(accumulated.count), total=\(finalTotal)")
        } catch is CancellationError {
            logger.info("loadAllMemos cancelled")
        } catch {
            if Task.isCancelled {
                logger.info("loadAllMemos cancelled (URLError)")
                return
            }
            self.error = error.localizedDescription
            logger.error("loadAllMemos error: \(error.localizedDescription)")
        }
    }

    /// Reloads the list, loading the full filtered range when a schedule/date
    /// filter is active and a single newest page otherwise.
    func reloadMemos() async {
        if isDateFiltered {
            await loadAllMemos()
        } else {
            await loadMemos()
        }
    }

    /// Fire-and-forget reload that cancels any in-flight reload first. Use this
    /// from synchronous mutators (filter toggles, view onChange handlers) so
    /// rapid filter changes don't interleave their loads.
    func reload() {
        activeReloadTask?.cancel()
        activeReloadTask = Task { @MainActor [weak self] in
            await self?.reloadMemos()
        }
    }

    // MARK: - Fetch without UI update (for pull-to-refresh)

    func fetchMemos() async -> MemoListResponse? {
        do {
            if isSemanticSearching {
                return try await fetchSemanticSearch()
            }
            if isSearching {
                return try await fetchKeywordSearch(offset: 0)
            }
            return try await APIClient.shared.get(
                path: "/api/memos",
                queryItems: buildListQueryItems(offset: 0)
            )
        } catch {
            self.error = error.localizedDescription
            return nil
        }
    }

    func fetchOlderMemos() async -> MemoListResponse? {
        guard let store, store.hasMore, !isLoadingMore else { return nil }
        do {
            if isSearching {
                return try await fetchKeywordSearch(offset: store.memos.count)
            }
            return try await APIClient.shared.get(
                path: "/api/memos",
                queryItems: buildListQueryItems(offset: store.memos.count)
            )
        } catch is CancellationError {
            return nil
        } catch {
            self.error = error.localizedDescription
            return nil
        }
    }

    func applyMemos(_ response: MemoListResponse) {
        store?.setItems(response.data, total: response.total)
    }

    func applyOlderMemos(_ response: MemoListResponse) {
        store?.appendItems(response.data, total: response.total)
    }

    func loadOlderMemos() async {
        guard let store else { return }
        logger.info("loadOlderMemos: hasMore=\(store.hasMore), isLoadingMore=\(self.isLoadingMore), count=\(store.memos.count), total=\(store.total)")
        guard store.hasMore, !isLoadingMore else {
            logger.info("loadOlderMemos skipped")
            return
        }
        isLoadingMore = true

        do {
            let response: MemoListResponse
            if isSearching {
                response = try await fetchKeywordSearch(offset: store.memos.count)
            } else {
                response = try await APIClient.shared.get(
                    path: "/api/memos",
                    queryItems: buildListQueryItems(offset: store.memos.count)
                )
            }
            store.appendItems(response.data, total: response.total)
            logger.info("loadOlderMemos done: count=\(store.memos.count), total=\(store.total)")
        } catch is CancellationError {
            logger.info("loadOlderMemos cancelled")
        } catch {
            self.error = error.localizedDescription
            logger.error("loadOlderMemos error: \(error.localizedDescription)")
        }

        isLoadingMore = false
    }

    func createMemo() async {
        let body = newMemoBody.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !body.isEmpty else { return }

        isCreating = true

        do {
            let request = CreateMemoRequest(
                bodyMd: body,
                clientUuid: UUID().uuidString.lowercased()
            )
            let memo: Memo = try await APIClient.shared.post(
                path: "/api/memos",
                body: request
            )
            store?.insertItem(memo, at: 0)
            // Keep the local cache in step with the server so the new memo
            // remains visible on the next offline launch.
            store?.persistToCache([memo])

            // Auto-link to filtered projects
            if !projectFilters.isEmpty {
                for projectId in projectFilters {
                    let _: ProjectItem? = try? await APIClient.shared.post(
                        path: "/api/projects/\(projectId)/items",
                        body: AddProjectItemRequest(issueId: memo.id)
                    )
                }
            }

            newMemoBody = ""
            HapticManager.notification(.success)
        } catch {
            self.error = error.localizedDescription
            HapticManager.notification(.error)
        }

        isCreating = false
    }

    func deleteMemo(_ id: Int) async {
        do {
            try await APIClient.shared.delete(path: "/api/memos/\(id)")
            store?.removeItem(id)
            store?.removeFromCache(remoteId: id)
        } catch {
            self.error = error.localizedDescription
        }
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

    func toggleBookmarkFilter() {
        bookmarkFilter.toggle()
        reload()
    }

    func setLabelFilters(_ labels: Set<String>) {
        labelFilters = labels
        reload()
    }

    func setDateFilter(from: Date?, to: Date?) {
        createdFrom = from
        createdTo = to
        reload()
    }

    func clearDateFilter() {
        createdFrom = nil
        createdTo = nil
        reload()
    }

    func setProjectFilters(_ projectIds: Set<Int>, includeNone: Bool) {
        projectFilters = projectIds
        includeNoProject = includeNone
        reload()
    }

    func search() {
        reload()
    }

    // MARK: - Copy / export search results

    @Published var isExporting: Bool = false
    @Published var showCopiedFeedback: Bool = false

    /// Calls `POST /api/search/export` with the currently loaded item IDs and
    /// filter snapshot, then writes the server's JSON response to the
    /// pasteboard. This also records a `search.exported` entry in the
    /// backend's activity_log so the search itself is persisted as data.
    func exportAndCopy(includeComments: Bool) async {
        guard let store, !store.memos.isEmpty else { return }
        isExporting = true
        defer { isExporting = false }

        let parsed = parseSearchQuery(searchQuery)
        var allLabelFilters = Array(labelFilters)
        allLabelFilters.append(contentsOf: parsed.labels)

        let filters = SearchExportFilters(
            query: parsed.freeText.isEmpty ? nil : parsed.freeText,
            searchMode: parsed.freeText.isEmpty ? nil : searchMode.rawValue.lowercased(),
            labels: allLabelFilters.isEmpty ? nil : allLabelFilters,
            dateFrom: createdFrom.map { Self.dateFormatter.string(from: $0) },
            dateTo: createdTo.map { Self.dateFormatter.string(from: $0) },
            bookmarked: bookmarkFilter ? true : nil,
            projectIds: projectFilters.isEmpty ? nil : Array(projectFilters),
            includeNoProject: includeNoProject ? true : nil,
            status: nil
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
            type: "memos",
            filters: filters,
            itemIds: store.memos.map { $0.id },
            matchedComments: matchedComments,
            matchedScores: matchedScores,
            includeComments: includeComments
        )

        do {
            let json = try await APIClient.shared.postReturningJSONString(
                path: "/api/search/export",
                body: request
            )
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

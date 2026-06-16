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

    /// LocalStore-backed repositories used by the offline-capable create
    /// path. We construct them lazily because they touch
    /// `LocalDatabase.shared`, and we only want to materialize the database
    /// the first time the memo list is actually used.
    private lazy var localMemos = LocalMemoRepository()
    private lazy var outbox = OutboxRepository()
    private lazy var iso: ISO8601DateFormatter = {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return f
    }()

    private let pageSize = 20

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

    private func buildListQueryItems(offset: Int) -> [URLQueryItem] {
        var queryItems: [URLQueryItem] = [
            URLQueryItem(name: "limit", value: String(pageSize)),
            URLQueryItem(name: "offset", value: String(offset)),
        ]
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
        error = nil

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
            }
            // Re-read pending memos AFTER the network call: the SyncEngine
            // may have settled some of them in parallel while we were awaiting
            // the API. If we read before the await, we'd double-display any
            // memo that synced during the request.
            let pendingMemos = pendingLocalMemos()
            let combined = pendingMemos + response.data
            store?.setItems(combined, total: response.total + pendingMemos.count)
            logger.info("loadMemos done: count=\(combined.count), total=\(response.total + pendingMemos.count), pending=\(pendingMemos.count)")
        } catch {
            // Network or server failure: fall back to showing only the local
            // pending memos so the user at least sees what they captured.
            let pendingMemos = pendingLocalMemos()
            store?.setItems(pendingMemos, total: pendingMemos.count)
            self.error = pendingMemos.isEmpty ? error.localizedDescription : nil
            logger.error("loadMemos error: \(error.localizedDescription) — showing \(pendingMemos.count) pending memo(s) from LocalStore")
        }

        isLoading = false
    }

    /// Pulls the un-synced memos out of LocalStore and converts them into
    /// `Memo` for the list view. Empty array on failure — pending display
    /// is best-effort and shouldn't crash the list path.
    private func pendingLocalMemos() -> [Memo] {
        do {
            let rows = try localMemos.listMemos(limit: 200).filter { $0.isPendingSync }
            return rows.map { $0.toMemo(iso: iso) }
        } catch {
            logger.error("pendingLocalMemos error: \(error.localizedDescription)")
            return []
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

    /// Offline-safe memo creation. Always lands in the local SQLite first so
    /// the UI updates regardless of network state. The SyncEngine takes care
    /// of actually delivering it to the server when reachable and stamping
    /// `server_id` back onto the local row.
    ///
    /// Auto-linking to filtered projects is deferred until after the memo is
    /// confirmed by the server, because the linking endpoints address memos
    /// by their INTEGER server id (which doesn't exist yet for pending rows).
    /// v1.x can extend the outbox to carry follow-up ops if this becomes a
    /// real problem.
    func createMemo() async {
        let body = newMemoBody.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !body.isEmpty else { return }

        isCreating = true

        do {
            let localMemo = try localMemos.createPendingMemo(bodyMd: body)
            let payload = try JSONEncoder().encode(localMemo.toCreatePayload())
            try outbox.enqueue(
                opType: .memoCreate,
                targetId: localMemo.id,
                payload: payload
            )

            // Synthesize a Memo for the UI list. Pending rows get a negative
            // synthetic id derived from the ULID hash; tapping them while
            // pending will fail (MemoDetailView fetches from the API), which
            // we accept as a v1 limitation. A subsequent loadMemos() after
            // sync replaces it with the real server-issued Memo.
            store?.insertItem(localMemo.toMemo(iso: iso), at: 0)

            newMemoBody = ""
            HapticManager.notification(.success)

            // Kick the engine immediately so an online user sees the memo
            // settle to "synced" within a heartbeat instead of waiting for
            // the next foreground event.
            SyncEngine.shared.requestSync(reason: "memo-create")

            // Auto-link to filtered projects only if we got a server id
            // back synchronously (shouldn't happen here in v1, but the hook
            // is left as a TODO for v1.x).
            _ = projectFilters
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
        Task { await loadMemos() }
    }

    func setLabelFilters(_ labels: Set<String>) {
        labelFilters = labels
        Task { await loadMemos() }
    }

    func setDateFilter(from: Date?, to: Date?) {
        createdFrom = from
        createdTo = to
        Task { await loadMemos() }
    }

    func clearDateFilter() {
        createdFrom = nil
        createdTo = nil
        Task { await loadMemos() }
    }

    func setProjectFilters(_ projectIds: Set<Int>, includeNone: Bool) {
        projectFilters = projectIds
        includeNoProject = includeNone
        Task { await loadMemos() }
    }

    func search() {
        Task { await loadMemos() }
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

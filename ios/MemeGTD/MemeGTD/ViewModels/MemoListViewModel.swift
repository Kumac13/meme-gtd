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
            store?.setItems(response.data, total: response.total)
            logger.info("loadMemos done: count=\(response.data.count), total=\(response.total)")
        } catch {
            self.error = error.localizedDescription
            logger.error("loadMemos error: \(error.localizedDescription)")
        }

        isLoading = false
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
            let request = CreateMemoRequest(bodyMd: body)
            let memo: Memo = try await APIClient.shared.post(
                path: "/api/memos",
                body: request
            )
            store?.insertItem(memo, at: 0)
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

    func setProjectFilters(_ projectIds: Set<Int>, includeNone: Bool) {
        projectFilters = projectIds
        includeNoProject = includeNone
        Task { await loadMemos() }
    }

    func search() {
        Task { await loadMemos() }
    }
}

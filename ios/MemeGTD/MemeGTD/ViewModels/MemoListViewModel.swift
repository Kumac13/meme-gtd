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
    @Published var bookmarkFilter: Bool = false
    @Published var labelFilters: Set<String> = []
    @Published var allLabels: [IssueLabel] = []

    // Search match info (issueId -> match label + snippet)
    @Published var searchMatchInfos: [Int: String] = [:]

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

    /// Whether the current request should use the keyword search API
    var isSearching: Bool {
        if searchQuery.isEmpty { return false }
        let parsed = parseSearchQuery(searchQuery)
        return !parsed.freeText.isEmpty
    }

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

    // MARK: - Load

    func loadMemos() async {
        logger.info("loadMemos called")
        isLoading = true
        error = nil

        do {
            let response: MemoListResponse
            if isSearching {
                response = try await fetchKeywordSearch(offset: 0)
            } else {
                searchMatchInfos = [:]
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

    // MARK: - Filter actions

    func toggleBookmarkFilter() {
        bookmarkFilter.toggle()
        Task { await loadMemos() }
    }

    func setLabelFilters(_ labels: Set<String>) {
        labelFilters = labels
        Task { await loadMemos() }
    }

    func search() {
        Task { await loadMemos() }
    }
}

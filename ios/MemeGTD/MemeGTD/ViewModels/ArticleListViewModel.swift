import Combine
import os
import SwiftUI

private let logger = Logger(subsystem: "name.kumac.MemeGTD", category: "ArticleList")

@MainActor
class ArticleListViewModel: ObservableObject {
    @Published var isLoading: Bool = false
    @Published var isLoadingMore: Bool = false
    @Published var error: String?

    // Search
    @Published var searchQuery: String = ""

    // Search match info (issueId -> match label + snippet)
    @Published var searchMatchInfos: [Int: String] = [:]

    var store: ArticleStore?

    /// Data source seam. Views overwrite this with the app-wide provider from
    /// the environment (same wiring point as `store`).
    var dataSources = DataSourceProvider()

    private let pageSize = 20

    /// Whether the current request should use the keyword search API
    var isSearching: Bool { !searchQuery.isEmpty }

    // MARK: - Query building

    private func buildListQueryItems(offset: Int) -> [URLQueryItem] {
        [
            URLQueryItem(name: "limit", value: String(pageSize)),
            URLQueryItem(name: "offset", value: String(offset)),
        ]
    }

    private func buildSearchQueryItems(offset: Int) -> [URLQueryItem] {
        [
            URLQueryItem(name: "q", value: searchQuery),
            URLQueryItem(name: "types", value: "article"),
            URLQueryItem(name: "limit", value: String(pageSize)),
            URLQueryItem(name: "offset", value: String(offset)),
        ]
    }

    // MARK: - Keyword search helpers

    private func fetchKeywordSearch(offset: Int) async throws -> ArticleListResponse {
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
        let articles = response.results.map { $0.toArticle() }
        return ArticleListResponse(data: articles, total: response.total, limit: response.limit, offset: response.offset)
    }

    // MARK: - Load

    func loadArticles() async {
        logger.info("loadArticles called")
        isLoading = true
        error = nil

        do {
            let response: ArticleListResponse
            if isSearching {
                response = try await fetchKeywordSearch(offset: 0)
            } else {
                searchMatchInfos = [:]
                response = try await dataSources.articles.listArticles(
                    queryItems: buildListQueryItems(offset: 0)
                )
            }
            store?.setItems(response.data, total: response.total)
            logger.info("loadArticles done: count=\(response.data.count), total=\(response.total)")
        } catch {
            self.error = error.localizedDescription
            logger.error("loadArticles error: \(error.localizedDescription)")
        }

        isLoading = false
    }

    // MARK: - Fetch without UI update (for pull-to-refresh)

    func fetchArticles() async -> ArticleListResponse? {
        do {
            if isSearching {
                return try await fetchKeywordSearch(offset: 0)
            }
            return try await dataSources.articles.listArticles(
                queryItems: buildListQueryItems(offset: 0)
            )
        } catch {
            self.error = error.localizedDescription
            return nil
        }
    }

    func applyArticles(_ response: ArticleListResponse) {
        store?.setItems(response.data, total: response.total)
    }

    func loadOlderArticles() async {
        guard let store else { return }
        logger.info("loadOlderArticles: hasMore=\(store.hasMore), isLoadingMore=\(self.isLoadingMore), count=\(store.articles.count), total=\(store.total)")
        guard store.hasMore, !isLoadingMore else {
            logger.info("loadOlderArticles skipped")
            return
        }
        isLoadingMore = true

        do {
            let response: ArticleListResponse
            if isSearching {
                response = try await fetchKeywordSearch(offset: store.articles.count)
            } else {
                response = try await dataSources.articles.listArticles(
                    queryItems: buildListQueryItems(offset: store.articles.count)
                )
            }
            store.appendItems(response.data, total: response.total)
            logger.info("loadOlderArticles done: count=\(store.articles.count), total=\(store.total)")
        } catch is CancellationError {
            logger.info("loadOlderArticles cancelled")
        } catch {
            self.error = error.localizedDescription
            logger.error("loadOlderArticles error: \(error.localizedDescription)")
        }

        isLoadingMore = false
    }

    // MARK: - Search

    func search() {
        Task { await loadArticles() }
    }

    // MARK: - Copy / export search results

    @Published var isExporting: Bool = false
    @Published var showCopiedFeedback: Bool = false

    /// Calls `POST /api/search/export` with the currently loaded article IDs
    /// and filter snapshot, then writes the server's JSON response to the
    /// pasteboard. Also records a `search.exported` entry in activity_log.
    func exportAndCopy(includeComments: Bool) async {
        guard let store, !store.articles.isEmpty else { return }
        isExporting = true
        defer { isExporting = false }

        let filters = SearchExportFilters(
            query: searchQuery.isEmpty ? nil : searchQuery,
            searchMode: searchQuery.isEmpty ? nil : "keyword",
            labels: nil,
            dateFrom: nil,
            dateTo: nil,
            bookmarked: nil,
            projectIds: nil,
            includeNoProject: nil,
            status: nil
        )

        let matchedComments: [String: String]? = searchMatchInfos.isEmpty
            ? nil
            : Dictionary(
                uniqueKeysWithValues: searchMatchInfos.map { (String($0.key), $0.value) }
            )

        let request = SearchExportRequest(
            type: "articles",
            filters: filters,
            itemIds: store.articles.map { $0.id },
            matchedComments: matchedComments,
            matchedScores: nil,
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

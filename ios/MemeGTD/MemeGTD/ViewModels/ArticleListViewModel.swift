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

    var store: ArticleStore?

    private let pageSize = 20

    // MARK: - Query building

    private func buildQueryItems(offset: Int) -> [URLQueryItem] {
        var items: [URLQueryItem] = [
            URLQueryItem(name: "limit", value: String(pageSize)),
            URLQueryItem(name: "offset", value: String(offset)),
        ]
        if !searchQuery.isEmpty {
            items.append(URLQueryItem(name: "search", value: searchQuery))
        }
        return items
    }

    // MARK: - Load

    func loadArticles() async {
        logger.info("loadArticles called")
        isLoading = true
        error = nil

        do {
            let response: ArticleListResponse = try await APIClient.shared.get(
                path: "/api/articles",
                queryItems: buildQueryItems(offset: 0)
            )
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
            return try await APIClient.shared.get(
                path: "/api/articles",
                queryItems: buildQueryItems(offset: 0)
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
            let response: ArticleListResponse = try await APIClient.shared.get(
                path: "/api/articles",
                queryItems: buildQueryItems(offset: store.articles.count)
            )
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
}

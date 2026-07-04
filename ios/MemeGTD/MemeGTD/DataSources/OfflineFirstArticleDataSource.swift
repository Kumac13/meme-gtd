import Foundation
import GRDB

/// Offline-first `ArticleDataSource` (offline support plan Phase 7), active
/// only while the "Offline Sync (Beta)" setting is on.
///
/// Articles are READ-ONLY offline: reads go to the server first and fall back
/// to the local GRDB mirror when the server is unreachable
/// (`APIError.networkError`); the delete write throws `OfflineReadOnlyError`
/// when it cannot reach the server.
///
/// As with tasks, successful remote responses are NOT written back into the
/// local `issues` table — its rows carry sync bookkeeping the REST responses
/// lack, and the pull already delivers article rows (including their `meta`
/// JSON), so the fallback cache stays fresh without a second write path.
///
/// The local read itself (type filter, meta JSON restore, Row → Article) is
/// `LocalArticleStore`, shared with the Standalone-mode
/// `LocalArticleDataSource` since Phase 10.
nonisolated final class OfflineFirstArticleDataSource: ArticleDataSource {
    private let database: AppDatabase
    private let remote: ArticleDataSource

    init(database: AppDatabase, remote: ArticleDataSource) {
        self.database = database
        self.remote = remote
    }

    // MARK: - Reads (remote first, local fallback)

    func listArticles(queryItems: [URLQueryItem]) async throws -> ArticleListResponse {
        do {
            return try await remote.listArticles(queryItems: queryItems)
        } catch where OfflineFirstSupport.isNetworkError(error) {
            return try await localListArticles(queryItems: queryItems)
        }
    }

    func searchArticles(queryItems: [URLQueryItem]) async throws -> SearchArticlesResponse {
        do {
            return try await remote.searchArticles(queryItems: queryItems)
        } catch where OfflineFirstSupport.isNetworkError(error) {
            let list = try await localListArticles(queryItems: queryItems)
            return SearchArticlesResponse(
                data: list.data.map {
                    SearchArticleItem(
                        id: $0.id,
                        type: $0.type,
                        title: $0.title,
                        updatedAt: $0.updatedAt
                    )
                },
                total: list.total,
                limit: list.limit,
                offset: list.offset
            )
        }
    }

    func getArticle(id: Int) async throws -> Article {
        do {
            return try await remote.getArticle(id: id)
        } catch where OfflineFirstSupport.isNetworkError(error) {
            let local: Article? = try await database.dbWriter.read { db in
                guard let row = try LocalArticleStore.fetchArticleRow(db, id: id) else { return nil }
                return try LocalArticleStore.article(from: row, db: db)
            }
            guard let local else { throw error }
            return local
        }
    }

    // MARK: - Writes (online only)

    func deleteArticle(id: Int) async throws {
        do {
            try await remote.deleteArticle(id: id)
        } catch where OfflineFirstSupport.isNetworkError(error) {
            throw OfflineReadOnlyError()
        }
    }

    // MARK: - Local list query

    private func localListArticles(queryItems: [URLQueryItem]) async throws -> ArticleListResponse {
        let query = LocalArticleStore.ListQuery(queryItems: queryItems)
        return try await database.dbWriter.read { db in
            try LocalArticleStore.listArticles(db, query: query)
        }
    }
}

import Foundation
import GRDB

/// Standalone-mode `ArticleDataSource` (offline support plan Phase 10),
/// active while Storage Mode is "Standalone".
///
/// Every read goes straight to the local GRDB database through
/// `LocalArticleStore` — articles arrive there via the Share Extension,
/// which inserts extracted pages into the shared App Group database in this
/// mode. There is NO outbox and NO server communication.
///
/// Deletes are HARD deletes, same convention as LocalMemoDataSource /
/// LocalTaskDataSource: in standalone mode nothing ever reaches a server,
/// so soft deleting would only accumulate rows no code path could ever
/// purge.
nonisolated final class LocalArticleDataSource: ArticleDataSource {
    private let database: AppDatabase

    init(database: AppDatabase) {
        self.database = database
    }

    // MARK: - Reads

    func listArticles(queryItems: [URLQueryItem]) async throws -> ArticleListResponse {
        let query = LocalArticleStore.ListQuery(queryItems: queryItems)
        return try await database.dbWriter.read { db in
            try LocalArticleStore.listArticles(db, query: query)
        }
    }

    func searchArticles(queryItems: [URLQueryItem]) async throws -> SearchArticlesResponse {
        // Same endpoint shape as listArticles, decoded into the slim
        // link-picker items (mirrors the remote implementation, which hits
        // /api/articles for both).
        let query = LocalArticleStore.ListQuery(queryItems: queryItems)
        let list = try await database.dbWriter.read { db in
            try LocalArticleStore.listArticles(db, query: query)
        }
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

    func getArticle(id: Int) async throws -> Article {
        try await database.dbWriter.read { db in
            guard let row = try LocalArticleStore.fetchArticleRow(db, id: id) else {
                throw LocalArticleError.articleNotFound
            }
            return try LocalArticleStore.article(from: row, db: db)
        }
    }

    // MARK: - Delete

    func deleteArticle(id: Int) async throws {
        try await database.dbWriter.write { db in
            guard let row = try LocalArticleStore.fetchArticleRow(db, id: id) else {
                throw LocalArticleError.articleNotFound
            }
            let uuid: String = row["uuid"]
            try LocalArticleStore.hardDeleteArticleWithRelated(db, uuid: uuid)
        }
    }
}

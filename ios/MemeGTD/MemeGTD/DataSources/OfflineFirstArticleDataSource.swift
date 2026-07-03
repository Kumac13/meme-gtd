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
                guard let row = try Self.fetchRow(db, id: id) else { return nil }
                return try Self.article(from: row, db: db)
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

    /// Query items understood by GET /api/articles, as built by
    /// ArticleListViewModel (limit/offset) and the link-picker (`search`).
    private struct ListQuery {
        var limit: Int?
        var offset = 0
        var search: String?

        init(queryItems: [URLQueryItem]) {
            for item in queryItems {
                switch item.name {
                case "limit":
                    limit = item.value.flatMap(Int.init)
                case "offset":
                    offset = item.value.flatMap(Int.init) ?? 0
                case "search":
                    search = item.value
                default:
                    break
                }
            }
        }
    }

    private func localListArticles(queryItems: [URLQueryItem]) async throws -> ArticleListResponse {
        let query = ListQuery(queryItems: queryItems)

        return try await database.dbWriter.read { db in
            // Filter semantics mirror packages/db/src/articleRepository.ts:
            // `search` is a LIKE substring over title OR body, order is
            // created_at DESC.
            var conditions = ["i.type = 'article'", "i.is_deleted = 0"]
            var arguments: [DatabaseValueConvertible] = []

            if let search = query.search, !search.isEmpty {
                conditions.append("(i.title LIKE ? OR i.body_md LIKE ?)")
                let pattern = "%\(search)%"
                arguments.append(contentsOf: [pattern, pattern])
            }

            let whereClause = conditions.joined(separator: " AND ")

            let total = try Int.fetchOne(
                db,
                sql: "SELECT COUNT(*) FROM issues i WHERE \(whereClause)",
                arguments: StatementArguments(arguments)
            ) ?? 0

            var sql = Self.rowSelect + """
                 WHERE \(whereClause)
                ORDER BY i.created_at DESC
                """
            if let limit = query.limit {
                sql += " LIMIT ? OFFSET ?"
                arguments.append(limit)
                arguments.append(query.offset)
            }

            let rows = try Row.fetchAll(db, sql: sql, arguments: StatementArguments(arguments))
            let articles = try rows.map { try Self.article(from: $0, db: db) }
            return ArticleListResponse(
                data: articles,
                total: total,
                limit: query.limit ?? total,
                offset: query.offset
            )
        }
    }

    // MARK: - Row helpers

    private static let rowSelect = """
        SELECT i.rowid AS local_rowid, i.*,
          (SELECT COUNT(*) FROM comments c
           WHERE c.issue_uuid = i.uuid AND c.is_deleted = 0) AS comment_count
        FROM issues i
        """

    /// Resolves the protocol's integer id: positive = server_id,
    /// negative = -rowid (local-only row).
    private static func fetchRow(_ db: Database, id: Int) throws -> Row? {
        if id > 0 {
            return try Row.fetchOne(
                db,
                sql: rowSelect + " WHERE i.server_id = ? AND i.type = 'article' AND i.is_deleted = 0",
                arguments: [id]
            )
        }
        return try Row.fetchOne(
            db,
            sql: rowSelect + " WHERE i.rowid = ? AND i.type = 'article' AND i.is_deleted = 0",
            arguments: [-id]
        )
    }

    private static func article(from row: Row, db: Database) throws -> Article {
        let uuid: String = row["uuid"]
        let serverId: Int? = row["server_id"]
        let rowid: Int64 = row["local_rowid"]
        // Server orders article labels by name (articleRepository).
        let labels = try String.fetchAll(
            db,
            sql: """
                SELECT label_name FROM issue_labels
                WHERE issue_uuid = ?
                ORDER BY label_name
                """,
            arguments: [uuid]
        )
        return Article(
            id: serverId ?? -Int(rowid),
            type: row["type"],
            title: row["title"] ?? "",
            bodyMd: row["body_md"],
            meta: Self.articleMeta(from: row["meta"]),
            createdAt: row["created_at"],
            updatedAt: row["updated_at"],
            isBookmarked: row["is_bookmarked"],
            isDeleted: row["is_deleted"],
            labels: labels,
            commentCount: row["comment_count"]
        )
    }

    /// The local `meta` column stores the server's JSON verbatim (see
    /// SyncChangeApplier.jsonString); a value that does not decode as
    /// ArticleMeta is surfaced as nil, same as an absent meta.
    private static func articleMeta(from raw: String?) -> ArticleMeta? {
        guard let raw, let data = raw.data(using: .utf8) else { return nil }
        return try? JSONDecoder().decode(ArticleMeta.self, from: data)
    }
}

import Foundation
import GRDB

/// App-target half of `LocalArticleStore` (offline support plan Phase 10).
/// The insert and the meta JSON codec live in
/// `Shared/Database/LocalArticleStore.swift` so the Share Extension can save
/// extracted articles; the read side below returns app-target response
/// models, shared by `OfflineFirstArticleDataSource` (offline read cache,
/// extracted unchanged) and `LocalArticleDataSource` (Standalone mode),
/// plus the Standalone hard delete.
nonisolated extension LocalArticleStore {
    // MARK: - List query

    /// Query items understood by GET /api/articles, as built by
    /// ArticleListViewModel (limit/offset) and the link-picker (`search`).
    struct ListQuery {
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

    // MARK: - List

    static func listArticles(_ db: Database, query: ListQuery) throws -> ArticleListResponse {
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

        var sql = rowSelect + """
             WHERE \(whereClause)
            ORDER BY i.created_at DESC
            """
        if let limit = query.limit {
            sql += " LIMIT ? OFFSET ?"
            arguments.append(limit)
            arguments.append(query.offset)
        }

        let rows = try Row.fetchAll(db, sql: sql, arguments: StatementArguments(arguments))
        let articles = try rows.map { try article(from: $0, db: db) }
        return ArticleListResponse(
            data: articles,
            total: total,
            limit: query.limit ?? total,
            offset: query.offset
        )
    }

    // MARK: - Article rows

    static let rowSelect = """
        SELECT i.rowid AS local_rowid, i.*,
          (SELECT COUNT(*) FROM comments c
           WHERE c.issue_uuid = i.uuid AND c.is_deleted = 0) AS comment_count
        FROM issues i
        """

    /// Resolves the protocol's integer id: positive = server_id,
    /// negative = -rowid (local-only row).
    static func fetchArticleRow(_ db: Database, id: Int) throws -> Row? {
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

    static func article(from row: Row, db: Database) throws -> Article {
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
            meta: articleMeta(from: row["meta"]),
            createdAt: row["created_at"],
            updatedAt: row["updated_at"],
            isBookmarked: row["is_bookmarked"],
            isDeleted: row["is_deleted"],
            labels: labels,
            commentCount: row["comment_count"]
        )
    }

    // MARK: - Delete (Standalone only)

    /// Hard delete for rows that never need to reach a server: drops the
    /// article row plus everything hanging off it (comments, label
    /// assignments, and links / URL links — the server's FK ON DELETE
    /// CASCADE set), same convention as LocalMemoStore / LocalTaskStore.
    static func hardDeleteArticleWithRelated(_ db: Database, uuid: String) throws {
        try db.execute(sql: "DELETE FROM comments WHERE issue_uuid = ?", arguments: [uuid])
        try db.execute(sql: "DELETE FROM issue_labels WHERE issue_uuid = ?", arguments: [uuid])
        try db.execute(
            sql: "DELETE FROM links WHERE source_issue_uuid = ? OR target_issue_uuid = ?",
            arguments: [uuid, uuid]
        )
        try db.execute(sql: "DELETE FROM url_links WHERE issue_uuid = ?", arguments: [uuid])
        try db.execute(sql: "DELETE FROM issues WHERE uuid = ?", arguments: [uuid])
    }
}

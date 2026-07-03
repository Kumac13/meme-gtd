import Foundation
import GRDB

/// Standalone-mode `SearchDataSource` (offline support plan Phase 9), active
/// while Storage Mode is "Standalone".
///
/// - `keywordSearch` mirrors the server's endpoint
///   (packages/db/src/searchRepository.ts `searchByKeyword`) — which is
///   deliberately LIKE-based, NOT FTS5: unicode61 cannot tokenize Japanese
///   word boundaries, so substring matching is the behavior the product is
///   built around (packages/db/CLAUDE.md codifies this; do not switch this
///   to an FTS index). Cross-type over memos / tasks / articles, comment
///   bodies included, one result per issue with its matches grouped, and
///   offset/limit applied after grouping — exactly the server's semantics.
/// - `semanticSearch` needs the server-side embedding stack and answers an
///   empty result set (same as the Phase 8 stand-in) so the search UI shows
///   "no results" instead of an error. The Standalone search UI hides the
///   Semantic mode.
/// - `exportSearchResults` is a server feature (activity-log side effect) and
///   is refused.
nonisolated final class LocalSearchDataSource: SearchDataSource {
    private let database: AppDatabase

    init(database: AppDatabase) {
        self.database = database
    }

    // MARK: - Keyword search (LIKE, mirroring searchRepository.searchByKeyword)

    /// Query items understood by GET /api/search/keyword
    /// (KeywordSearchQuerySchema), with the same defaults.
    private struct Query {
        var q = ""
        var limit = 20
        var offset = 0
        var types: [String] = []
        var status: String?
        var labels: [String] = []
        var bookmarked = false
        var ascending = false

        init(queryItems: [URLQueryItem]) {
            for item in queryItems {
                switch item.name {
                case "q":
                    q = item.value ?? ""
                case "limit":
                    limit = item.value.flatMap(Int.init) ?? 20
                case "offset":
                    offset = item.value.flatMap(Int.init) ?? 0
                case "types":
                    types = Self.splitList(item.value)
                case "status":
                    status = item.value
                case "label":
                    labels = Self.splitList(item.value)
                case "bookmarked":
                    bookmarked = item.value == "true"
                case "order":
                    ascending = item.value == "asc"
                default:
                    break
                }
            }
        }

        private static func splitList(_ value: String?) -> [String] {
            (value ?? "")
                .split(separator: ",")
                .map { $0.trimmingCharacters(in: .whitespaces) }
                .filter { !$0.isEmpty }
        }
    }

    func keywordSearch(queryItems: [URLQueryItem]) async throws -> KeywordSearchResponse {
        let query = Query(queryItems: queryItems)
        guard !query.q.trimmingCharacters(in: .whitespaces).isEmpty else {
            return KeywordSearchResponse(results: [], total: 0, limit: query.limit, offset: query.offset)
        }
        // Same pattern the server builds (`%${query}%`, no wildcard escaping).
        let pattern = "%\(query.q)%"

        return try await database.dbWriter.read { db in
            // Extra filters mirror searchByKeyword: types / status / labels
            // (OR over names) / bookmarked. The label join is adapted to the
            // local schema (issue_labels keyed by uuid + label name).
            var extraConditions: [String] = []
            var extraArguments: [DatabaseValueConvertible] = []

            if !query.types.isEmpty {
                let placeholders = query.types.map { _ in "?" }.joined(separator: ", ")
                extraConditions.append("i.type IN (\(placeholders))")
                extraArguments.append(contentsOf: query.types)
            }
            if let status = query.status {
                extraConditions.append("i.status = ?")
                extraArguments.append(status)
            }
            if !query.labels.isEmpty {
                let placeholders = query.labels.map { _ in "?" }.joined(separator: ", ")
                extraConditions.append("""
                    i.uuid IN (SELECT issue_uuid FROM issue_labels \
                    WHERE label_name IN (\(placeholders)))
                    """)
                extraArguments.append(contentsOf: query.labels)
            }
            if query.bookmarked {
                extraConditions.append("i.is_bookmarked = 1")
            }
            let extraSql = extraConditions.isEmpty
                ? ""
                : " AND " + extraConditions.joined(separator: " AND ")

            // Two branches like the server: rows matched on the issue itself
            // (matched_text = title when the title hit, else the body), and
            // rows matched on a comment body. Grouping happens in Swift.
            let sql = """
                SELECT local_rowid, uuid, server_id, type, title, body_md, status,
                       is_bookmarked, created_at, updated_at, comment_count,
                       match_field, match_comment_server_id, match_comment_rowid, matched_text
                FROM (
                  SELECT i.rowid AS local_rowid, i.uuid, i.server_id, i.type, i.title,
                         i.body_md, i.status, i.is_bookmarked, i.created_at, i.updated_at,
                         (SELECT COUNT(*) FROM comments c2
                          WHERE c2.issue_uuid = i.uuid AND c2.is_deleted = 0) AS comment_count,
                         'issue' AS match_field,
                         NULL AS match_comment_server_id,
                         NULL AS match_comment_rowid,
                         CASE WHEN i.title LIKE ? THEN i.title ELSE i.body_md END AS matched_text
                  FROM issues i
                  WHERE i.is_deleted = 0 AND (i.title LIKE ? OR i.body_md LIKE ?)\(extraSql)

                  UNION ALL

                  SELECT i.rowid AS local_rowid, i.uuid, i.server_id, i.type, i.title,
                         i.body_md, i.status, i.is_bookmarked, i.created_at, i.updated_at,
                         (SELECT COUNT(*) FROM comments c2
                          WHERE c2.issue_uuid = i.uuid AND c2.is_deleted = 0) AS comment_count,
                         'comment' AS match_field,
                         c.server_id AS match_comment_server_id,
                         c.rowid AS match_comment_rowid,
                         c.body_md AS matched_text
                  FROM issues i
                  JOIN comments c ON c.issue_uuid = i.uuid AND c.is_deleted = 0
                  WHERE i.is_deleted = 0 AND c.body_md LIKE ?\(extraSql)
                )
                ORDER BY updated_at \(query.ascending ? "ASC" : "DESC")
                """
            let arguments: [DatabaseValueConvertible]
                = [pattern, pattern, pattern] + extraArguments
                + [pattern] + extraArguments

            let rows = try Row.fetchAll(db, sql: sql, arguments: StatementArguments(arguments))

            // Group by issue, preserving order of first appearance; offset
            // and limit apply per issue, not per match — same as the server.
            var orderedUuids: [String] = []
            var firstRow: [String: Row] = [:]
            var matches: [String: [KeywordMatch]] = [:]
            for row in rows {
                let uuid: String = row["uuid"]
                if firstRow[uuid] == nil {
                    orderedUuids.append(uuid)
                    firstRow[uuid] = row
                }
                let commentId: Int?
                if row["match_field"] == "comment" {
                    let commentServerId: Int? = row["match_comment_server_id"]
                    let commentRowid: Int64 = row["match_comment_rowid"]
                    commentId = commentServerId ?? -Int(commentRowid)
                } else {
                    commentId = nil
                }
                matches[uuid, default: []].append(KeywordMatch(
                    field: row["match_field"],
                    commentId: commentId,
                    text: row["matched_text"] ?? ""
                ))
            }

            let page = orderedUuids.dropFirst(query.offset).prefix(query.limit)
            let results: [KeywordSearchResultItem] = try page.map { uuid in
                let row = firstRow[uuid]!
                let serverId: Int? = row["server_id"]
                let rowid: Int64 = row["local_rowid"]
                // Server orders result labels by name (searchByKeyword).
                let labels = try String.fetchAll(
                    db,
                    sql: """
                        SELECT label_name FROM issue_labels
                        WHERE issue_uuid = ?
                        ORDER BY label_name
                        """,
                    arguments: [uuid]
                )
                return KeywordSearchResultItem(
                    id: serverId ?? -Int(rowid),
                    type: row["type"],
                    title: row["title"],
                    bodyMd: row["body_md"],
                    status: row["status"],
                    isBookmarked: row["is_bookmarked"],
                    labels: labels,
                    commentCount: row["comment_count"],
                    createdAt: row["created_at"],
                    updatedAt: row["updated_at"],
                    matches: matches[uuid] ?? []
                )
            }

            // The server responds with total == results.length (the page it
            // returned, not the overall match count); mirror that shape.
            return KeywordSearchResponse(
                results: results,
                total: results.count,
                limit: query.limit,
                offset: query.offset
            )
        }
    }

    // MARK: - Semantic search / export (server-only)

    func semanticSearch(queryItems: [URLQueryItem]) async throws -> SemanticSearchResponse {
        let query = queryItems.first(where: { $0.name == "q" })?.value ?? ""
        return SemanticSearchResponse(
            results: [],
            meta: SemanticSearchMeta(query: query, totalResults: 0, searchTimeMs: 0)
        )
    }

    func exportSearchResults(_ request: SearchExportRequest) async throws -> String {
        throw StandaloneUnavailableError("Export is not available in Standalone mode.")
    }
}

import Foundation
import GRDB

/// Errors surfaced by the local memo store (English, user-facing).
nonisolated enum LocalMemoError: Error, LocalizedError {
    case memoNotFound
    case commentNotFound

    var errorDescription: String? {
        switch self {
        case .memoNotFound:
            return "Memo not found in the local database."
        case .commentNotFound:
            return "Comment not found in the local database."
        }
    }
}

/// Local (GRDB) CRUD for memos and their comments, shared by
/// `OfflineFirstMemoDataSource` (Offline Sync) and `LocalMemoDataSource`
/// (Standalone mode) — offline support plan Phase 8.
///
/// This type knows NOTHING about the outbox or the network: every function
/// operates on a `Database` handle inside the caller's transaction, so the
/// offline-first path can enqueue its pending operations in the SAME
/// transaction while the standalone path uses the CRUD alone.
///
/// Identity: rows are keyed by client-generated UUIDv7, but the protocol
/// (and every ViewModel) speaks integer ids. The mapping — for memos AND
/// comments — is:
/// - synced rows: `id == server_id` (positive)
/// - local-only rows: `id == -rowid` (negative, never collides with server
///   ids).
nonisolated enum LocalMemoStore {
    // MARK: - List query

    /// Query items understood by GET /api/memos, as built by
    /// MemoListViewModel.buildListQueryItems and MemoDetailViewModel.searchIssues.
    struct ListQuery {
        var limit: Int?
        var offset = 0
        var ascending = false
        var bookmarked = false
        var labels: [String] = []
        var search: String?
        var createdFrom: String?
        var createdTo: String?
        var hasProjectFilter = false

        init(queryItems: [URLQueryItem]) {
            for item in queryItems {
                switch item.name {
                case "limit":
                    limit = item.value.flatMap(Int.init)
                case "offset":
                    offset = item.value.flatMap(Int.init) ?? 0
                case "order":
                    ascending = item.value == "asc"
                case "bookmarked":
                    bookmarked = item.value == "true"
                case "label":
                    labels = (item.value ?? "")
                        .split(separator: ",")
                        .map { $0.trimmingCharacters(in: .whitespaces) }
                        .filter { !$0.isEmpty }
                case "search":
                    search = item.value
                case "createdFrom":
                    createdFrom = item.value
                case "createdTo":
                    createdTo = item.value
                case "projectId":
                    hasProjectFilter = true
                default:
                    break
                }
            }
        }

        /// The empty page a caller answers when the project filter cannot be
        /// served (project membership has no full local mirror).
        var emptyPage: MemoListResponse {
            MemoListResponse(data: [], total: 0, limit: limit ?? 20, offset: offset)
        }
    }

    // MARK: - List

    static func listMemos(_ db: Database, query: ListQuery) throws -> MemoListResponse {
        // Filter semantics mirror packages/db/src/memoRepository.ts:
        // labels are OR (any match), search is a plain LIKE substring,
        // created bounds compare server-localtime DATE() values.
        var conditions = ["i.type = 'memo'", "i.is_deleted = 0"]
        var arguments: [DatabaseValueConvertible] = []

        if query.bookmarked {
            conditions.append("i.is_bookmarked = 1")
        }
        if !query.labels.isEmpty {
            let placeholders = query.labels.map { _ in "?" }.joined(separator: ", ")
            conditions.append("""
                i.uuid IN (SELECT issue_uuid FROM issue_labels \
                WHERE label_name IN (\(placeholders)))
                """)
            arguments.append(contentsOf: query.labels)
        }
        if let search = query.search, !search.isEmpty {
            conditions.append("i.body_md LIKE ?")
            arguments.append("%\(search)%")
        }
        if let from = query.createdFrom {
            conditions.append("DATE(i.created_at, 'localtime') >= ?")
            arguments.append(from)
        }
        if let to = query.createdTo {
            conditions.append("DATE(i.created_at, 'localtime') <= ?")
            arguments.append(to)
        }

        let whereClause = conditions.joined(separator: " AND ")

        let total = try Int.fetchOne(
            db,
            sql: "SELECT COUNT(*) FROM issues i WHERE \(whereClause)",
            arguments: StatementArguments(arguments)
        ) ?? 0

        var sql = memoSelect + """
             WHERE \(whereClause)
            ORDER BY i.created_at \(query.ascending ? "ASC" : "DESC")
            """
        if let limit = query.limit {
            sql += " LIMIT ? OFFSET ?"
            arguments.append(limit)
            arguments.append(query.offset)
        }

        let rows = try Row.fetchAll(db, sql: sql, arguments: StatementArguments(arguments))
        let memos = try rows.map { try memo(from: $0, db: db) }
        return MemoListResponse(
            data: memos,
            total: total,
            limit: query.limit ?? total,
            offset: query.offset
        )
    }

    // MARK: - Memo rows

    private static let memoSelect = """
        SELECT i.rowid AS local_rowid, i.*,
          (SELECT COUNT(*) FROM comments c
           WHERE c.issue_uuid = i.uuid AND c.is_deleted = 0) AS comment_count
        FROM issues i
        """

    /// Resolves the protocol's integer id: positive = server_id,
    /// negative = -rowid (local-only row).
    static func fetchMemoRow(_ db: Database, id: Int) throws -> Row? {
        if id > 0 {
            return try Row.fetchOne(
                db,
                sql: memoSelect + " WHERE i.server_id = ? AND i.type = 'memo' AND i.is_deleted = 0",
                arguments: [id]
            )
        }
        return try Row.fetchOne(
            db,
            sql: memoSelect + " WHERE i.rowid = ? AND i.type = 'memo' AND i.is_deleted = 0",
            arguments: [-id]
        )
    }

    static func fetchMemoRow(_ db: Database, uuid: String) throws -> Row? {
        try Row.fetchOne(db, sql: memoSelect + " WHERE i.uuid = ?", arguments: [uuid])
    }

    static func memo(from row: Row, db: Database) throws -> Memo {
        let uuid: String = row["uuid"]
        let serverId: Int? = row["server_id"]
        let rowid: Int64 = row["local_rowid"]
        let labels = try String.fetchAll(
            db,
            sql: """
                SELECT il.label_name FROM issue_labels il
                LEFT JOIN labels l ON l.name = il.label_name
                WHERE il.issue_uuid = ?
                ORDER BY l.created_at
                """,
            arguments: [uuid]
        )
        return Memo(
            id: serverId ?? -Int(rowid),
            type: row["type"],
            bodyMd: row["body_md"],
            isBookmarked: row["is_bookmarked"],
            isDeleted: row["is_deleted"],
            createdAt: row["created_at"],
            updatedAt: row["updated_at"],
            labels: labels,
            commentCount: row["comment_count"]
        )
    }

    // MARK: - Memo writes

    static func insertMemo(_ db: Database, uuid: String, bodyMd: String, now: String) throws {
        let record = IssueRecord(
            uuid: uuid,
            serverId: nil,
            type: "memo",
            title: nil,
            bodyMd: bodyMd,
            createdAt: now,
            updatedAt: now
        )
        try record.insert(db)
    }

    /// Applies a partial update (nil fields are left untouched) and bumps
    /// updated_at.
    static func updateMemoFields(
        _ db: Database,
        uuid: String,
        bodyMd: String?,
        isBookmarked: Bool?,
        now: String
    ) throws {
        var sets: [String] = ["updated_at = ?"]
        var arguments: [DatabaseValueConvertible] = [now]
        if let bodyMd {
            sets.append("body_md = ?")
            arguments.append(bodyMd)
        }
        if let isBookmarked {
            sets.append("is_bookmarked = ?")
            arguments.append(isBookmarked)
        }
        arguments.append(uuid)
        try db.execute(
            sql: "UPDATE issues SET \(sets.joined(separator: ", ")) WHERE uuid = ?",
            arguments: StatementArguments(arguments)
        )
    }

    /// Soft delete mirroring the server (row survives with is_deleted = 1).
    static func softDeleteMemo(_ db: Database, uuid: String, now: String) throws {
        try db.execute(
            sql: "UPDATE issues SET is_deleted = 1, updated_at = ? WHERE uuid = ?",
            arguments: [now, uuid]
        )
    }

    /// Hard delete for rows that never need to reach a server: drops the memo
    /// row and every comment row under it.
    static func hardDeleteMemoWithComments(_ db: Database, uuid: String) throws {
        try db.execute(sql: "DELETE FROM comments WHERE issue_uuid = ?", arguments: [uuid])
        try db.execute(sql: "DELETE FROM issues WHERE uuid = ?", arguments: [uuid])
    }

    // MARK: - Comments (shared, issue-type agnostic implementation)

    // Thin forwarding wrappers around `LocalCommentStore`, kept so the memo
    // call sites read in memo vocabulary. The implementation moved to
    // `LocalCommentStore` when tasks started sharing it (Phase 9).

    static func listComments(_ db: Database, memoUuid: String, memoId: Int) throws -> [Comment] {
        try LocalCommentStore.listComments(db, issueUuid: memoUuid, issueId: memoId)
    }

    static func fetchCommentRow(_ db: Database, memoUuid: String, id: Int) throws -> Row? {
        try LocalCommentStore.fetchCommentRow(db, issueUuid: memoUuid, id: id)
    }

    static func fetchCommentRow(_ db: Database, uuid: String) throws -> Row? {
        try LocalCommentStore.fetchCommentRow(db, uuid: uuid)
    }

    static func comment(from row: Row, memoId: Int) -> Comment {
        LocalCommentStore.comment(from: row, issueId: memoId)
    }

    static func insertComment(
        _ db: Database,
        uuid: String,
        memoUuid: String,
        bodyMd: String,
        now: String
    ) throws {
        try LocalCommentStore.insertComment(db, uuid: uuid, issueUuid: memoUuid, bodyMd: bodyMd, now: now)
    }

    static func updateCommentBody(_ db: Database, uuid: String, bodyMd: String, now: String) throws {
        try LocalCommentStore.updateCommentBody(db, uuid: uuid, bodyMd: bodyMd, now: now)
    }

    /// Soft delete mirroring the server (row survives with is_deleted = 1).
    static func softDeleteComment(_ db: Database, uuid: String, now: String) throws {
        try LocalCommentStore.softDeleteComment(db, uuid: uuid, now: now)
    }

    /// Hard delete for comments that never need to reach a server.
    static func hardDeleteComment(_ db: Database, uuid: String) throws {
        try LocalCommentStore.hardDeleteComment(db, uuid: uuid)
    }
}

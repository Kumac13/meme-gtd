import Foundation
import GRDB

/// Local (GRDB) CRUD for issue comments, shared by the memo AND task data
/// sources (offline support plan Phase 9 generalized this out of
/// `LocalMemoStore`, whose comment section was already issue-type agnostic).
///
/// Like the other Local*Store types this knows NOTHING about the outbox or
/// the network: every function operates on a `Database` handle inside the
/// caller's transaction.
///
/// Identity follows the app-wide convention: rows are keyed by
/// client-generated UUIDv7, synced rows surface `id == server_id` (positive),
/// local-only rows surface `id == -rowid` (negative).
nonisolated enum LocalCommentStore {
    private static let commentSelect = """
        SELECT c.rowid AS local_rowid, c.*
        FROM comments c
        """

    /// Comments of one issue in the order every server repository uses
    /// (created_at ASC), deleted rows excluded.
    static func listComments(_ db: Database, issueUuid: String, issueId: Int) throws -> [Comment] {
        let rows = try Row.fetchAll(
            db,
            sql: commentSelect + """
                 WHERE c.issue_uuid = ? AND c.is_deleted = 0
                ORDER BY c.created_at ASC
                """,
            arguments: [issueUuid]
        )
        return rows.map { comment(from: $0, issueId: issueId) }
    }

    /// Resolves the protocol's integer comment id: positive = server_id,
    /// negative = -rowid (local-only row). Scoped to the parent issue so a
    /// stale id can never touch another issue's comment.
    static func fetchCommentRow(_ db: Database, issueUuid: String, id: Int) throws -> Row? {
        if id > 0 {
            return try Row.fetchOne(
                db,
                sql: commentSelect + " WHERE c.server_id = ? AND c.issue_uuid = ? AND c.is_deleted = 0",
                arguments: [id, issueUuid]
            )
        }
        return try Row.fetchOne(
            db,
            sql: commentSelect + " WHERE c.rowid = ? AND c.issue_uuid = ? AND c.is_deleted = 0",
            arguments: [-id, issueUuid]
        )
    }

    static func fetchCommentRow(_ db: Database, uuid: String) throws -> Row? {
        try Row.fetchOne(db, sql: commentSelect + " WHERE c.uuid = ?", arguments: [uuid])
    }

    static func comment(from row: Row, issueId: Int) -> Comment {
        let serverId: Int? = row["server_id"]
        let rowid: Int64 = row["local_rowid"]
        return Comment(
            id: serverId ?? -Int(rowid),
            issueId: issueId,
            bodyMd: row["body_md"],
            createdAt: row["created_at"],
            updatedAt: row["updated_at"]
        )
    }

    // MARK: - Writes

    static func insertComment(
        _ db: Database,
        uuid: String,
        issueUuid: String,
        bodyMd: String,
        now: String
    ) throws {
        let record = CommentRecord(
            uuid: uuid,
            serverId: nil,
            issueUuid: issueUuid,
            bodyMd: bodyMd,
            createdAt: now,
            updatedAt: now,
            serverUpdatedAt: nil
        )
        try record.insert(db)
    }

    static func updateCommentBody(_ db: Database, uuid: String, bodyMd: String, now: String) throws {
        try db.execute(
            sql: "UPDATE comments SET body_md = ?, updated_at = ? WHERE uuid = ?",
            arguments: [bodyMd, now, uuid]
        )
    }

    /// Soft delete mirroring the server (row survives with is_deleted = 1).
    static func softDeleteComment(_ db: Database, uuid: String, now: String) throws {
        try db.execute(
            sql: "UPDATE comments SET is_deleted = 1, updated_at = ? WHERE uuid = ?",
            arguments: [now, uuid]
        )
    }

    /// Hard delete for comments that never need to reach a server.
    static func hardDeleteComment(_ db: Database, uuid: String) throws {
        try db.execute(sql: "DELETE FROM comments WHERE uuid = ?", arguments: [uuid])
    }
}

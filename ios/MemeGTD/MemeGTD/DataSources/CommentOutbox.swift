import Foundation
import GRDB

/// Local comment writes + outbox bookkeeping, shared by every offline-first
/// data source (memo / task / article). Generalized out of
/// `OfflineFirstMemoDataSource` when task and article comments gained the
/// same offline path (comments are issue-type agnostic on the server: a
/// `pending_operations` row with entity='comment' carries the PARENT issue's
/// uuid in `issue_uuid`, and the push endpoint resolves the parent by uuid
/// regardless of its type).
///
/// Every function operates on a `Database` handle inside the caller's
/// transaction, so the local row and its outbox op always commit together.
/// The comment CRUD itself lives in `LocalCommentStore`; this type owns the
/// outbox rules that used to be inlined in the memo data source:
///
/// - create: insert + enqueue a create op carrying the parent issue uuid
///   (FIFO guarantees a queued parent create, if any, lands first)
/// - update: outbox compression — merge into the newest un-sent op for this
///   comment (state 'queued' only: inflight/failed batches may have reached
///   the server, so merging into them could lose the edit to opId dedupe).
///   A queued create absorbs the edit; consecutive queued updates collapse.
/// - delete: a queued create + delete cancel each other (the comment never
///   reached the server — hard-delete the row and drop its ops); otherwise
///   soft-delete mirroring the server, drop superseded queued updates, and
///   enqueue the delete with baseUpdatedAt for edit-beats-delete on the
///   server.
nonisolated enum CommentOutbox {
    // MARK: - Create

    static func createComment(
        _ db: Database,
        issueUuid: String,
        issueId: Int,
        bodyMd: String
    ) throws -> Comment {
        let uuid = UUIDv7.generate()
        let now = ISO8601Millis.now()

        try LocalCommentStore.insertComment(
            db,
            uuid: uuid,
            issueUuid: issueUuid,
            bodyMd: bodyMd,
            now: now
        )

        try enqueue(
            db,
            opType: "create",
            targetUuid: uuid,
            issueUuid: issueUuid,
            payload: SyncPushPayload(bodyMd: bodyMd, createdAt: now),
            baseUpdatedAt: nil,
            now: now
        )

        guard let row = try LocalCommentStore.fetchCommentRow(db, uuid: uuid) else {
            throw LocalMemoError.commentNotFound
        }
        return LocalCommentStore.comment(from: row, issueId: issueId)
    }

    // MARK: - Update

    static func updateComment(
        _ db: Database,
        issueUuid: String,
        issueId: Int,
        commentId: Int,
        bodyMd: String
    ) throws -> Comment {
        let now = ISO8601Millis.now()

        guard let row = try LocalCommentStore.fetchCommentRow(db, issueUuid: issueUuid, id: commentId) else {
            throw LocalMemoError.commentNotFound
        }
        let uuid: String = row["uuid"]
        let serverUpdatedAt: String? = row["server_updated_at"]

        try LocalCommentStore.updateCommentBody(db, uuid: uuid, bodyMd: bodyMd, now: now)

        if var queued = try PendingOperationRecord.fetchOne(
            db,
            sql: """
                SELECT * FROM pending_operations
                WHERE target_uuid = ? AND entity = 'comment' AND state = 'queued'
                  AND op_type IN ('create', 'update')
                ORDER BY id DESC LIMIT 1
                """,
            arguments: [uuid]
        ) {
            var payload = try decodePayload(queued.payload) ?? SyncPushPayload()
            payload.bodyMd = bodyMd
            queued.payload = try encodePayload(payload)
            try queued.update(db)
        } else {
            try enqueue(
                db,
                opType: "update",
                targetUuid: uuid,
                issueUuid: issueUuid,
                payload: SyncPushPayload(bodyMd: bodyMd),
                baseUpdatedAt: serverUpdatedAt,
                now: now
            )
        }

        guard let updated = try LocalCommentStore.fetchCommentRow(db, uuid: uuid) else {
            throw LocalMemoError.commentNotFound
        }
        return LocalCommentStore.comment(from: updated, issueId: issueId)
    }

    // MARK: - Delete

    static func deleteComment(
        _ db: Database,
        issueUuid: String,
        commentId: Int
    ) throws {
        guard let row = try LocalCommentStore.fetchCommentRow(db, issueUuid: issueUuid, id: commentId) else {
            throw LocalMemoError.commentNotFound
        }
        let uuid: String = row["uuid"]
        let serverUpdatedAt: String? = row["server_updated_at"]

        let hasQueuedCreate = try Bool.fetchOne(
            db,
            sql: """
                SELECT EXISTS(
                  SELECT 1 FROM pending_operations
                  WHERE target_uuid = ? AND op_type = 'create' AND state = 'queued'
                )
                """,
            arguments: [uuid]
        ) ?? false

        if hasQueuedCreate {
            try db.execute(
                sql: "DELETE FROM pending_operations WHERE target_uuid = ?",
                arguments: [uuid]
            )
            try LocalCommentStore.hardDeleteComment(db, uuid: uuid)
        } else {
            let now = ISO8601Millis.now()
            try LocalCommentStore.softDeleteComment(db, uuid: uuid, now: now)
            try db.execute(
                sql: """
                    DELETE FROM pending_operations
                    WHERE target_uuid = ? AND op_type = 'update' AND state = 'queued'
                    """,
                arguments: [uuid]
            )
            try enqueue(
                db,
                opType: "delete",
                targetUuid: uuid,
                issueUuid: issueUuid,
                payload: nil,
                baseUpdatedAt: serverUpdatedAt,
                now: now
            )
        }
    }

    // MARK: - Outbox helpers

    private static func enqueue(
        _ db: Database,
        opType: String,
        targetUuid: String,
        issueUuid: String,
        payload: SyncPushPayload?,
        baseUpdatedAt: String?,
        now: String
    ) throws {
        var record = PendingOperationRecord(
            id: nil,
            opId: UUID().uuidString.lowercased(),
            entity: "comment",
            opType: opType,
            targetUuid: targetUuid,
            issueUuid: issueUuid,
            payload: try encodePayload(payload),
            baseUpdatedAt: baseUpdatedAt,
            createdAt: now
        )
        try record.insert(db)
    }

    private static func decodePayload(_ raw: String?) throws -> SyncPushPayload? {
        guard let raw, let data = raw.data(using: .utf8) else { return nil }
        return try JSONDecoder().decode(SyncPushPayload.self, from: data)
    }

    private static func encodePayload(_ payload: SyncPushPayload?) throws -> String? {
        guard let payload else { return nil }
        let data = try JSONEncoder().encode(payload)
        return String(data: data, encoding: .utf8)
    }
}

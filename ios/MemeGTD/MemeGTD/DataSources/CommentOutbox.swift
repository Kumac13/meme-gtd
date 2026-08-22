import Foundation
import GRDB

/// Outbox (`pending_operations`) bookkeeping, shared by every offline-capable
/// data source so the queueing rules exist exactly once.
///
/// Like the `Local*Store` types these functions know nothing about the
/// network: they operate on a `Database` handle inside the caller's
/// transaction, so the local row and its pending operation are always written
/// atomically.
nonisolated enum PendingOperationQueue {
    /// Appends one operation to the outbox. FIFO order comes from the
    /// auto-increment rowid, which is what guarantees a parent's create op
    /// reaches the server before the ops that reference it.
    static func enqueue(
        _ db: Database,
        entity: String,
        opType: String,
        targetUuid: String,
        issueUuid: String? = nil,
        payload: SyncPushPayload?,
        baseUpdatedAt: String?,
        now: String
    ) throws {
        var record = PendingOperationRecord(
            id: nil,
            opId: UUID().uuidString.lowercased(),
            entity: entity,
            opType: opType,
            targetUuid: targetUuid,
            issueUuid: issueUuid,
            payload: try encodePayload(payload),
            baseUpdatedAt: baseUpdatedAt,
            createdAt: now
        )
        try record.insert(db)
    }

    /// Newest op for `targetUuid` that has NOT been sent yet (state 'queued'
    /// only — inflight/failed batches may already have reached the server, so
    /// merging into them could lose the new fields to opId dedupe). Callers
    /// merge their change into it instead of appending a second op; a queued
    /// create absorbs later edits, so the server sees one create with the
    /// final content.
    static func queuedMergeTarget(
        _ db: Database,
        entity: String,
        targetUuid: String
    ) throws -> PendingOperationRecord? {
        try PendingOperationRecord.fetchOne(
            db,
            sql: """
                SELECT * FROM pending_operations
                WHERE target_uuid = ? AND entity = ? AND state = 'queued'
                  AND op_type IN ('create', 'update')
                ORDER BY id DESC LIMIT 1
                """,
            arguments: [targetUuid, entity]
        )
    }

    /// True while the target's own create op is still unsent — i.e. the row
    /// has never existed on the server.
    static func hasQueuedCreate(_ db: Database, targetUuid: String) throws -> Bool {
        try Bool.fetchOne(
            db,
            sql: """
                SELECT EXISTS(
                  SELECT 1 FROM pending_operations
                  WHERE target_uuid = ? AND op_type = 'create' AND state = 'queued'
                )
                """,
            arguments: [targetUuid]
        ) ?? false
    }

    /// Drops queued updates superseded by a delete (edit-beats-delete
    /// conflicts are decided by the server against baseUpdatedAt, not by
    /// stale updates).
    static func dropQueuedUpdates(_ db: Database, targetUuid: String) throws {
        try db.execute(
            sql: """
                DELETE FROM pending_operations
                WHERE target_uuid = ? AND op_type = 'update' AND state = 'queued'
                """,
            arguments: [targetUuid]
        )
    }

    /// Drops every op for a target whose create never reached the server
    /// (create + delete cancel each other).
    static func dropAllOperations(_ db: Database, targetUuid: String) throws {
        try db.execute(
            sql: "DELETE FROM pending_operations WHERE target_uuid = ?",
            arguments: [targetUuid]
        )
    }

    static func decodePayload(_ raw: String?) throws -> SyncPushPayload? {
        guard let raw, let data = raw.data(using: .utf8) else { return nil }
        return try JSONDecoder().decode(SyncPushPayload.self, from: data)
    }

    static func encodePayload(_ payload: SyncPushPayload?) throws -> String? {
        guard let payload else { return nil }
        let data = try JSONEncoder().encode(payload)
        return String(data: data, encoding: .utf8)
    }
}

/// Offline comment writes for EVERY issue type (memo / task / article).
///
/// Comments are the one mutation tasks and articles accept while the server
/// is unreachable: the sync protocol resolves a comment through its parent's
/// uuid (`issueUuid`), never through the issue type, so the same outbox path
/// memos have always used works unchanged for a task or an article that the
/// pull has already mirrored locally.
///
/// The local row and its pending operation are written in the caller's
/// transaction. Identity follows the app-wide convention: synced comments
/// surface `id == server_id`, comments created offline surface `id == -rowid`
/// until the push assigns them one.
nonisolated enum CommentOutbox {
    private static let entity = "comment"

    /// Creates a comment locally and queues its create op. The op carries the
    /// PARENT issue's uuid: the server resolves the comment through it, and
    /// FIFO guarantees a locally-created parent's own create op (a smaller
    /// outbox id) lands first.
    @discardableResult
    static func create(
        _ db: Database,
        issueUuid: String,
        issueId: Int,
        bodyMd: String,
        now: String
    ) throws -> Comment {
        let uuid = UUIDv7.generate()
        try LocalCommentStore.insertComment(
            db,
            uuid: uuid,
            issueUuid: issueUuid,
            bodyMd: bodyMd,
            now: now
        )
        try PendingOperationQueue.enqueue(
            db,
            entity: entity,
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

    /// Applies an edit locally and queues (or merges into) its update op.
    @discardableResult
    static func update(
        _ db: Database,
        issueUuid: String,
        issueId: Int,
        commentId: Int,
        bodyMd: String,
        now: String
    ) throws -> Comment {
        guard let row = try LocalCommentStore.fetchCommentRow(db, issueUuid: issueUuid, id: commentId) else {
            throw LocalMemoError.commentNotFound
        }
        let uuid: String = row["uuid"]
        let serverUpdatedAt: String? = row["server_updated_at"]

        try LocalCommentStore.updateCommentBody(db, uuid: uuid, bodyMd: bodyMd, now: now)

        if var queued = try PendingOperationQueue.queuedMergeTarget(db, entity: entity, targetUuid: uuid) {
            var payload = try PendingOperationQueue.decodePayload(queued.payload) ?? SyncPushPayload()
            payload.bodyMd = bodyMd
            queued.payload = try PendingOperationQueue.encodePayload(payload)
            try queued.update(db)
        } else {
            try PendingOperationQueue.enqueue(
                db,
                entity: entity,
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

    /// Deletes a comment locally and queues its delete op — unless its create
    /// is still queued, in which case create + delete cancel each other and
    /// the row disappears without ever reaching the server.
    static func delete(
        _ db: Database,
        issueUuid: String,
        commentId: Int,
        now: String
    ) throws {
        guard let row = try LocalCommentStore.fetchCommentRow(db, issueUuid: issueUuid, id: commentId) else {
            throw LocalMemoError.commentNotFound
        }
        let uuid: String = row["uuid"]
        let serverUpdatedAt: String? = row["server_updated_at"]

        if try PendingOperationQueue.hasQueuedCreate(db, targetUuid: uuid) {
            try PendingOperationQueue.dropAllOperations(db, targetUuid: uuid)
            try LocalCommentStore.hardDeleteComment(db, uuid: uuid)
            return
        }

        // Soft-delete locally (mirroring the server) and enqueue the delete.
        try LocalCommentStore.softDeleteComment(db, uuid: uuid, now: now)
        try PendingOperationQueue.dropQueuedUpdates(db, targetUuid: uuid)
        try PendingOperationQueue.enqueue(
            db,
            entity: entity,
            opType: "delete",
            targetUuid: uuid,
            issueUuid: issueUuid,
            payload: nil,
            baseUpdatedAt: serverUpdatedAt,
            now: now
        )
    }

    /// Comments of this issue that were written offline and have not been
    /// confirmed by the server yet (no `server_id`, still carrying outbox
    /// ops). Screens that read comments FROM THE SERVER (tasks / articles)
    /// append these, so a comment written offline stays on the timeline
    /// instead of vanishing the moment connectivity returns and the remote
    /// list — which cannot know about it until the push lands — comes back.
    static func pendingComments(
        _ db: Database,
        issueUuid: String,
        issueId: Int
    ) throws -> [Comment] {
        let rows = try Row.fetchAll(
            db,
            sql: """
                SELECT c.rowid AS local_rowid, c.*
                FROM comments c
                WHERE c.issue_uuid = ? AND c.is_deleted = 0 AND c.server_id IS NULL
                  AND EXISTS(
                    SELECT 1 FROM pending_operations p
                    WHERE p.target_uuid = c.uuid AND p.entity = 'comment'
                  )
                ORDER BY c.created_at ASC
                """,
            arguments: [issueUuid]
        )
        return rows.map { LocalCommentStore.comment(from: $0, issueId: issueId) }
    }
}

import Foundation
import GRDB

/// Serverモードでメモとコメントを端末に保存し、同じトランザクションで再送を予約する。
nonisolated final class OfflineFirstMemoDataSource: MemoDataSource {
    private let threads: OfflineThreadStore
    private let database: AppDatabase
    private let remote: MemoDataSource
    private let onLocalWrite: () -> Void

    init(
        database: AppDatabase,
        remote: MemoDataSource,
        onLocalWrite: @escaping () -> Void = {}
    ) {
        self.threads = OfflineThreadStore(database: database, onLocalWrite: onLocalWrite)
        self.database = database
        self.remote = remote
        self.onLocalWrite = onLocalWrite
    }

    // MARK: - List

    func listMemos(queryItems: [URLQueryItem]) async throws -> MemoListResponse {
        let query = LocalMemoStore.ListQuery(queryItems: queryItems)

        return try await database.dbWriter.read { db in
            try LocalMemoStore.listMemos(db, query: query)
        }
    }

    // MARK: - Get

    func getMemo(id: Int) async throws -> Memo {
        let local: Memo? = try await database.dbWriter.read { db in
            guard let row = try LocalMemoStore.fetchMemoRow(db, id: id) else { return nil }
            return try LocalMemoStore.memo(from: row, db: db)
        }
        if let local { return local }
        // Not mirrored locally yet (e.g. opened before the initial pull
        // finished). Server ids can be answered by the server directly.
        if id > 0 {
            return try await threads.loadBeforeInitialPull(kind: "memo", id: id) { try await remote.getMemo(id: id) }
        }
        throw LocalMemoError.memoNotFound
    }

    // MARK: - Create

    func createMemo(_ request: CreateMemoRequest) async throws -> Memo {
        let uuid = UUIDv7.generate()
        let now = ISO8601Millis.now()

        let memo: Memo = try await database.dbWriter.write { db in
            try LocalMemoStore.insertMemo(db, uuid: uuid, bodyMd: request.bodyMd, now: now)

            try OfflineThreadStore.saveProjects(db, ids: request.projectIds ?? [], uuid: uuid)
            try Self.enqueue(
                db,
                opType: "create",
                targetUuid: uuid,
                payload: SyncPushPayload(bodyMd: request.bodyMd, createdAt: now),
                baseUpdatedAt: nil,
                now: now
            )

            guard let row = try LocalMemoStore.fetchMemoRow(db, uuid: uuid) else {
                throw LocalMemoError.memoNotFound
            }
            return try LocalMemoStore.memo(from: row, db: db)
        }

        onLocalWrite()
        return memo
    }

    // MARK: - Update / bookmark

    func updateMemo(id: Int, _ request: UpdateMemoRequest) async throws -> Memo {
        try await applyLocalUpdate(id: id, bodyMd: request.bodyMd, isBookmarked: request.isBookmarked)
    }

    func bookmarkMemo(id: Int) async throws -> Memo {
        try await applyLocalUpdate(id: id, bodyMd: nil, isBookmarked: true)
    }

    func unbookmarkMemo(id: Int) async throws -> Memo {
        try await applyLocalUpdate(id: id, bodyMd: nil, isBookmarked: false)
    }

    private func applyLocalUpdate(id: Int, bodyMd: String?, isBookmarked: Bool?) async throws -> Memo {
        let now = ISO8601Millis.now()

        let memo: Memo = try await database.dbWriter.write { db in
            guard let row = try LocalMemoStore.fetchMemoRow(db, id: id) else {
                throw LocalMemoError.memoNotFound
            }
            let uuid: String = row["uuid"]
            let serverUpdatedAt: String? = row["server_updated_at"]

            try LocalMemoStore.updateMemoFields(
                db,
                uuid: uuid,
                bodyMd: bodyMd,
                isBookmarked: isBookmarked,
                now: now
            )

            // Outbox compression: merge into an op that has NOT been sent yet
            // (state 'queued' only — inflight/failed batches may have reached
            // the server, so merging into them could lose the new fields to
            // opId dedupe). A queued create absorbs updates too: the server
            // then sees a single create with the final content.
            if var queued = try PendingOperationRecord.fetchOne(
                db,
                sql: """
                    SELECT * FROM pending_operations
                    WHERE target_uuid = ? AND entity = 'memo' AND state = 'queued'
                      AND op_type IN ('create', 'update')
                    ORDER BY id DESC LIMIT 1
                    """,
                arguments: [uuid]
            ) {
                var payload = try Self.decodePayload(queued.payload) ?? SyncPushPayload()
                if let bodyMd { payload.bodyMd = bodyMd }
                if let isBookmarked { payload.isBookmarked = isBookmarked }
                queued.payload = try Self.encodePayload(payload)
                try queued.update(db)
            } else {
                try Self.enqueue(
                    db,
                    opType: "update",
                    targetUuid: uuid,
                    payload: SyncPushPayload(bodyMd: bodyMd, isBookmarked: isBookmarked),
                    baseUpdatedAt: serverUpdatedAt,
                    now: now
                )
            }

            guard let updated = try LocalMemoStore.fetchMemoRow(db, uuid: uuid) else {
                throw LocalMemoError.memoNotFound
            }
            return try LocalMemoStore.memo(from: updated, db: db)
        }

        onLocalWrite()
        return memo
    }

    // MARK: - Delete

    func deleteMemo(id: Int) async throws {
        try await database.dbWriter.write { db in
            guard let row = try LocalMemoStore.fetchMemoRow(db, id: id) else {
                throw LocalMemoError.memoNotFound
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
                // create + delete while still queued cancel each other: the
                // memo never reached the server, so drop the row and every
                // pending op for it (a queued create is by FIFO the target's
                // first op, so nothing for this uuid was sent yet). Offline
                // comments on the memo never reached the server either — drop
                // their rows and ops too.
                try db.execute(
                    sql: "DELETE FROM pending_operations WHERE target_uuid = ? OR issue_uuid = ?",
                    arguments: [uuid, uuid]
                )
                try db.execute(sql: "DELETE FROM pending_memberships WHERE issue_uuid = ?", arguments: [uuid])
                try LocalMemoStore.hardDeleteMemoWithComments(db, uuid: uuid)
            } else {
                // Soft-delete locally (mirroring the server) and enqueue the
                // delete. Queued updates for the target are superseded by the
                // delete and dropped (edit-beats-delete conflicts are decided
                // by the server against baseUpdatedAt, not by stale updates).
                let now = ISO8601Millis.now()
                try LocalMemoStore.softDeleteMemo(db, uuid: uuid, now: now)
                try db.execute(
                    sql: """
                        DELETE FROM pending_operations
                        WHERE target_uuid = ? AND op_type = 'update' AND state = 'queued'
                        """,
                    arguments: [uuid]
                )
                try Self.enqueue(
                    db,
                    opType: "delete",
                    targetUuid: uuid,
                    payload: nil,
                    baseUpdatedAt: serverUpdatedAt,
                    now: now
                )
            }
        }

        onLocalWrite()
    }

    // MARK: - Delegated to the server (this phase)

    func promotePreview(memoId: Int) async throws -> PromotePreviewResponse {
        try await remote.promotePreview(memoId: memoId)
    }

    // MARK: - Comments

    func listComments(memoId: Int) async throws -> [Comment] {
        try await threads.comments(id: memoId) { try await remote.listComments(memoId: memoId) }
    }

    func createComment(memoId: Int, _ request: CreateCommentRequest) async throws -> Comment {
        try await threads.add(id: memoId, body: request.bodyMd)
    }

    func updateComment(memoId: Int, commentId: Int, _ request: UpdateCommentRequest) async throws -> Comment {
        let now = ISO8601Millis.now()

        let local: Comment? = try await database.dbWriter.write { db in
            guard let memoRow = try LocalMemoStore.fetchMemoRow(db, id: memoId) else { return nil }
            let memoUuid: String = memoRow["uuid"]
            guard let row = try LocalMemoStore.fetchCommentRow(db, memoUuid: memoUuid, id: commentId) else {
                throw LocalMemoError.commentNotFound
            }
            let uuid: String = row["uuid"]
            let serverUpdatedAt: String? = row["server_updated_at"]

            try LocalMemoStore.updateCommentBody(db, uuid: uuid, bodyMd: request.bodyMd, now: now)

            // Outbox compression, same rules as memo updates: merge into the
            // newest un-sent op for this comment (a queued create absorbs the
            // edit; consecutive queued updates collapse into one).
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
                var payload = try Self.decodePayload(queued.payload) ?? SyncPushPayload()
                payload.bodyMd = request.bodyMd
                queued.payload = try Self.encodePayload(payload)
                try queued.update(db)
            } else {
                try Self.enqueue(
                    db,
                    entity: "comment",
                    opType: "update",
                    targetUuid: uuid,
                    issueUuid: memoUuid,
                    payload: SyncPushPayload(bodyMd: request.bodyMd),
                    baseUpdatedAt: serverUpdatedAt,
                    now: now
                )
            }

            guard let updated = try LocalMemoStore.fetchCommentRow(db, uuid: uuid) else {
                throw LocalMemoError.commentNotFound
            }
            return LocalMemoStore.comment(from: updated, memoId: memoId)
        }
        if let local {
            onLocalWrite()
            return local
        }
        if memoId > 0 {
            return try await remote.updateComment(memoId: memoId, commentId: commentId, request)
        }
        throw LocalMemoError.memoNotFound
    }

    func deleteComment(memoId: Int, commentId: Int) async throws {
        let handledLocally: Bool = try await database.dbWriter.write { db in
            guard let memoRow = try LocalMemoStore.fetchMemoRow(db, id: memoId) else { return false }
            let memoUuid: String = memoRow["uuid"]
            guard let row = try LocalMemoStore.fetchCommentRow(db, memoUuid: memoUuid, id: commentId) else {
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
                // create + delete while still queued cancel each other: the
                // comment never reached the server, so drop the row and every
                // pending op for it.
                try db.execute(
                    sql: "DELETE FROM pending_operations WHERE target_uuid = ?",
                    arguments: [uuid]
                )
                try LocalMemoStore.hardDeleteComment(db, uuid: uuid)
            } else {
                // Soft-delete locally (mirroring the server) and enqueue the
                // delete; queued updates are superseded and dropped.
                let now = ISO8601Millis.now()
                try LocalMemoStore.softDeleteComment(db, uuid: uuid, now: now)
                try db.execute(
                    sql: """
                        DELETE FROM pending_operations
                        WHERE target_uuid = ? AND op_type = 'update' AND state = 'queued'
                        """,
                    arguments: [uuid]
                )
                try Self.enqueue(
                    db,
                    entity: "comment",
                    opType: "delete",
                    targetUuid: uuid,
                    issueUuid: memoUuid,
                    payload: nil,
                    baseUpdatedAt: serverUpdatedAt,
                    now: now
                )
            }
            return true
        }
        if handledLocally {
            onLocalWrite()
            return
        }
        if memoId > 0 {
            try await remote.deleteComment(memoId: memoId, commentId: commentId)
            return
        }
        throw LocalMemoError.memoNotFound
    }

    // MARK: - Outbox helpers

    private static func enqueue(
        _ db: Database,
        entity: String = "memo",
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

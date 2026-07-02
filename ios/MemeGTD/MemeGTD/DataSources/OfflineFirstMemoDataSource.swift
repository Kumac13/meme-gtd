import Foundation
import GRDB

/// Errors surfaced by the offline-first data source (English, user-facing).
nonisolated enum OfflineFirstMemoError: Error, LocalizedError {
    case memoNotFound
    case commentsRequireSync

    var errorDescription: String? {
        switch self {
        case .memoNotFound:
            return "Memo not found in the local database."
        case .commentsRequireSync:
            return "Comments become available after this memo has synced to the server."
        }
    }
}

/// Offline-first `MemoDataSource` (offline support plan S2, Phase 5), active
/// only while the "Offline Sync (Beta)" setting is on.
///
/// READS come from the local GRDB mirror. WRITES apply locally and enqueue a
/// pending operation in the outbox within the SAME transaction, then poke the
/// scheduler so the SyncEngine pushes when connectivity allows.
///
/// Identity: rows are keyed by client-generated UUIDv7, but the protocol (and
/// every ViewModel) speaks integer memo ids. The mapping is:
/// - synced rows: `id == server_id` (positive)
/// - local-only rows (created offline, not yet pushed): `id == -rowid`
///   (negative, never collides with server ids). Once the push assigns a
///   server_id, list reloads surface the row under its server id.
///
/// Delegated to the wrapped remote implementation (server-only in this phase):
/// - promotePreview (server-side logic is never duplicated on clients)
/// - all comment methods (offline comments arrive in Phase 6); comment COUNTS
///   for list rows still come from the local `comments` table
/// - list requests with a projectId filter (project tables have no local
///   mirror until Phase 7); offline, such a request returns an empty page
///   rather than silently ignoring the filter
/// - semantic/keyword search endpoints are a different data source entirely
///   (SearchDataSource) and are untouched by this class; the plain `search`
///   query item on the list endpoint IS served locally with LIKE, mirroring
///   the server's behavior
nonisolated final class OfflineFirstMemoDataSource: MemoDataSource {
    private let database: AppDatabase
    private let remote: MemoDataSource
    private let onLocalWrite: () -> Void

    init(
        database: AppDatabase,
        remote: MemoDataSource,
        onLocalWrite: @escaping () -> Void = {}
    ) {
        self.database = database
        self.remote = remote
        self.onLocalWrite = onLocalWrite
    }

    // MARK: - List

    /// Query items understood by GET /api/memos, as built by
    /// MemoListViewModel.buildListQueryItems and MemoDetailViewModel.searchIssues.
    private struct ListQuery {
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
    }

    func listMemos(queryItems: [URLQueryItem]) async throws -> MemoListResponse {
        let query = ListQuery(queryItems: queryItems)

        // Project membership is not mirrored locally in this phase: serve the
        // filter from the server while online; offline, an empty page is the
        // honest answer (ignoring the filter would show wrong contents).
        if query.hasProjectFilter {
            do {
                return try await remote.listMemos(queryItems: queryItems)
            } catch {
                return MemoListResponse(
                    data: [],
                    total: 0,
                    limit: query.limit ?? 20,
                    offset: query.offset
                )
            }
        }

        return try await database.dbWriter.read { db in
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

            var sql = """
                SELECT i.rowid AS local_rowid, i.*,
                  (SELECT COUNT(*) FROM comments c
                   WHERE c.issue_uuid = i.uuid AND c.is_deleted = 0) AS comment_count
                FROM issues i
                WHERE \(whereClause)
                ORDER BY i.created_at \(query.ascending ? "ASC" : "DESC")
                """
            if let limit = query.limit {
                sql += " LIMIT ? OFFSET ?"
                arguments.append(limit)
                arguments.append(query.offset)
            }

            let rows = try Row.fetchAll(db, sql: sql, arguments: StatementArguments(arguments))
            let memos = try rows.map { try Self.memo(from: $0, db: db) }
            return MemoListResponse(
                data: memos,
                total: total,
                limit: query.limit ?? total,
                offset: query.offset
            )
        }
    }

    // MARK: - Get

    func getMemo(id: Int) async throws -> Memo {
        let local: Memo? = try await database.dbWriter.read { db in
            guard let row = try Self.fetchRow(db, id: id) else { return nil }
            return try Self.memo(from: row, db: db)
        }
        if let local { return local }
        // Not mirrored locally yet (e.g. opened before the initial pull
        // finished). Server ids can be answered by the server directly.
        if id > 0 {
            return try await remote.getMemo(id: id)
        }
        throw OfflineFirstMemoError.memoNotFound
    }

    // MARK: - Create

    func createMemo(_ request: CreateMemoRequest) async throws -> Memo {
        let uuid = UUIDv7.generate()
        let now = ISO8601Millis.now()

        let memo: Memo = try await database.dbWriter.write { db in
            var record = IssueRecord(
                uuid: uuid,
                serverId: nil,
                type: "memo",
                title: nil,
                bodyMd: request.bodyMd,
                createdAt: now,
                updatedAt: now
            )
            try record.insert(db)

            try Self.enqueue(
                db,
                opType: "create",
                targetUuid: uuid,
                payload: SyncPushPayload(bodyMd: request.bodyMd, createdAt: now),
                baseUpdatedAt: nil,
                now: now
            )

            guard let row = try Self.fetchRow(db, uuid: uuid) else {
                throw OfflineFirstMemoError.memoNotFound
            }
            return try Self.memo(from: row, db: db)
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
            guard let row = try Self.fetchRow(db, id: id) else {
                throw OfflineFirstMemoError.memoNotFound
            }
            let uuid: String = row["uuid"]
            let serverUpdatedAt: String? = row["server_updated_at"]

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

            guard let updated = try Self.fetchRow(db, uuid: uuid) else {
                throw OfflineFirstMemoError.memoNotFound
            }
            return try Self.memo(from: updated, db: db)
        }

        onLocalWrite()
        return memo
    }

    // MARK: - Delete

    func deleteMemo(id: Int) async throws {
        try await database.dbWriter.write { db in
            guard let row = try Self.fetchRow(db, id: id) else {
                throw OfflineFirstMemoError.memoNotFound
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
                // first op, so nothing for this uuid was sent yet).
                try db.execute(
                    sql: "DELETE FROM pending_operations WHERE target_uuid = ?",
                    arguments: [uuid]
                )
                try db.execute(sql: "DELETE FROM issues WHERE uuid = ?", arguments: [uuid])
            } else {
                // Soft-delete locally (mirroring the server) and enqueue the
                // delete. Queued updates for the target are superseded by the
                // delete and dropped (edit-beats-delete conflicts are decided
                // by the server against baseUpdatedAt, not by stale updates).
                let now = ISO8601Millis.now()
                try db.execute(
                    sql: "UPDATE issues SET is_deleted = 1, updated_at = ? WHERE uuid = ?",
                    arguments: [now, uuid]
                )
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

    func listComments(memoId: Int) async throws -> [Comment] {
        // A negative id means the memo has not reached the server yet, so it
        // cannot have server-side comments.
        guard memoId > 0 else { return [] }
        return try await remote.listComments(memoId: memoId)
    }

    func createComment(memoId: Int, _ request: CreateCommentRequest) async throws -> Comment {
        guard memoId > 0 else { throw OfflineFirstMemoError.commentsRequireSync }
        return try await remote.createComment(memoId: memoId, request)
    }

    func updateComment(memoId: Int, commentId: Int, _ request: UpdateCommentRequest) async throws -> Comment {
        guard memoId > 0 else { throw OfflineFirstMemoError.commentsRequireSync }
        return try await remote.updateComment(memoId: memoId, commentId: commentId, request)
    }

    func deleteComment(memoId: Int, commentId: Int) async throws {
        guard memoId > 0 else { throw OfflineFirstMemoError.commentsRequireSync }
        try await remote.deleteComment(memoId: memoId, commentId: commentId)
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
                sql: rowSelect + " WHERE i.server_id = ? AND i.type = 'memo' AND i.is_deleted = 0",
                arguments: [id]
            )
        }
        return try Row.fetchOne(
            db,
            sql: rowSelect + " WHERE i.rowid = ? AND i.type = 'memo' AND i.is_deleted = 0",
            arguments: [-id]
        )
    }

    private static func fetchRow(_ db: Database, uuid: String) throws -> Row? {
        try Row.fetchOne(db, sql: rowSelect + " WHERE i.uuid = ?", arguments: [uuid])
    }

    private static func memo(from row: Row, db: Database) throws -> Memo {
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

    // MARK: - Outbox helpers

    private static func enqueue(
        _ db: Database,
        opType: String,
        targetUuid: String,
        payload: SyncPushPayload?,
        baseUpdatedAt: String?,
        now: String
    ) throws {
        var record = PendingOperationRecord(
            id: nil,
            opId: UUID().uuidString.lowercased(),
            entity: "memo",
            opType: opType,
            targetUuid: targetUuid,
            issueUuid: nil,
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

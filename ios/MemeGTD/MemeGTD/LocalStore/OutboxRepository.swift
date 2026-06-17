import Foundation

/// CRUD over the `outbox` table — the SyncEngine's queue of pending writes.
/// All retry-policy state (attempts, last_error, next_retry_at) lives here
/// so the engine can survive an app restart and pick up exactly where it
/// left off.
final class OutboxRepository {
    private let db: SQLiteDatabase
    private let isoFormatter: ISO8601DateFormatter

    init(db: SQLiteDatabase = LocalDatabase.shared.sqlite) {
        self.db = db
        self.isoFormatter = ISO8601DateFormatter()
        self.isoFormatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
    }

    /// Enqueue a fresh op. ULID id for the row itself means we can ORDER BY
    /// id and get a stable, time-ish ordering without a separate index.
    @discardableResult
    func enqueue(opType: OutboxOperation.OpType, targetId: String, payload: Data) throws -> OutboxOperation {
        let now = Date()
        let op = OutboxOperation(
            id: ULID.generate(),
            opType: opType,
            targetId: targetId,
            payload: payload,
            state: .pending,
            attempts: 0,
            lastError: nil,
            createdAt: now,
            nextRetryAt: now
        )
        let payloadStr = String(data: payload, encoding: .utf8) ?? "{}"
        try db.write("""
            INSERT INTO outbox (id, op_type, target_id, payload, state, attempts, last_error, created_at, next_retry_at)
            VALUES (?, ?, ?, ?, 'pending', 0, NULL, ?, ?);
            """) { stmt in
                try stmt.bind(1, op.id)
                try stmt.bind(2, op.opType.rawValue)
                try stmt.bind(3, op.targetId)
                try stmt.bind(4, payloadStr)
                try stmt.bind(5, self.isoFormatter.string(from: op.createdAt))
                try stmt.bind(6, self.isoFormatter.string(from: now))
            }
        return op
    }

    /// Items the SyncEngine should try right now: state in ('pending') or
    /// state='failed' but next_retry_at has elapsed. 'syncing' is excluded
    /// so a second wake-up doesn't try to send the same op twice.
    func dueOperations(now: Date = Date(), limit: Int = 50) throws -> [OutboxOperation] {
        var ops: [OutboxOperation] = []
        let nowStr = isoFormatter.string(from: now)
        try db.query("""
            SELECT id, op_type, target_id, payload, state, attempts, last_error, created_at, next_retry_at
            FROM outbox
            WHERE state = 'pending'
               OR (state = 'failed' AND next_retry_at IS NOT NULL AND next_retry_at <= ?)
            ORDER BY created_at ASC, id ASC
            LIMIT ?;
            """, bind: { stmt in
                try stmt.bind(1, nowStr)
                try stmt.bind(2, Int64(limit))
            }, rowHandler: { row in
                if let op = try self.decode(row: row) {
                    ops.append(op)
                }
            })
        return ops
    }

    /// Items the UI should show as "failed memos". Excludes pending/syncing.
    func failedOperations() throws -> [OutboxOperation] {
        var ops: [OutboxOperation] = []
        try db.query("""
            SELECT id, op_type, target_id, payload, state, attempts, last_error, created_at, next_retry_at
            FROM outbox
            WHERE state = 'failed'
            ORDER BY created_at ASC;
            """, rowHandler: { row in
                if let op = try self.decode(row: row) {
                    ops.append(op)
                }
            })
        return ops
    }

    func failedCount() throws -> Int {
        Int(try db.scalarInt("SELECT COUNT(*) FROM outbox WHERE state = 'failed';"))
    }

    func markSyncing(id: String) throws {
        try db.write("UPDATE outbox SET state = 'syncing' WHERE id = ?;") { stmt in
            try stmt.bind(1, id)
        }
    }

    /// After a successful send the row is gone — we don't keep history.
    /// If we ever want a "synced log" we can add a separate sync_log table
    /// rather than polluting outbox.
    func delete(id: String) throws {
        try db.write("DELETE FROM outbox WHERE id = ?;") { stmt in
            try stmt.bind(1, id)
        }
    }

    /// After a failed attempt, bump attempts/last_error and arrange the next
    /// retry. `state` flips between 'failed' (waiting on backoff) and
    /// 'pending' (ready); the engine treats both as "try again later".
    func markFailed(id: String, attempts: Int, error: String, nextRetryAt: Date?) throws {
        try db.write("""
            UPDATE outbox
            SET state = 'failed',
                attempts = ?,
                last_error = ?,
                next_retry_at = ?
            WHERE id = ?;
            """) { stmt in
                try stmt.bind(1, Int64(attempts))
                try stmt.bind(2, error)
                try stmt.bind(3, nextRetryAt.map(self.isoFormatter.string(from:)))
                try stmt.bind(4, id)
            }
    }

    /// Bootstrap recovery: any row stuck in `'syncing'` is the leftover of a
    /// previous process that died mid-send (after `markSyncing` but before
    /// `delete` or `markFailed`). Without this reset they would never be
    /// picked up again because `dueOperations` only scans `pending`/`failed`.
    /// Safe to call at app launch only — calling it while a drain is mid-flight
    /// would steal a row from under the engine.
    @discardableResult
    func resetStuckSyncing() throws -> Int {
        let now = isoFormatter.string(from: Date())
        var changes = 0
        try db.write("""
            UPDATE outbox
            SET state = 'pending', next_retry_at = ?
            WHERE state = 'syncing';
            """) { stmt in
                try stmt.bind(1, now)
            }
        try db.query("SELECT changes();") { row in
            changes = row.int(at: 0)
        }
        return changes
    }

    /// User-driven manual retry from FailedMemosView: clear the failure
    /// state so the engine picks it up immediately.
    func resetForManualRetry(id: String) throws {
        try db.write("""
            UPDATE outbox
            SET state = 'pending',
                last_error = NULL,
                next_retry_at = ?
            WHERE id = ?;
            """) { stmt in
                try stmt.bind(1, self.isoFormatter.string(from: Date()))
                try stmt.bind(2, id)
            }
    }

    /// User-driven discard from FailedMemosView. We delete the matching
    /// local_memos row too so the memo doesn't linger as a ghost in the UI.
    func deleteOperationAndMemo(id: String, memoRepository: LocalMemoRepository) throws {
        try db.transaction { [db] in
            // First grab the target_id so we know which memo to remove.
            var targetId: String?
            try db.query("SELECT target_id FROM outbox WHERE id = ?;", bind: { stmt in
                try stmt.bind(1, id)
            }, rowHandler: { row in
                targetId = row.string(at: 0)
            })

            try db.write("DELETE FROM outbox WHERE id = ?;") { stmt in
                try stmt.bind(1, id)
            }

            if let targetId = targetId {
                try memoRepository.deleteByLocalId(targetId)
            }
        }
    }

    private func decode(row: SQLiteStatement) throws -> OutboxOperation? {
        guard
            let id = row.string(at: 0),
            let opTypeRaw = row.string(at: 1),
            let opType = OutboxOperation.OpType(rawValue: opTypeRaw),
            let targetId = row.string(at: 2),
            let payloadStr = row.string(at: 3),
            let stateRaw = row.string(at: 4),
            let state = OutboxOperation.State(rawValue: stateRaw),
            let createdAtStr = row.string(at: 7),
            let createdAt = isoFormatter.date(from: createdAtStr)
        else {
            return nil
        }
        return OutboxOperation(
            id: id,
            opType: opType,
            targetId: targetId,
            payload: Data(payloadStr.utf8),
            state: state,
            attempts: Int(row.int64(at: 5)),
            lastError: row.string(at: 6),
            createdAt: createdAt,
            nextRetryAt: row.string(at: 8).flatMap(isoFormatter.date(from:))
        )
    }
}

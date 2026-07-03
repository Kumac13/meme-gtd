import Foundation
import GRDB
import os

private nonisolated let logger = Logger(subsystem: "name.kumac.MemeGTD", category: "SyncEngine")

/// Result of one `syncNow()` run.
nonisolated struct SyncSummary: Equatable {
    /// Outbox operations resolved by the server this run (applied,
    /// alreadyApplied, conflictCopied, or skipped — all leave the outbox).
    var pushedCount: Int = 0
    /// Change-feed entries applied to the local database this run.
    var pulledCount: Int = 0
    /// Push operations the server resolved as `conflictCopied`: the server
    /// kept its version and saved the client body as a new "conflicted copy"
    /// memo (delivered by the pull that follows). Surfaced in the UI as a
    /// toast.
    var conflictCopiedCount: Int = 0
    var errors: [String] = []
    /// Outbox operations still waiting after the run. Non-zero means the push
    /// did not fully drain (e.g. the server was unreachable) — the scheduler
    /// uses this to retry with backoff instead of waiting for the next
    /// external trigger, which may never come.
    var remainingOutboxCount: Int = 0

    /// True when the run changed local or remote state, i.e. stores should
    /// reload their lists.
    var didChangeData: Bool { pushedCount > 0 || pulledCount > 0 }
}

extension Notification.Name {
    /// Posted (from an arbitrary thread) after a `syncNow()` run that pushed
    /// or pulled at least one change. Stores/ViewModels observe this to
    /// reload. Runs that change nothing stay silent, which also terminates
    /// the reload -> read -> sync trigger chain.
    ///
    /// When the run produced conflicted copies, the notification carries
    /// `userInfo[SyncEngine.conflictCopiedUserInfoKey]` (Int > 0) so the UI
    /// can surface a toast.
    nonisolated static let syncEngineDidChangeData = Notification.Name("SyncEngineDidChangeData")
}

nonisolated enum SyncEngineError: Error {
    /// An outbox row carried an entity/op_type the engine does not know.
    case corruptOutboxRow(opId: String)
}

/// Push-then-pull synchronization between the local GRDB mirror and the
/// server sync API (offline support plan S2). The actor serializes runs:
/// concurrent `syncNow()` calls simply queue behind each other.
///
/// Free of UI concerns by design — completion is reported through the
/// returned `SyncSummary` and the `.syncEngineDidChangeData` notification.
actor SyncEngine {
    static let lastServerSeqKey = "last_server_seq"

    /// userInfo key on `.syncEngineDidChangeData` carrying the number of
    /// conflicted copies the server created during the run's push.
    static let conflictCopiedUserInfoKey = "conflictCopied"

    private let database: AppDatabase
    private let transport: SyncTransport
    private let pullPageSize: Int

    init(database: AppDatabase, transport: SyncTransport, pullPageSize: Int = 500) {
        self.database = database
        self.transport = transport
        self.pullPageSize = pullPageSize
    }

    /// Pushes the outbox, then pulls the change feed until exhausted. Any
    /// transport error aborts the run (no retry within the same run — the
    /// scheduler triggers again later, which acts as the backoff).
    @discardableResult
    func syncNow() async -> SyncSummary {
        var summary = SyncSummary()
        do {
            let push = try await pushOutbox()
            summary.pushedCount = push.resolved
            summary.conflictCopiedCount = push.conflictCopied
            summary.pulledCount = try await pullChanges()
        } catch {
            summary.errors.append(error.localizedDescription)
            logger.error("syncNow failed: \(error.localizedDescription, privacy: .public)")
        }
        summary.remainingOutboxCount = (try? await database.dbWriter.read { db in
            try Int.fetchOne(db, sql: "SELECT COUNT(*) FROM pending_operations") ?? 0
        }) ?? 0
        if summary.didChangeData {
            var userInfo: [AnyHashable: Any]?
            if summary.conflictCopiedCount > 0 {
                userInfo = [Self.conflictCopiedUserInfoKey: summary.conflictCopiedCount]
            }
            NotificationCenter.default.post(
                name: .syncEngineDidChangeData,
                object: nil,
                userInfo: userInfo
            )
        }
        logger.info("syncNow done: pushed=\(summary.pushedCount), pulled=\(summary.pulledCount), conflictCopied=\(summary.conflictCopiedCount), errors=\(summary.errors.count), remaining=\(summary.remainingOutboxCount)")
        return summary
    }

    // MARK: - Push

    /// Sends all outbox operations as one batch, FIFO by id. Returns the
    /// number of operations the server resolved (they leave the outbox) and
    /// how many of them produced a conflicted copy.
    private func pushOutbox() async throws -> (resolved: Int, conflictCopied: Int) {
        // Load every state: 'queued' is the normal case, 'failed' rows are
        // the ones this trigger retries, and 'inflight' rows are stale
        // leftovers from a crash mid-push — resending any of them is safe
        // because the server dedupes by opId.
        let ops: [PendingOperationRecord] = try await database.dbWriter.write { db in
            let records = try PendingOperationRecord.fetchAll(
                db,
                sql: "SELECT * FROM pending_operations ORDER BY id"
            )
            if !records.isEmpty {
                try db.execute(sql: "UPDATE pending_operations SET state = 'inflight'")
            }
            return records
        }
        guard !ops.isEmpty else { return (0, 0) }

        let deviceId = try DeviceID.identifier(in: database)
        let request = SyncPushRequest(
            deviceId: deviceId,
            operations: try ops.map { try Self.pushOperation(from: $0) }
        )

        let response: SyncPushResponse
        do {
            response = try await transport.push(request)
        } catch {
            // Transport failure: mark the batch failed and abort this run.
            try await database.dbWriter.write { db in
                try db.execute(
                    sql: """
                        UPDATE pending_operations
                        SET state = 'failed', retry_count = retry_count + 1
                        WHERE state = 'inflight'
                        """
                )
            }
            throw error
        }

        let resultsByOpId = Dictionary(
            response.results.map { ($0.opId, $0) },
            uniquingKeysWith: { first, _ in first }
        )

        let outcome: (resolved: Int, conflictCopied: Int) = try await database.dbWriter.write { db in
            var resolvedCount = 0
            var conflictCopiedCount = 0
            for op in ops {
                guard let result = resultsByOpId[op.opId] else {
                    // The server returned no verdict for this op (unexpected):
                    // keep it for the next run.
                    try db.execute(
                        sql: """
                            UPDATE pending_operations
                            SET state = 'failed', retry_count = retry_count + 1
                            WHERE op_id = ?
                            """,
                        arguments: [op.opId]
                    )
                    continue
                }

                switch result.status {
                case .applied, .alreadyApplied:
                    // Record the server identity and the authoritative
                    // updatedAt so the next local edit carries the correct
                    // baseUpdatedAt.
                    let table = op.entity == SyncPushEntity.comment.rawValue ? "comments" : "issues"
                    if let serverId = result.serverId {
                        try db.execute(
                            sql: "UPDATE \(table) SET server_id = ? WHERE uuid = ?",
                            arguments: [serverId, op.targetUuid]
                        )
                    }
                    if let updatedAt = result.updatedAt {
                        try db.execute(
                            sql: "UPDATE \(table) SET server_updated_at = ? WHERE uuid = ?",
                            arguments: [updatedAt, op.targetUuid]
                        )
                    }
                case .conflictCopied:
                    // Server state wins; the pull that follows restores the
                    // server row and delivers the conflicted copy.
                    conflictCopiedCount += 1
                case .skipped:
                    // Server state wins; the pull that follows restores the
                    // server row.
                    break
                }

                try db.execute(
                    sql: "DELETE FROM pending_operations WHERE op_id = ?",
                    arguments: [op.opId]
                )
                resolvedCount += 1
            }
            return (resolvedCount, conflictCopiedCount)
        }
        return outcome
    }

    private static func pushOperation(from record: PendingOperationRecord) throws -> SyncPushOperation {
        guard let entity = SyncPushEntity(rawValue: record.entity),
              let type = SyncPushOpType(rawValue: record.opType) else {
            throw SyncEngineError.corruptOutboxRow(opId: record.opId)
        }
        var payload: SyncPushPayload?
        if let raw = record.payload, let data = raw.data(using: .utf8) {
            payload = try JSONDecoder().decode(SyncPushPayload.self, from: data)
        }
        return SyncPushOperation(
            opId: record.opId,
            entity: entity,
            type: type,
            uuid: record.targetUuid,
            issueUuid: record.issueUuid,
            baseUpdatedAt: record.baseUpdatedAt,
            payload: payload
        )
    }

    // MARK: - Pull

    /// Pulls the change feed from the stored cursor until `hasMore` is
    /// exhausted. Each page is applied in ONE transaction; the cursor
    /// advances in that same transaction, so page rows and cursor become
    /// visible atomically at commit.
    private func pullChanges() async throws -> Int {
        var pulled = 0
        while true {
            let since = try currentCursor()
            let page = try await transport.fetchChanges(since: since, limit: pullPageSize)
            if !page.changes.isEmpty {
                let applied: Int = try await database.dbWriter.write { db in
                    // Uuids with outbox rows keep their local state until
                    // pushed (sync-loop prevention).
                    let pendingUuids = try Set(String.fetchAll(
                        db,
                        sql: "SELECT DISTINCT target_uuid FROM pending_operations"
                    ))
                    let count = try SyncChangeApplier.apply(
                        page.changes,
                        skippingUuids: pendingUuids,
                        in: db
                    )
                    // Advance past everything in this page, including skipped
                    // entries — pending uuids re-converge on the pull that
                    // follows their push (the push bumps their server_seq).
                    let cursor = page.changes.map(\.serverSeq).max() ?? since
                    try db.execute(
                        sql: """
                            INSERT INTO sync_meta (key, value) VALUES (?, ?)
                            ON CONFLICT(key) DO UPDATE SET value = excluded.value
                            """,
                        arguments: [Self.lastServerSeqKey, String(cursor)]
                    )
                    return count
                }
                pulled += applied
            }
            if !page.hasMore { break }
        }
        return pulled
    }

    private func currentCursor() throws -> Int {
        guard let raw = try database.syncMetaValue(for: Self.lastServerSeqKey) else { return 0 }
        return Int(raw) ?? 0
    }
}

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
    private let syncMemberships: @Sendable () async throws -> Void
    private let refreshProjects: @Sendable () async throws -> Void
    private let pullPageSize: Int

    init(database: AppDatabase, transport: SyncTransport, pullPageSize: Int = 500,
         syncMemberships: @escaping @Sendable () async throws -> Void = {},
         refreshProjects: @escaping @Sendable () async throws -> Void = {}) {
        self.refreshProjects = refreshProjects
        self.syncMemberships = syncMemberships
        self.database = database
        self.transport = transport
        self.pullPageSize = pullPageSize
    }

    /// Pushes the outbox, then pulls the change feed until exhausted. Any
    /// transport error aborts the run (no retry within the same run — the
    /// scheduler triggers again later, which acts as the backoff).
    @discardableResult
    func syncNow(refreshProjectSnapshot: Bool = true) async -> SyncSummary {
        var summary = SyncSummary()
        do {
            let needsTaskSupport = try await database.dbWriter.read { db in
                try Bool.fetchOne(db, sql: "SELECT EXISTS (SELECT 1 FROM pending_operations WHERE state != 'review' AND (\(Self.extendedTaskWrite)))") ?? false
            }
            // Default to the legacy-safe subset when the queue only contains
            // compatible operations, including if a new Task arrives mid-sync.
            let supportsTaskWrites = needsTaskSupport ? try await transport.supportsTaskSyncWrites() : false
            while true {
                let push = try await pushOutbox(supportsTaskWrites: supportsTaskWrites)
                summary.pushedCount += push.resolved
                summary.conflictCopiedCount += push.conflictCopied
                if push.resolved < 500 { break }
            }
            summary.pulledCount = try await pullChanges()
            try await syncMemberships()
            if refreshProjectSnapshot { try await refreshProjects() }
        } catch {
            summary.errors.append(error.localizedDescription)
            logger.error("syncNow failed: \(error.localizedDescription, privacy: .public)")
        }
        summary.remainingOutboxCount = (try? await database.dbWriter.read { db in
            try Int.fetchOne(db, sql: "SELECT COUNT(*) FROM pending_operations WHERE state != 'review'") ?? 0
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

    // The basic Task create payload already worked for Standalone migration.
    // Older servers silently ignore these new attachments and reject status edits.
    private static let extendedTaskWrite = """
        entity = 'task' AND (
            op_type = 'update'
            OR coalesce(json_array_length(payload, '$.labels'), 0) > 0
            OR coalesce(json_array_length(payload, '$.projectIds'), 0) > 0
            OR coalesce(json_array_length(payload, '$.links'), 0) > 0
            OR coalesce(json_array_length(payload, '$.urlLinks'), 0) > 0
        )
        """

    /// Sends up to 500 operations in FIFO order. Returns the
    /// number of operations the server resolved (they leave the outbox) and
    /// how many of them produced a conflicted copy.
    private func pushOutbox(supportsTaskWrites: Bool) async throws -> (resolved: Int, conflictCopied: Int) {
        // Load every state: 'queued' is the normal case, 'failed' rows are
        // the ones this trigger retries, and 'inflight' rows are stale
        // leftovers from a crash mid-push — resending any of them is safe
        // because the server dedupes by opId.
        let ops: [PendingOperationRecord] = try await database.dbWriter.write { db in
            let records = try PendingOperationRecord.fetchAll(
                db,
                sql: """
                        WITH blocked_tasks AS (
                            SELECT target_uuid FROM pending_operations
                            WHERE NOT ? AND state != 'review' AND (\(Self.extendedTaskWrite))
                              AND op_type = 'create'
                        )
                        SELECT * FROM pending_operations
                        WHERE state != 'review' AND target_uuid NOT LIKE 'server-id:%'
                          AND (issue_uuid IS NULL OR issue_uuid NOT LIKE 'server-id:%')
                          AND (? OR (NOT (\(Self.extendedTaskWrite)) AND NOT EXISTS (
                              SELECT 1 FROM blocked_tasks
                              WHERE blocked_tasks.target_uuid = pending_operations.issue_uuid
                          )))
                        ORDER BY id LIMIT 500
                        """,
                arguments: [supportsTaskWrites, supportsTaskWrites]
            )
            for op in records {
                try db.execute(sql: "UPDATE pending_operations SET state = 'inflight' WHERE id = ?", arguments: [op.id])
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
                        if op.entity == "task", op.opType == "create" {
                            try db.execute(sql: """
                                INSERT OR IGNORE INTO project_items(project_id, issue_id)
                                SELECT value, ? FROM json_each(?, '$.projectIds')
                                """, arguments: [serverId, op.payload])
                            try db.execute(sql: "UPDATE issues SET memberships_known = 1 WHERE uuid = ?",
                                           arguments: [op.targetUuid])
                        }
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
                    let needsReview = op.entity == "task"
                        || (op.entity == "comment" && op.opType != "delete")
                        || (op.opType == "create" && (op.entity == "issue_label" || op.entity == "article"))
                    if needsReview {
                        try db.execute(sql: "UPDATE pending_operations SET state = 'review', review_reason = ? WHERE op_id = ?", arguments: [result.reason ?? (op.entity == "comment" ? "Parent is unavailable on the server." : "Server could not apply this change."), op.opId])
                        continue
                    }
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
                    // Resolve REST-cached identities in FIFO order as their change-feed
                    // entries arrive, keeping optimistic state until delivery.
                    try Self.resolveCachedIDs(page.changes, in: db)
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
            if !page.hasMore {
                if !database.hasCompletedPull { try database.setSyncMetaValue("1", for: "initial_pull_complete") }
                break
            }
        }
        return pulled
    }

    private static func resolveCachedIDs(_ changes: [SyncChange], in db: Database) throws {
        for change in changes where change.entity == .issue || change.entity == .comment {
            guard case let .number(value) = change.data["id"], let id = Int(exactly: value),
                  case let .string(uuid) = change.data["uuid"] else { continue }
            let placeholder = "server-id:\(id)"
            if change.entity == .issue {
                try db.execute(sql: "UPDATE issues SET uuid = ? WHERE uuid = ?", arguments: [uuid, placeholder])
                try db.execute(sql: "UPDATE issue_labels SET issue_uuid = ? WHERE issue_uuid = ?", arguments: [uuid, placeholder])
                try db.execute(sql: "UPDATE comments SET issue_uuid = ? WHERE issue_uuid = ?", arguments: [uuid, placeholder])
                try db.execute(sql: "UPDATE pending_operations SET issue_uuid = ? WHERE issue_uuid = ?", arguments: [uuid, placeholder])
                try db.execute(sql: "UPDATE pending_operations SET target_uuid = ? WHERE entity = 'task' AND target_uuid = ?", arguments: [uuid, placeholder])
            } else {
                try db.execute(sql: "UPDATE comments SET uuid = ? WHERE uuid = ?", arguments: [uuid, placeholder])
                try db.execute(sql: "UPDATE pending_operations SET target_uuid = ? WHERE entity = 'comment' AND target_uuid = ?", arguments: [uuid, placeholder])
            }
        }
    }

    private func currentCursor() throws -> Int {
        guard let raw = try database.syncMetaValue(for: Self.lastServerSeqKey) else { return 0 }
        return Int(raw) ?? 0
    }
}

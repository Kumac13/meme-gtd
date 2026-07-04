import CryptoKit
import Foundation
import GRDB
import os

private nonisolated let logger = Logger(subsystem: "name.kumac.MemeGTD", category: "MigrationService")

/// Progress of a running migration: operations acknowledged by the server so
/// far out of the total that will be pushed (local skips are not counted).
nonisolated struct MigrationProgress: Equatable, Sendable {
    var processed: Int
    var total: Int
}

/// One row that was NOT migrated. Either the client filtered it out during
/// planning (e.g. a task without a title, a comment whose parent issue is
/// deleted) or the server answered `skipped` with a reason. The row itself
/// stays in the local database — nothing is lost.
nonisolated struct MigrationSkip: Equatable, Sendable {
    /// Entity kind ("memo", "task", "article", "label", "issue_label",
    /// "comment", "link").
    let entity: String
    /// uuid or natural key of the row.
    let identifier: String
    let reason: String
}

/// Result of a fully successful migration run.
nonisolated struct MigrationSummary: Equatable, Sendable {
    /// Operations pushed to the server (excludes local planning skips).
    var totalOperations = 0
    var appliedCount = 0
    var alreadyAppliedCount = 0
    var skips: [MigrationSkip] = []
    var skippedCount: Int { skips.count }
}

nonisolated enum MigrationError: Error, LocalizedError {
    /// The server returned no verdict for an operation we sent (unexpected).
    case missingResult(opId: String)

    var errorDescription: String? {
        switch self {
        case .missingResult(let opId):
            return "The server did not return a result for operation \(opId)."
        }
    }
}

/// Seam for the final mode switch so unit tests never touch the real App
/// Group UserDefaults. Production flips Storage Mode to Server and turns
/// Offline Sync on (after a migration, "Server mode with offline sync" is the
/// natural state — subsequent edits keep syncing).
nonisolated protocol MigrationSettingsStore: Sendable {
    func commitServerMode()
}

nonisolated struct AppGroupMigrationSettingsStore: MigrationSettingsStore {
    func commitServerMode() {
        Settings.shared.appMode = .server
        Settings.shared.offlineSyncEnabled = true
    }
}

/// One-way Standalone -> Server bulk migration (offline support plan Phase
/// 12): pushes the entire local database to `POST /api/sync/push` and, only
/// after every page succeeded, switches the app to Server mode.
///
/// Guarantees:
/// - **Dependency order**: labels -> issues (memo/task/article) ->
///   issue_labels -> comments -> links, flattened into one FIFO stream. The
///   server applies operations in order, so a page boundary may fall anywhere
///   — the dependencies of page N+1 were already applied by page <= N.
/// - **Idempotent re-runs**: every opId is a deterministic function of the
///   row identity ("migrate-<entity>-<uuid or natural key>"). A re-run after
///   a failure replays the same opIds, so the server's opId ledger answers
///   `alreadyApplied`; rows pushed for the first time by the re-run are also
///   deduplicated by their natural key (uuid / name / pair). Both layers
///   together mean re-running never duplicates data.
/// - **All-or-nothing mode switch**: any transport error aborts the run
///   before the settings commit; the app stays Standalone and the user can
///   simply retry.
///
/// Not migrated by design: `url_links` — POST /api/sync/push has no entity
/// for them (syncSchemas.ts); the rows stay in the local database. Soft
/// deleted rows (is_deleted = 1) are not sent either: the server never knew
/// them, so there is nothing to tombstone.
actor MigrationService {
    /// Server-side maximum operations per push request (syncSchemas.ts).
    static let maxOperationsPerRequest = 500

    private let database: AppDatabase
    private let transport: SyncTransport
    private let settingsStore: MigrationSettingsStore
    private let pageSize: Int

    init(
        database: AppDatabase,
        transport: SyncTransport = APISyncTransport(),
        settingsStore: MigrationSettingsStore = AppGroupMigrationSettingsStore(),
        pageSize: Int = MigrationService.maxOperationsPerRequest
    ) {
        self.database = database
        self.transport = transport
        self.settingsStore = settingsStore
        self.pageSize = min(max(pageSize, 1), Self.maxOperationsPerRequest)
    }

    /// Runs the full migration. Throws on the first transport failure (the
    /// app stays Standalone; call again to retry from the start — idempotent,
    /// see the type comment). On success the settings are already committed
    /// to Server mode; the caller rebuilds the data sources.
    @discardableResult
    func migrate(
        onProgress: (@Sendable (MigrationProgress) -> Void)? = nil
    ) async throws -> MigrationSummary {
        let plan = try await buildPlan()
        var summary = MigrationSummary(totalOperations: plan.operations.count, skips: plan.skips)

        let total = plan.operations.count
        onProgress?(MigrationProgress(processed: 0, total: total))

        if total > 0 {
            let deviceId = try DeviceID.identifier(in: database)
            var processed = 0
            var latestSeq: Int?
            for page in Self.pages(of: plan.operations, size: pageSize) {
                let request = SyncPushRequest(
                    deviceId: deviceId,
                    operations: page.map(\.operation)
                )
                let response = try await transport.push(request)
                latestSeq = response.latestSeq
                try await record(results: response.results, for: page, into: &summary)
                processed += page.count
                onProgress?(MigrationProgress(processed: processed, total: total))
            }
            // Our own push produced these change-feed entries; starting the
            // pull cursor after them keeps the initial Server-mode sync from
            // re-downloading what we just uploaded.
            if let latestSeq {
                try database.setSyncMetaValue(String(latestSeq), for: SyncEngine.lastServerSeqKey)
            }
        }

        // Every page succeeded (or there was nothing to push): the migration
        // is complete, so this device is now a Server-mode client.
        settingsStore.commitServerMode()
        logger.info("migration done: total=\(summary.totalOperations), applied=\(summary.appliedCount), alreadyApplied=\(summary.alreadyAppliedCount), skipped=\(summary.skippedCount)")
        return summary
    }

    // MARK: - Planning

    /// Where to write the server identity a push result reports.
    private enum RecordTarget {
        case issue(uuid: String)
        case comment(uuid: String)
        case label(name: String)
        case link(uuid: String)
        case none
    }

    private struct PlannedOperation {
        let operation: SyncPushOperation
        let target: RecordTarget
    }

    private struct MigrationPlan {
        var operations: [PlannedOperation] = []
        var skips: [MigrationSkip] = []
    }

    /// Reads the whole local database and produces the FIFO operation stream
    /// in dependency order. Rows that can never satisfy the server's create
    /// validation (which would 400 the entire request) are filtered out here
    /// and reported as skips instead.
    private func buildPlan() async throws -> MigrationPlan {
        try await database.dbWriter.read { db in
            var plan = MigrationPlan()

            // 1. Labels (natural key: name).
            let labels = try LabelRecord.fetchAll(db, sql: "SELECT * FROM labels ORDER BY name")
            var migratedLabelNames = Set<String>()
            for label in labels {
                migratedLabelNames.insert(label.name)
                plan.operations.append(PlannedOperation(
                    operation: SyncPushOperation(
                        opId: Self.opId(entity: "label", key: label.name),
                        entity: .label,
                        type: .create,
                        uuid: Self.token(label.name),
                        issueUuid: nil,
                        baseUpdatedAt: nil,
                        payload: SyncPushPayload(
                            createdAt: label.createdAt,
                            name: label.name,
                            description: label.description
                        )
                    ),
                    target: .label(name: label.name)
                ))
            }

            // 2. Issues (memo / task / article), oldest first so the server
            // assigns ids in authoring order. Soft-deleted rows are not sent.
            let issues = try IssueRecord.fetchAll(
                db,
                sql: "SELECT * FROM issues WHERE is_deleted = 0 ORDER BY created_at, uuid"
            )
            var migratedIssueUuids = Set<String>()
            for issue in issues {
                let planned: PlannedOperation?
                switch issue.type {
                case "memo":
                    // The push schema requires a non-empty body for memo
                    // create (syncSchemas.ts).
                    guard !issue.bodyMd.isEmpty else {
                        plan.skips.append(MigrationSkip(
                            entity: "memo",
                            identifier: issue.uuid,
                            reason: "memo body is empty (the server requires a non-empty body)"
                        ))
                        planned = nil
                        break
                    }
                    planned = PlannedOperation(
                        operation: SyncPushOperation(
                            opId: Self.opId(entity: "memo", key: issue.uuid),
                            entity: .memo,
                            type: .create,
                            uuid: issue.uuid,
                            issueUuid: nil,
                            baseUpdatedAt: nil,
                            payload: SyncPushPayload(
                                bodyMd: issue.bodyMd,
                                isBookmarked: issue.isBookmarked,
                                createdAt: issue.createdAt
                            )
                        ),
                        target: .issue(uuid: issue.uuid)
                    )
                case "task":
                    guard let title = issue.title, !title.isEmpty else {
                        plan.skips.append(MigrationSkip(
                            entity: "task",
                            identifier: issue.uuid,
                            reason: "task title is missing (the server requires a title)"
                        ))
                        planned = nil
                        break
                    }
                    planned = PlannedOperation(
                        operation: SyncPushOperation(
                            opId: Self.opId(entity: "task", key: issue.uuid),
                            entity: .task,
                            type: .create,
                            uuid: issue.uuid,
                            issueUuid: nil,
                            baseUpdatedAt: nil,
                            payload: SyncPushPayload(
                                bodyMd: issue.bodyMd,
                                createdAt: issue.createdAt,
                                updatedAt: issue.updatedAt,
                                title: title,
                                status: issue.status,
                                taskKind: issue.taskKind,
                                scheduledStart: issue.scheduledStart,
                                scheduledEnd: issue.scheduledEnd,
                                isAllDay: issue.isAllDay,
                                scheduledOn: issue.scheduledOn,
                                actualStart: issue.actualStart,
                                actualEnd: issue.actualEnd
                            )
                        ),
                        target: .issue(uuid: issue.uuid)
                    )
                case "article":
                    let meta = LocalArticleStore.articleMeta(from: issue.meta)
                    guard let title = issue.title, !title.isEmpty,
                          let meta, !meta.originalUrl.isEmpty else {
                        plan.skips.append(MigrationSkip(
                            entity: "article",
                            identifier: issue.uuid,
                            reason: "article title or original URL is missing (the server requires both)"
                        ))
                        planned = nil
                        break
                    }
                    planned = PlannedOperation(
                        operation: SyncPushOperation(
                            opId: Self.opId(entity: "article", key: issue.uuid),
                            entity: .article,
                            type: .create,
                            uuid: issue.uuid,
                            issueUuid: nil,
                            baseUpdatedAt: nil,
                            payload: SyncPushPayload(
                                bodyMd: issue.bodyMd,
                                createdAt: issue.createdAt,
                                title: title,
                                meta: SyncPushArticleMeta(
                                    originalUrl: meta.originalUrl,
                                    siteName: meta.siteName,
                                    archivedAt: meta.archivedAt
                                )
                            )
                        ),
                        target: .issue(uuid: issue.uuid)
                    )
                default:
                    plan.skips.append(MigrationSkip(
                        entity: "issue",
                        identifier: issue.uuid,
                        reason: "unsupported issue type '\(issue.type)'"
                    ))
                    planned = nil
                }
                if let planned {
                    migratedIssueUuids.insert(issue.uuid)
                    plan.operations.append(planned)
                }
            }

            // 3. Issue-label assignments. Rows referencing an issue or label
            // that is not part of the migration would only come back as
            // server-side skips — filter them here with a clearer reason.
            let issueLabels = try IssueLabelRecord.fetchAll(
                db,
                sql: "SELECT * FROM issue_labels ORDER BY issue_uuid, label_name"
            )
            for issueLabel in issueLabels {
                let key = "\(issueLabel.issueUuid):\(issueLabel.labelName)"
                guard migratedIssueUuids.contains(issueLabel.issueUuid) else {
                    plan.skips.append(MigrationSkip(
                        entity: "issue_label",
                        identifier: key,
                        reason: "parent issue is deleted or not migrated"
                    ))
                    continue
                }
                guard migratedLabelNames.contains(issueLabel.labelName) else {
                    plan.skips.append(MigrationSkip(
                        entity: "issue_label",
                        identifier: key,
                        reason: "label does not exist locally"
                    ))
                    continue
                }
                plan.operations.append(PlannedOperation(
                    operation: SyncPushOperation(
                        opId: Self.opId(entity: "issue_label", key: key),
                        entity: .issueLabel,
                        type: .create,
                        uuid: Self.token(key),
                        issueUuid: nil,
                        baseUpdatedAt: nil,
                        payload: SyncPushPayload(
                            issueUuid: issueLabel.issueUuid,
                            labelName: issueLabel.labelName
                        )
                    ),
                    target: .none
                ))
            }

            // 4. Comments (entity 'comment', parent carried in issueUuid).
            let comments = try CommentRecord.fetchAll(
                db,
                sql: "SELECT * FROM comments WHERE is_deleted = 0 ORDER BY created_at, uuid"
            )
            for comment in comments {
                guard migratedIssueUuids.contains(comment.issueUuid) else {
                    plan.skips.append(MigrationSkip(
                        entity: "comment",
                        identifier: comment.uuid,
                        reason: "parent issue is deleted or not migrated"
                    ))
                    continue
                }
                guard !comment.bodyMd.isEmpty else {
                    plan.skips.append(MigrationSkip(
                        entity: "comment",
                        identifier: comment.uuid,
                        reason: "comment body is empty (the server requires a non-empty body)"
                    ))
                    continue
                }
                plan.operations.append(PlannedOperation(
                    operation: SyncPushOperation(
                        opId: Self.opId(entity: "comment", key: comment.uuid),
                        entity: .comment,
                        type: .create,
                        uuid: comment.uuid,
                        issueUuid: comment.issueUuid,
                        baseUpdatedAt: nil,
                        payload: SyncPushPayload(
                            bodyMd: comment.bodyMd,
                            createdAt: comment.createdAt
                        )
                    ),
                    target: .comment(uuid: comment.uuid)
                ))
            }

            // 5. Issue-to-issue links. (url_links are NOT migrated: the push
            // endpoint has no entity for them — see the type comment.)
            let links = try Row.fetchAll(
                db,
                sql: """
                    SELECT uuid, source_issue_uuid, target_issue_uuid, link_type
                    FROM links ORDER BY created_at, uuid
                    """
            )
            for link in links {
                let uuid: String = link["uuid"]
                let sourceUuid: String = link["source_issue_uuid"]
                let targetUuid: String = link["target_issue_uuid"]
                let linkType: String = link["link_type"]
                guard migratedIssueUuids.contains(sourceUuid),
                      migratedIssueUuids.contains(targetUuid) else {
                    plan.skips.append(MigrationSkip(
                        entity: "link",
                        identifier: uuid,
                        reason: "linked issue is deleted or not migrated"
                    ))
                    continue
                }
                plan.operations.append(PlannedOperation(
                    operation: SyncPushOperation(
                        opId: Self.opId(entity: "link", key: uuid),
                        entity: .link,
                        type: .create,
                        uuid: uuid,
                        issueUuid: nil,
                        baseUpdatedAt: nil,
                        payload: SyncPushPayload(
                            sourceIssueUuid: sourceUuid,
                            targetIssueUuid: targetUuid,
                            linkType: linkType
                        )
                    ),
                    target: .link(uuid: uuid)
                ))
            }

            return plan
        }
    }

    // MARK: - Result recording

    /// Stores the server identities a page's results report (same bookkeeping
    /// as SyncEngine's applied handling) and aggregates skip reasons.
    private func record(
        results: [SyncPushOperationResult],
        for page: [PlannedOperation],
        into summary: inout MigrationSummary
    ) async throws {
        let resultsByOpId = Dictionary(
            results.map { ($0.opId, $0) },
            uniquingKeysWith: { first, _ in first }
        )

        let outcome: (applied: Int, alreadyApplied: Int, skips: [MigrationSkip])
        outcome = try await database.dbWriter.write { db in
            var appliedCount = 0
            var alreadyAppliedCount = 0
            var skips: [MigrationSkip] = []
            for planned in page {
                let operation = planned.operation
                guard let result = resultsByOpId[operation.opId] else {
                    throw MigrationError.missingResult(opId: operation.opId)
                }
                switch result.status {
                case .applied, .alreadyApplied, .conflictCopied:
                    // conflictCopied cannot happen for create operations; it
                    // is grouped here so an unexpected verdict still records
                    // the server identity instead of losing it.
                    if result.status == .applied {
                        appliedCount += 1
                    } else {
                        alreadyAppliedCount += 1
                    }
                    switch planned.target {
                    case .issue(let uuid):
                        if let serverId = result.serverId {
                            try db.execute(
                                sql: "UPDATE issues SET server_id = ? WHERE uuid = ?",
                                arguments: [serverId, uuid]
                            )
                        }
                        if let updatedAt = result.updatedAt {
                            try db.execute(
                                sql: "UPDATE issues SET server_updated_at = ? WHERE uuid = ?",
                                arguments: [updatedAt, uuid]
                            )
                        }
                    case .comment(let uuid):
                        if let serverId = result.serverId {
                            try db.execute(
                                sql: "UPDATE comments SET server_id = ? WHERE uuid = ?",
                                arguments: [serverId, uuid]
                            )
                        }
                        if let updatedAt = result.updatedAt {
                            try db.execute(
                                sql: "UPDATE comments SET server_updated_at = ? WHERE uuid = ?",
                                arguments: [updatedAt, uuid]
                            )
                        }
                    case .label(let name):
                        if let serverId = result.serverId {
                            try db.execute(
                                sql: "UPDATE labels SET server_id = ? WHERE name = ?",
                                arguments: [serverId, name]
                            )
                        }
                    case .link(let uuid):
                        // OR IGNORE: two local rows can map to the same
                        // server link (symmetric 'relates' pair) and
                        // server_id is UNIQUE.
                        if let serverId = result.serverId {
                            try db.execute(
                                sql: "UPDATE OR IGNORE links SET server_id = ? WHERE uuid = ?",
                                arguments: [serverId, uuid]
                            )
                        }
                    case .none:
                        break
                    }
                case .skipped:
                    skips.append(MigrationSkip(
                        entity: operation.entity.rawValue,
                        identifier: operation.uuid,
                        reason: result.reason ?? "skipped by the server"
                    ))
                }
            }
            return (appliedCount, alreadyAppliedCount, skips)
        }

        summary.appliedCount += outcome.applied
        summary.alreadyAppliedCount += outcome.alreadyApplied
        summary.skips.append(contentsOf: outcome.skips)
    }

    // MARK: - Deterministic identifiers

    /// Deterministic idempotency key: the same row always produces the same
    /// opId, so a re-run after a failure replays into the server's opId
    /// ledger (alreadyApplied) instead of minting fresh keys.
    private static func opId(entity: String, key: String) -> String {
        token("migrate-\(entity)-\(key)")
    }

    /// Bounds a natural-key-derived identifier to the server's 128-char
    /// limit. Short keys (every UUID-based one) pass through untouched; an
    /// over-long key (labels have no name length limit) is replaced by its
    /// SHA-256 hex digest — still deterministic across re-runs.
    private static func token(_ raw: String) -> String {
        let maxLength = 128
        if raw.utf8.count <= maxLength { return raw }
        let digest = SHA256.hash(data: Data(raw.utf8))
        return "sha256-" + digest.map { String(format: "%02x", $0) }.joined()
    }

    private static func pages<T>(of items: [T], size: Int) -> [[T]] {
        stride(from: 0, to: items.count, by: size).map {
            Array(items[$0..<min($0 + size, items.count)])
        }
    }
}

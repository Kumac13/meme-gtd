import XCTest
import GRDB
@testable import MemeGTD

/// Transport double for the migration: scripted per-request responder,
/// recorded requests. `fetchChanges` is never used by the migration.
private final class MigrationMockTransport: SyncTransport, @unchecked Sendable {
    private let lock = NSLock()

    /// Called with (requestIndex, request); throw to simulate a network
    /// failure for that request.
    var pushResponder: (@Sendable (Int, SyncPushRequest) throws -> SyncPushResponse)?

    private(set) var pushedRequests: [SyncPushRequest] = []

    func fetchChanges(since: Int, limit: Int) async throws -> SyncChangesResponse {
        SyncChangesResponse(changes: [], latestSeq: since, hasMore: false)
    }

    func push(_ request: SyncPushRequest) async throws -> SyncPushResponse {
        lock.lock()
        defer { lock.unlock() }
        let index = pushedRequests.count
        pushedRequests.append(request)
        if let pushResponder {
            return try pushResponder(index, request)
        }
        // Distinct server-id ranges per request: issues.server_id is UNIQUE
        // locally, so colliding fake ids would abort the recording step.
        return Self.allApplied(request, latestSeq: index + 1, firstServerId: 100 + index * 1000)
    }

    /// Default verdict: every operation applied, serverId derived from the
    /// operation's position so ids are distinct and predictable.
    static func allApplied(
        _ request: SyncPushRequest,
        latestSeq: Int,
        firstServerId: Int = 100
    ) -> SyncPushResponse {
        SyncPushResponse(
            results: request.operations.enumerated().map { offset, op in
                SyncPushOperationResult(
                    opId: op.opId,
                    status: .applied,
                    uuid: op.uuid,
                    serverId: firstServerId + offset,
                    updatedAt: "2026-07-02T00:00:00.000Z",
                    conflictCopyUuid: nil
                )
            },
            latestSeq: latestSeq
        )
    }
}

/// Settings double: records the commit instead of touching the real App
/// Group UserDefaults (the migration must not flip the mode on failure).
private final class MockSettingsStore: MigrationSettingsStore, @unchecked Sendable {
    private let lock = NSLock()
    private var _commitCount = 0

    var commitCount: Int {
        lock.lock()
        defer { lock.unlock() }
        return _commitCount
    }

    func commitServerMode() {
        lock.lock()
        defer { lock.unlock() }
        _commitCount += 1
    }
}

private enum TestTransportError: Error {
    case offline
}

/// Thread-safe accumulator for progress callbacks (they arrive off the main
/// actor).
private final class ProgressCollector: @unchecked Sendable {
    private let lock = NSLock()
    private var updates: [MigrationProgress] = []

    func append(_ progress: MigrationProgress) {
        lock.lock()
        updates.append(progress)
        lock.unlock()
    }

    var all: [MigrationProgress] {
        lock.lock()
        defer { lock.unlock() }
        return updates
    }
}

final class MigrationServiceTests: XCTestCase {
    private var database: AppDatabase!
    private var transport: MigrationMockTransport!
    private var settingsStore: MockSettingsStore!

    override func setUpWithError() throws {
        database = try AppDatabase.makeInMemory()
        transport = MigrationMockTransport()
        settingsStore = MockSettingsStore()
    }

    private func makeService(pageSize: Int = MigrationService.maxOperationsPerRequest) -> MigrationService {
        MigrationService(
            database: database,
            transport: transport,
            settingsStore: settingsStore,
            pageSize: pageSize
        )
    }

    // MARK: - Seeding helpers

    private func insertLabel(name: String, description: String? = nil) async throws {
        try await database.dbWriter.write { db in
            try LabelRecord(
                name: name,
                serverId: nil,
                description: description,
                createdAt: "2026-06-01T00:00:00.000Z"
            ).insert(db)
        }
    }

    private func insertMemo(
        uuid: String,
        body: String,
        bookmarked: Bool = false,
        deleted: Bool = false,
        createdAt: String = "2026-06-02T00:00:00.000Z"
    ) async throws {
        try await database.dbWriter.write { db in
            try IssueRecord(
                uuid: uuid,
                serverId: nil,
                type: "memo",
                title: nil,
                bodyMd: body,
                isBookmarked: bookmarked,
                isDeleted: deleted,
                createdAt: createdAt,
                updatedAt: createdAt
            ).insert(db)
        }
    }

    private func insertTask(
        uuid: String,
        title: String?,
        body: String = "",
        status: String = "inbox",
        createdAt: String = "2026-06-03T00:00:00.000Z"
    ) async throws {
        try await database.dbWriter.write { db in
            try IssueRecord(
                uuid: uuid,
                serverId: nil,
                type: "task",
                title: title,
                bodyMd: body,
                status: status,
                actualStart: "2026-06-03T09:00:00",
                taskKind: "action",
                createdAt: createdAt,
                updatedAt: createdAt
            ).insert(db)
        }
    }

    private func insertArticle(
        uuid: String,
        title: String = "An article",
        originalUrl: String? = "https://example.com/a",
        createdAt: String = "2026-06-04T00:00:00.000Z"
    ) async throws {
        let meta = originalUrl.map { url in
            "{\"archivedAt\":\"\(createdAt)\",\"originalUrl\":\"\(url)\",\"siteName\":\"Example\"}"
        }
        try await database.dbWriter.write { db in
            try IssueRecord(
                uuid: uuid,
                serverId: nil,
                type: "article",
                title: title,
                bodyMd: "# content",
                meta: meta,
                createdAt: createdAt,
                updatedAt: createdAt
            ).insert(db)
        }
    }

    private func insertIssueLabel(issueUuid: String, labelName: String) async throws {
        try await database.dbWriter.write { db in
            try IssueLabelRecord(issueUuid: issueUuid, labelName: labelName).insert(db)
        }
    }

    private func insertComment(
        uuid: String,
        issueUuid: String,
        body: String,
        deleted: Bool = false
    ) async throws {
        try await database.dbWriter.write { db in
            try CommentRecord(
                uuid: uuid,
                serverId: nil,
                issueUuid: issueUuid,
                bodyMd: body,
                createdAt: "2026-06-05T00:00:00.000Z",
                updatedAt: "2026-06-05T00:00:00.000Z",
                isDeleted: deleted
            ).insert(db)
        }
    }

    private func insertLink(
        uuid: String,
        sourceUuid: String,
        targetUuid: String,
        type: String = "relates"
    ) async throws {
        try await database.dbWriter.write { db in
            try db.execute(
                sql: """
                    INSERT INTO links (uuid, source_issue_uuid, target_issue_uuid, link_type, created_at)
                    VALUES (?, ?, ?, ?, ?)
                    """,
                arguments: [uuid, sourceUuid, targetUuid, type, "2026-06-06T00:00:00.000Z"]
            )
        }
    }

    private func insertUrlLink(uuid: String, issueUuid: String) async throws {
        try await database.dbWriter.write { db in
            try db.execute(
                sql: """
                    INSERT INTO url_links (uuid, issue_uuid, url, title, created_at)
                    VALUES (?, ?, 'https://example.com/ref', 'Ref', '2026-06-06T00:00:00.000Z')
                    """,
                arguments: [uuid, issueUuid]
            )
        }
    }

    /// The standard fixture: one of everything, plus a deleted memo whose
    /// dependents must not be sent, plus a url_link (never migratable).
    private func seedFullFixture() async throws {
        try await insertLabel(name: "alpha", description: "first label")
        try await insertMemo(uuid: "memo-1", body: "memo body", bookmarked: true)
        try await insertTask(uuid: "task-1", title: "A task", body: "task body")
        try await insertArticle(uuid: "article-1")
        try await insertMemo(uuid: "memo-deleted", body: "gone", deleted: true)
        try await insertIssueLabel(issueUuid: "task-1", labelName: "alpha")
        try await insertIssueLabel(issueUuid: "memo-deleted", labelName: "alpha")
        try await insertComment(uuid: "comment-1", issueUuid: "memo-1", body: "a comment")
        try await insertComment(uuid: "comment-orphan", issueUuid: "memo-deleted", body: "orphan")
        try await insertLink(uuid: "link-1", sourceUuid: "memo-1", targetUuid: "task-1")
        try await insertLink(uuid: "link-orphan", sourceUuid: "memo-deleted", targetUuid: "task-1")
        try await insertUrlLink(uuid: "url-link-1", issueUuid: "memo-1")
    }

    // MARK: - Dependency order and completeness

    func testMigratesEverythingInDependencyOrderExcludingDeletedRows() async throws {
        try await seedFullFixture()

        let summary = try await makeService().migrate()

        XCTAssertEqual(transport.pushedRequests.count, 1)
        let ops = transport.pushedRequests[0].operations

        // label + memo + task + article + issue_label + comment + link
        XCTAssertEqual(ops.count, 7)
        XCTAssertEqual(summary.totalOperations, 7)
        XCTAssertEqual(summary.appliedCount, 7)

        // Deleted rows and url_links never leave the device.
        XCTAssertFalse(ops.contains { $0.uuid.contains("memo-deleted") })
        XCTAssertFalse(ops.contains { $0.uuid.contains("url-link") })

        // Dependency tiers: labels < issues < issue_labels/comments < links.
        func tier(_ entity: SyncPushEntity) -> Int {
            switch entity {
            case .label: return 0
            case .memo, .task, .article: return 1
            case .issueLabel: return 2
            case .comment: return 3
            case .link: return 4
            }
        }
        let tiers = ops.map { tier($0.entity) }
        XCTAssertEqual(tiers, tiers.sorted(), "operations must arrive in dependency order")

        // The comment carries its parent issue uuid.
        let comment = ops.first { $0.entity == .comment }
        XCTAssertEqual(comment?.issueUuid, "memo-1")
        XCTAssertEqual(comment?.payload?.bodyMd, "a comment")

        // Payload spot checks.
        let memo = ops.first { $0.entity == .memo }
        XCTAssertEqual(memo?.payload?.isBookmarked, true)
        let task = ops.first { $0.entity == .task }
        XCTAssertEqual(task?.payload?.title, "A task")
        XCTAssertEqual(task?.payload?.actualStart, "2026-06-03T09:00:00")
        let article = ops.first { $0.entity == .article }
        XCTAssertEqual(article?.payload?.meta?.originalUrl, "https://example.com/a")
        let label = ops.first { $0.entity == .label }
        XCTAssertEqual(label?.payload?.name, "alpha")
        let link = ops.first { $0.entity == .link }
        XCTAssertEqual(link?.payload?.sourceIssueUuid, "memo-1")
        XCTAssertEqual(link?.payload?.targetIssueUuid, "task-1")
        XCTAssertEqual(link?.payload?.linkType, "relates")

        // Deterministic opIds: a function of the row identity alone.
        XCTAssertEqual(memo?.opId, "migrate-memo-memo-1")
        XCTAssertEqual(label?.opId, "migrate-label-alpha")
        XCTAssertEqual(ops.first { $0.entity == .issueLabel }?.opId, "migrate-issue_label-task-1:alpha")

        // Dependents of the deleted memo were skipped locally, with reasons.
        XCTAssertEqual(summary.skippedCount, 3)
        XCTAssertTrue(summary.skips.contains { $0.entity == "issue_label" && $0.identifier == "memo-deleted:alpha" })
        XCTAssertTrue(summary.skips.contains { $0.entity == "comment" && $0.identifier == "comment-orphan" })
        XCTAssertTrue(summary.skips.contains { $0.entity == "link" && $0.identifier == "link-orphan" })

        XCTAssertEqual(settingsStore.commitCount, 1)
    }

    // MARK: - Server identity and cursor recording

    func testRecordsServerIdsUpdatedAtAndCursor() async throws {
        try await seedFullFixture()
        transport.pushResponder = { _, request in
            MigrationMockTransport.allApplied(request, latestSeq: 42, firstServerId: 500)
        }

        _ = try await makeService().migrate()

        let row = try await database.dbWriter.read { db in
            (
                memoServerId: try Int.fetchOne(db, sql: "SELECT server_id FROM issues WHERE uuid = 'memo-1'"),
                memoUpdatedAt: try String.fetchOne(db, sql: "SELECT server_updated_at FROM issues WHERE uuid = 'memo-1'"),
                taskServerId: try Int.fetchOne(db, sql: "SELECT server_id FROM issues WHERE uuid = 'task-1'"),
                labelServerId: try Int.fetchOne(db, sql: "SELECT server_id FROM labels WHERE name = 'alpha'"),
                commentServerId: try Int.fetchOne(db, sql: "SELECT server_id FROM comments WHERE uuid = 'comment-1'"),
                linkServerId: try Int.fetchOne(db, sql: "SELECT server_id FROM links WHERE uuid = 'link-1'")
            )
        }
        XCTAssertNotNil(row.memoServerId)
        XCTAssertEqual(row.memoUpdatedAt, "2026-07-02T00:00:00.000Z")
        XCTAssertNotNil(row.taskServerId)
        XCTAssertNotNil(row.labelServerId)
        XCTAssertNotNil(row.commentServerId)
        XCTAssertNotNil(row.linkServerId)

        let cursor = try database.syncMetaValue(for: SyncEngine.lastServerSeqKey)
        XCTAssertEqual(cursor, "42")
        XCTAssertEqual(settingsStore.commitCount, 1)
    }

    // MARK: - Pagination and partial failure

    func testPartialFailureKeepsStandaloneAndRerunReplaysSameOpIds() async throws {
        // Three memos with pageSize 2 -> two pages.
        try await insertMemo(uuid: "memo-a", body: "a", createdAt: "2026-06-01T00:00:00.000Z")
        try await insertMemo(uuid: "memo-b", body: "b", createdAt: "2026-06-02T00:00:00.000Z")
        try await insertMemo(uuid: "memo-c", body: "c", createdAt: "2026-06-03T00:00:00.000Z")

        transport.pushResponder = { index, request in
            if index == 1 { throw TestTransportError.offline }
            return MigrationMockTransport.allApplied(request, latestSeq: 10)
        }

        let service = makeService(pageSize: 2)
        do {
            _ = try await service.migrate()
            XCTFail("The second page fails, so migrate() must throw")
        } catch {
            // expected
        }

        // The mode never flipped and the cursor was never written.
        XCTAssertEqual(settingsStore.commitCount, 0)
        XCTAssertNil(try database.syncMetaValue(for: SyncEngine.lastServerSeqKey))
        XCTAssertEqual(transport.pushedRequests.count, 2)
        XCTAssertEqual(transport.pushedRequests[0].operations.count, 2)

        // Re-run: same deterministic opIds, so the server ledger and natural
        // keys both dedupe the first page's rows.
        transport.pushResponder = { index, request in
            MigrationMockTransport.allApplied(request, latestSeq: 20, firstServerId: 100 + index * 10)
        }
        let progressCollector = ProgressCollector()
        let summary = try await service.migrate { progress in
            progressCollector.append(progress)
        }

        XCTAssertEqual(transport.pushedRequests.count, 4)
        XCTAssertEqual(
            transport.pushedRequests[2].operations.map(\.opId),
            transport.pushedRequests[0].operations.map(\.opId),
            "a re-run must replay the exact same opIds"
        )
        XCTAssertEqual(
            transport.pushedRequests[2].operations.map(\.opId) + transport.pushedRequests[3].operations.map(\.opId),
            ["migrate-memo-memo-a", "migrate-memo-memo-b", "migrate-memo-memo-c"]
        )
        XCTAssertEqual(summary.appliedCount, 3)
        XCTAssertEqual(settingsStore.commitCount, 1)
        XCTAssertEqual(try database.syncMetaValue(for: SyncEngine.lastServerSeqKey), "20")

        XCTAssertEqual(progressCollector.all, [
            MigrationProgress(processed: 0, total: 3),
            MigrationProgress(processed: 2, total: 3),
            MigrationProgress(processed: 3, total: 3),
        ])
    }

    // MARK: - Skip aggregation

    func testAggregatesServerSkipsAndLocalValidationSkips() async throws {
        try await insertLabel(name: "alpha")
        try await insertMemo(uuid: "memo-1", body: "fine")
        // Local validation skips: a task without a title and an article
        // without an original URL would 400 the whole request server-side.
        try await insertTask(uuid: "task-untitled", title: nil)
        try await insertArticle(uuid: "article-no-url", originalUrl: nil)
        try await insertIssueLabel(issueUuid: "memo-1", labelName: "alpha")

        // The server skips the issue_label (e.g. race: label vanished).
        transport.pushResponder = { _, request in
            SyncPushResponse(
                results: request.operations.enumerated().map { offset, op in
                    if op.entity == .issueLabel {
                        return SyncPushOperationResult(
                            opId: op.opId,
                            status: .skipped,
                            uuid: op.uuid,
                            serverId: nil,
                            updatedAt: nil,
                            conflictCopyUuid: nil,
                            reason: "label not found for name alpha"
                        )
                    }
                    return SyncPushOperationResult(
                        opId: op.opId,
                        status: .applied,
                        uuid: op.uuid,
                        serverId: 300 + offset,
                        updatedAt: nil,
                        conflictCopyUuid: nil
                    )
                },
                latestSeq: 7
            )
        }

        let summary = try await makeService().migrate()

        // Sent: label + memo + issue_label (task and article filtered out).
        XCTAssertEqual(summary.totalOperations, 3)
        XCTAssertEqual(summary.appliedCount, 2)
        XCTAssertEqual(summary.skippedCount, 3)
        XCTAssertTrue(summary.skips.contains {
            $0.entity == "task" && $0.identifier == "task-untitled" && $0.reason.contains("title")
        })
        XCTAssertTrue(summary.skips.contains {
            $0.entity == "article" && $0.identifier == "article-no-url"
        })
        XCTAssertTrue(summary.skips.contains {
            $0.entity == "issue_label" && $0.reason == "label not found for name alpha"
        })

        // Skipped rows stay in the local database untouched.
        let localCounts = try await database.dbWriter.read { db in
            (
                issues: try Int.fetchOne(db, sql: "SELECT COUNT(*) FROM issues") ?? -1,
                unsyncedTask: try Int.fetchOne(
                    db,
                    sql: "SELECT COUNT(*) FROM issues WHERE uuid = 'task-untitled' AND server_id IS NULL"
                ) ?? -1
            )
        }
        XCTAssertEqual(localCounts.issues, 3)
        XCTAssertEqual(localCounts.unsyncedTask, 1)

        // A successful run still commits Server mode even with skips: the
        // skipped rows can never migrate, and re-running would not help.
        XCTAssertEqual(settingsStore.commitCount, 1)
    }

    // MARK: - alreadyApplied re-runs

    func testAlreadyAppliedResultsStillRecordServerIdentity() async throws {
        try await insertMemo(uuid: "memo-1", body: "again")
        transport.pushResponder = { _, request in
            SyncPushResponse(
                results: request.operations.map { op in
                    SyncPushOperationResult(
                        opId: op.opId,
                        status: .alreadyApplied,
                        uuid: op.uuid,
                        serverId: 77,
                        updatedAt: "2026-07-01T00:00:00.000Z",
                        conflictCopyUuid: nil
                    )
                },
                latestSeq: 5
            )
        }

        let summary = try await makeService().migrate()
        XCTAssertEqual(summary.appliedCount, 0)
        XCTAssertEqual(summary.alreadyAppliedCount, 1)

        let serverId = try await database.dbWriter.read { db in
            try Int.fetchOne(db, sql: "SELECT server_id FROM issues WHERE uuid = 'memo-1'")
        }
        XCTAssertEqual(serverId, 77)
    }

    // MARK: - Empty database

    func testEmptyDatabasePushesNothingAndStillCommits() async throws {
        let summary = try await makeService().migrate()
        XCTAssertEqual(summary.totalOperations, 0)
        XCTAssertTrue(transport.pushedRequests.isEmpty)
        // No push means no latestSeq: the cursor stays unset so the initial
        // Server-mode pull starts from 0.
        XCTAssertNil(try database.syncMetaValue(for: SyncEngine.lastServerSeqKey))
        XCTAssertEqual(settingsStore.commitCount, 1)
    }
}

import XCTest
import GRDB
@testable import MemeGTD

/// In-memory transport double. Push results and change pages are scripted per
/// test; requests are recorded for assertions.
private final class MockTransport: SyncTransport, @unchecked Sendable {
    private let lock = NSLock()

    var changePages: [SyncChangesResponse] = []
    var pushResponder: (@Sendable (SyncPushRequest) -> SyncPushResponse)?
    var pushError: Error?

    private(set) var pushedRequests: [SyncPushRequest] = []
    private(set) var fetchedSinces: [Int] = []

    func fetchChanges(since: Int, limit: Int) async throws -> SyncChangesResponse {
        lock.lock()
        defer { lock.unlock() }
        fetchedSinces.append(since)
        if changePages.isEmpty {
            return SyncChangesResponse(changes: [], latestSeq: since, hasMore: false)
        }
        return changePages.removeFirst()
    }

    func push(_ request: SyncPushRequest) async throws -> SyncPushResponse {
        lock.lock()
        defer { lock.unlock() }
        if let pushError { throw pushError }
        pushedRequests.append(request)
        let responder = pushResponder ?? { request in
            SyncPushResponse(
                results: request.operations.map {
                    SyncPushOperationResult(
                        opId: $0.opId,
                        status: .applied,
                        uuid: $0.uuid,
                        serverId: 100,
                        updatedAt: "2026-07-02T00:00:00.000Z",
                        conflictCopyUuid: nil
                    )
                },
                latestSeq: 1
            )
        }
        return responder(request)
    }
}

private enum TestTransportError: Error {
    case offline
}

final class SyncEngineTests: XCTestCase {
    private var database: AppDatabase!
    private var transport: MockTransport!
    private var engine: SyncEngine!
    private var dataSource: OfflineFirstMemoDataSource!

    override func setUpWithError() throws {
        database = try AppDatabase.makeInMemory()
        transport = MockTransport()
        engine = SyncEngine(database: database, transport: transport)
        dataSource = OfflineFirstMemoDataSource(
            database: database,
            remote: UnreachableRemote()
        )
    }

    // MARK: - Outbox behavior (writes through the offline-first data source)

    func testWritesEnqueueInFIFOOrderAndUpdatesMerge() async throws {
        let memo = try await dataSource.createMemo(CreateMemoRequest(bodyMd: "first"))
        _ = try await dataSource.createMemo(CreateMemoRequest(bodyMd: "second"))

        // Two queued creates, FIFO by id
        var ops = try await database.dbWriter.read { db in
            try PendingOperationRecord.fetchAll(db, sql: "SELECT * FROM pending_operations ORDER BY id")
        }
        XCTAssertEqual(ops.map(\.opType), ["create", "create"])

        // An edit to the first memo merges into its queued create instead of
        // enqueuing a separate update (the server then sees one create with
        // the final body).
        _ = try await dataSource.updateMemo(id: memo.id, UpdateMemoRequest(bodyMd: "first edited", isBookmarked: nil))
        ops = try await database.dbWriter.read { db in
            try PendingOperationRecord.fetchAll(db, sql: "SELECT * FROM pending_operations ORDER BY id")
        }
        XCTAssertEqual(ops.count, 2)
        XCTAssertTrue(ops[0].payload?.contains("first edited") == true)
    }

    func testQueuedCreatePlusDeleteCancelBothOut() async throws {
        let memo = try await dataSource.createMemo(CreateMemoRequest(bodyMd: "ephemeral"))
        try await dataSource.deleteMemo(id: memo.id)

        let opCount = try await database.dbWriter.read { db in
            try Int.fetchOne(db, sql: "SELECT COUNT(*) FROM pending_operations") ?? -1
        }
        XCTAssertEqual(opCount, 0)

        let rowCount = try await database.dbWriter.read { db in
            try Int.fetchOne(db, sql: "SELECT COUNT(*) FROM issues") ?? -1
        }
        XCTAssertEqual(rowCount, 0, "The memo never reached the server, so nothing should remain")
    }

    // MARK: - Push result handling

    func testAppliedPushClearsOutboxAndStoresServerIdentity() async throws {
        let memo = try await dataSource.createMemo(CreateMemoRequest(bodyMd: "to push"))
        XCTAssertLessThan(memo.id, 0, "Unsynced rows surface negative local ids")

        transport.pushResponder = { request in
            SyncPushResponse(
                results: request.operations.map {
                    SyncPushOperationResult(
                        opId: $0.opId,
                        status: .applied,
                        uuid: $0.uuid,
                        serverId: 42,
                        updatedAt: "2026-07-02T05:00:00.000Z",
                        conflictCopyUuid: nil
                    )
                },
                latestSeq: 10
            )
        }

        let summary = await engine.syncNow()
        XCTAssertEqual(summary.pushedCount, 1)
        XCTAssertTrue(summary.errors.isEmpty)

        let row = try await database.dbWriter.read { db in
            try Row.fetchOne(db, sql: "SELECT server_id, server_updated_at FROM issues")
        }
        XCTAssertEqual(row?["server_id"], 42)
        XCTAssertEqual(row?["server_updated_at"], "2026-07-02T05:00:00.000Z")

        let opCount = try await database.dbWriter.read { db in
            try Int.fetchOne(db, sql: "SELECT COUNT(*) FROM pending_operations") ?? -1
        }
        XCTAssertEqual(opCount, 0)
    }

    func testTransportFailureMarksOpsFailedAndIncrementsRetry() async throws {
        _ = try await dataSource.createMemo(CreateMemoRequest(bodyMd: "unreachable"))
        transport.pushError = TestTransportError.offline

        let summary = await engine.syncNow()
        XCTAssertEqual(summary.pushedCount, 0)
        XCTAssertFalse(summary.errors.isEmpty)

        let op = try await database.dbWriter.read { db in
            try PendingOperationRecord.fetchOne(db, sql: "SELECT * FROM pending_operations")
        }
        XCTAssertEqual(op?.state, "failed")
        XCTAssertEqual(op?.retryCount, 1)

        // The next run (connectivity back) retries the failed op.
        transport.pushError = nil
        let retry = await engine.syncNow()
        XCTAssertEqual(retry.pushedCount, 1)
    }

    // MARK: - Pull

    private func issueChange(seq: Int, uuid: String, type: String = "memo", body: String, deleted: Bool = false) -> SyncChange {
        SyncChange(
            serverSeq: seq,
            entity: .issue,
            op: .upsert,
            data: [
                "id": .number(Double(seq)),
                "uuid": .string(uuid),
                "type": .string(type),
                "bodyMd": .string(body),
                "isBookmarked": .bool(false),
                "isDeleted": .bool(deleted),
                "createdAt": .string("2026-07-01T00:00:00.000Z"),
                "updatedAt": .string("2026-07-01T00:00:00.000Z"),
            ]
        )
    }

    func testPullAppliesPagesAndAdvancesCursor() async throws {
        transport.changePages = [
            SyncChangesResponse(
                changes: [
                    issueChange(seq: 1, uuid: "u-1", body: "memo one"),
                    issueChange(seq: 2, uuid: "u-2", type: "task", body: "task row"),
                ],
                latestSeq: 3,
                hasMore: true
            ),
            SyncChangesResponse(
                changes: [issueChange(seq: 3, uuid: "u-3", body: "memo three")],
                latestSeq: 3,
                hasMore: false
            ),
        ]

        let summary = await engine.syncNow()
        XCTAssertEqual(summary.pulledCount, 3)
        XCTAssertEqual(transport.fetchedSinces, [0, 2], "Second page resumes from the first page's max serverSeq")

        let counts = try await database.dbWriter.read { db in
            (
                memos: try Int.fetchOne(db, sql: "SELECT COUNT(*) FROM issues WHERE type = 'memo'") ?? -1,
                tasks: try Int.fetchOne(db, sql: "SELECT COUNT(*) FROM issues WHERE type = 'task'") ?? -1
            )
        }
        XCTAssertEqual(counts.memos, 2)
        XCTAssertEqual(counts.tasks, 1, "task rows are stored as-is (Phase 7 read cache seed)")

        let cursor = try database.syncMetaValue(for: SyncEngine.lastServerSeqKey)
        XCTAssertEqual(cursor, "3")
    }

    func testPullSkipsUuidsWithPendingOperations() async throws {
        let memo = try await dataSource.createMemo(CreateMemoRequest(bodyMd: "local intent"))
        let uuid = try await database.dbWriter.read { db in
            try String.fetchOne(db, sql: "SELECT uuid FROM issues") ?? ""
        }
        XCTAssertLessThan(memo.id, 0)

        // Make push fail so the outbox row survives into the pull phase.
        transport.pushError = TestTransportError.offline
        _ = await engine.syncNow()

        // A remote change for the same uuid must NOT clobber local intent.
        transport.pushError = nil
        transport.pushResponder = { request in
            SyncPushResponse(results: [], latestSeq: 5) // no verdicts: op stays
        }
        transport.changePages = [
            SyncChangesResponse(
                changes: [issueChange(seq: 5, uuid: uuid, body: "remote clobber")],
                latestSeq: 5,
                hasMore: false
            ),
        ]
        _ = await engine.syncNow()

        let body = try await database.dbWriter.read { db in
            try String.fetchOne(db, sql: "SELECT body_md FROM issues WHERE uuid = ?", arguments: [uuid])
        }
        XCTAssertEqual(body, "local intent")
    }

    // MARK: - Offline-first list reads

    func testListMemosHonorsBookmarkAndSearchFilters() async throws {
        let plain = try await dataSource.createMemo(CreateMemoRequest(bodyMd: "plain haystack memo"))
        let bookmarked = try await dataSource.createMemo(CreateMemoRequest(bodyMd: "needle memo"))
        _ = try await dataSource.updateMemo(id: bookmarked.id, UpdateMemoRequest(bodyMd: nil, isBookmarked: true))

        let bookmarkedPage = try await dataSource.listMemos(queryItems: [
            URLQueryItem(name: "bookmarked", value: "true"),
        ])
        XCTAssertEqual(bookmarkedPage.data.map(\.id), [bookmarked.id])

        let searchPage = try await dataSource.listMemos(queryItems: [
            URLQueryItem(name: "search", value: "haystack"),
        ])
        XCTAssertEqual(searchPage.data.map(\.id), [plain.id])
        XCTAssertEqual(searchPage.total, 1)
    }

    // MARK: - Retry after failed runs

    func testSummaryReportsRemainingOutboxAfterTransportFailure() async throws {
        _ = try await dataSource.createMemo(CreateMemoRequest(bodyMd: "stranded"))
        transport.pushError = TestTransportError.offline

        let failed = await engine.syncNow()
        XCTAssertEqual(failed.remainingOutboxCount, 1)
        XCTAssertFalse(failed.errors.isEmpty)

        transport.pushError = nil
        let recovered = await engine.syncNow()
        XCTAssertEqual(recovered.remainingOutboxCount, 0)
        XCTAssertTrue(recovered.errors.isEmpty)
        XCTAssertEqual(recovered.pushedCount, 1)
    }

    /// The regression behind the "offline memo never reached the server" bug:
    /// a push that fails right after connectivity returns (e.g. the VPN
    /// tunnel is not up yet) must retry on its own — no further external
    /// trigger arrives while the user stays on one screen.
    @MainActor
    func testSchedulerRetriesWithBackoffUntilOutboxDrains() async throws {
        _ = try await dataSource.createMemo(CreateMemoRequest(bodyMd: "retry me"))
        transport.pushError = TestTransportError.offline

        let scheduler = SyncScheduler(engine: engine, retryDelays: [0.05])
        scheduler.requestSync()

        // Wait for the first run to fail (its op transitions to 'failed').
        try await pollUntil("first run marks the op failed") { [database] in
            try await database!.dbWriter.read { db in
                try Int.fetchOne(
                    db,
                    sql: "SELECT COUNT(*) FROM pending_operations WHERE state = 'failed'"
                ) ?? 0
            } > 0
        }

        // Server becomes reachable; the scheduled retry must drain the outbox
        // without any external trigger.
        transport.pushError = nil
        try await pollUntil("retry drains the outbox") { [database] in
            try await database!.dbWriter.read { db in
                try Int.fetchOne(db, sql: "SELECT COUNT(*) FROM pending_operations") ?? -1
            } == 0
        }
    }

    /// Polls the condition every 50ms for up to 5s.
    private func pollUntil(
        _ what: String,
        _ condition: () async throws -> Bool
    ) async throws {
        for _ in 0..<100 {
            if try await condition() { return }
            try await Task.sleep(nanoseconds: 50_000_000)
        }
        XCTFail("Timed out waiting for: \(what)")
    }
}

/// Remote stub that fails every call: guarantees the offline paths under test
/// never silently fall back to the network.
private struct UnreachableRemote: MemoDataSource {
    struct Unreachable: Error {}
    func listMemos(queryItems: [URLQueryItem]) async throws -> MemoListResponse { throw Unreachable() }
    func getMemo(id: Int) async throws -> Memo { throw Unreachable() }
    func createMemo(_ request: CreateMemoRequest) async throws -> Memo { throw Unreachable() }
    func updateMemo(id: Int, _ request: UpdateMemoRequest) async throws -> Memo { throw Unreachable() }
    func deleteMemo(id: Int) async throws { throw Unreachable() }
    func bookmarkMemo(id: Int) async throws -> Memo { throw Unreachable() }
    func unbookmarkMemo(id: Int) async throws -> Memo { throw Unreachable() }
    func promotePreview(memoId: Int) async throws -> PromotePreviewResponse { throw Unreachable() }
    func listComments(memoId: Int) async throws -> [Comment] { throw Unreachable() }
    func createComment(memoId: Int, _ request: CreateCommentRequest) async throws -> Comment { throw Unreachable() }
    func updateComment(memoId: Int, commentId: Int, _ request: UpdateCommentRequest) async throws -> Comment { throw Unreachable() }
    func deleteComment(memoId: Int, commentId: Int) async throws { throw Unreachable() }
}

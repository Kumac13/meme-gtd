import XCTest
import GRDB
@testable import MemeGTD

/// Phase 6 coverage: conflict handling (conflictCopied / skipped) and the
/// offline comment write path (local `comments` table + outbox).
/// Same doubles as SyncEngineTests: in-memory GRDB + scripted MockTransport +
/// a remote stub that fails every call.
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
                        serverId: $0.entity == .memo ? 100 : 200,
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

final class SyncConflictAndCommentTests: XCTestCase {
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

    // MARK: - Helpers

    private func issueChange(
        seq: Int,
        uuid: String,
        serverId: Int,
        body: String,
        deleted: Bool = false,
        updatedAt: String = "2026-07-01T00:00:00.000Z"
    ) -> SyncChange {
        SyncChange(
            serverSeq: seq,
            entity: .issue,
            op: .upsert,
            data: [
                "id": .number(Double(serverId)),
                "uuid": .string(uuid),
                "type": .string("memo"),
                "bodyMd": .string(body),
                "isBookmarked": .bool(false),
                "isDeleted": .bool(deleted),
                "createdAt": .string("2026-07-01T00:00:00.000Z"),
                "updatedAt": .string(updatedAt),
            ]
        )
    }

    /// Creates a memo through the data source and pushes it so the local row
    /// carries a server identity. Returns (serverId, uuid, serverUpdatedAt).
    private func makeSyncedMemo(
        body: String,
        serverId: Int,
        updatedAt: String = "2026-07-02T05:00:00.000Z"
    ) async throws -> (id: Int, uuid: String, updatedAt: String) {
        _ = try await dataSource.createMemo(CreateMemoRequest(bodyMd: body))
        transport.pushResponder = { request in
            SyncPushResponse(
                results: request.operations.map {
                    SyncPushOperationResult(
                        opId: $0.opId,
                        status: .applied,
                        uuid: $0.uuid,
                        serverId: serverId,
                        updatedAt: updatedAt,
                        conflictCopyUuid: nil
                    )
                },
                latestSeq: 1
            )
        }
        let summary = await engine.syncNow()
        XCTAssertEqual(summary.pushedCount, 1)
        transport.pushResponder = nil
        let uuid = try await database.dbWriter.read { db in
            try String.fetchOne(
                db,
                sql: "SELECT uuid FROM issues WHERE server_id = ?",
                arguments: [serverId]
            ) ?? ""
        }
        XCTAssertFalse(uuid.isEmpty)
        return (serverId, uuid, updatedAt)
    }

    private func pendingOps() async throws -> [PendingOperationRecord] {
        try await database.dbWriter.read { db in
            try PendingOperationRecord.fetchAll(
                db,
                sql: "SELECT * FROM pending_operations ORDER BY id"
            )
        }
    }

    // MARK: - Offline comments: outbox FIFO

    func testCommentOnUnsyncedMemoEnqueuesAfterMemoCreateWithParentUuid() async throws {
        let memo = try await dataSource.createMemo(CreateMemoRequest(bodyMd: "parent memo"))
        XCTAssertLessThan(memo.id, 0)

        let comment = try await dataSource.createComment(
            memoId: memo.id,
            CreateCommentRequest(bodyMd: "offline comment")
        )
        XCTAssertLessThan(comment.id, 0, "Unsynced comments surface negative local ids")
        XCTAssertEqual(comment.issueId, memo.id)
        XCTAssertEqual(comment.bodyMd, "offline comment")

        let ops = try await pendingOps()
        XCTAssertEqual(ops.map(\.entity), ["memo", "comment"], "FIFO: parent memo create precedes the comment create")
        XCTAssertEqual(ops.map(\.opType), ["create", "create"])
        XCTAssertLessThan(ops[0].id!, ops[1].id!)

        let memoUuid = ops[0].targetUuid
        XCTAssertEqual(ops[1].issueUuid, memoUuid, "The comment op carries the PARENT memo's uuid")
        XCTAssertNotEqual(ops[1].targetUuid, memoUuid)
        XCTAssertTrue(ops[1].payload?.contains("offline comment") == true)

        // The push request preserves that order and the uuid pairing.
        let summary = await engine.syncNow()
        XCTAssertEqual(summary.pushedCount, 2)
        let operations = try XCTUnwrap(transport.pushedRequests.first?.operations)
        XCTAssertEqual(operations.map(\.entity), [.memo, .comment])
        XCTAssertEqual(operations[0].uuid, memoUuid)
        XCTAssertEqual(operations[1].issueUuid, memoUuid)
        XCTAssertEqual(operations[1].uuid, ops[1].targetUuid)
    }

    // MARK: - Offline comments: outbox compression

    func testCommentUpdateMergesIntoQueuedOp() async throws {
        let memo = try await dataSource.createMemo(CreateMemoRequest(bodyMd: "parent"))
        let comment = try await dataSource.createComment(
            memoId: memo.id,
            CreateCommentRequest(bodyMd: "v1")
        )

        // An edit merges into the queued create: the server sees one create
        // with the final body.
        let updated = try await dataSource.updateComment(
            memoId: memo.id,
            commentId: comment.id,
            UpdateCommentRequest(bodyMd: "v2")
        )
        XCTAssertEqual(updated.bodyMd, "v2")
        XCTAssertEqual(updated.id, comment.id)

        let ops = try await pendingOps()
        XCTAssertEqual(ops.count, 2, "memo create + comment create; no separate update op")
        XCTAssertEqual(ops[1].opType, "create")
        XCTAssertTrue(ops[1].payload?.contains("v2") == true)
    }

    func testConsecutiveUpdatesOnSyncedCommentCollapseIntoOneOp() async throws {
        let synced = try await makeSyncedMemo(body: "synced parent", serverId: 50)
        try await database.dbWriter.write { db in
            try db.execute(
                sql: """
                    INSERT INTO comments (
                      uuid, server_id, issue_uuid, body_md,
                      created_at, updated_at, server_updated_at, is_deleted
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, 0)
                    """,
                arguments: [
                    "c-uuid-1", 7, synced.uuid, "server comment",
                    "2026-07-01T00:00:00.000Z", "2026-07-01T00:00:00.000Z",
                    "2026-07-01T00:00:00.000Z",
                ]
            )
        }
        _ = try await dataSource.updateComment(
            memoId: synced.id,
            commentId: 7,
            UpdateCommentRequest(bodyMd: "edit one")
        )
        _ = try await dataSource.updateComment(
            memoId: synced.id,
            commentId: 7,
            UpdateCommentRequest(bodyMd: "edit two")
        )

        let ops = try await pendingOps()
        let commentUpdates = ops.filter { $0.entity == "comment" && $0.opType == "update" }
        XCTAssertEqual(commentUpdates.count, 1)
        XCTAssertTrue(commentUpdates[0].payload?.contains("edit two") == true)
        XCTAssertEqual(
            commentUpdates[0].baseUpdatedAt,
            "2026-07-01T00:00:00.000Z",
            "The update carries the comment row's server_updated_at as its base"
        )
    }

    func testQueuedCommentCreatePlusDeleteCancelBothOut() async throws {
        let memo = try await dataSource.createMemo(CreateMemoRequest(bodyMd: "parent"))
        let comment = try await dataSource.createComment(
            memoId: memo.id,
            CreateCommentRequest(bodyMd: "ephemeral")
        )

        try await dataSource.deleteComment(memoId: memo.id, commentId: comment.id)

        let ops = try await pendingOps()
        XCTAssertEqual(ops.map(\.entity), ["memo"], "Only the memo create survives")

        let commentCount = try await database.dbWriter.read { db in
            try Int.fetchOne(db, sql: "SELECT COUNT(*) FROM comments") ?? -1
        }
        XCTAssertEqual(commentCount, 0, "The comment never reached the server, so nothing remains")
    }

    // MARK: - Offline comments: push result handling

    func testCommentPushWritesServerIdentityIntoCommentsTable() async throws {
        let memo = try await dataSource.createMemo(CreateMemoRequest(bodyMd: "parent"))
        _ = try await dataSource.createComment(
            memoId: memo.id,
            CreateCommentRequest(bodyMd: "to push")
        )

        transport.pushResponder = { request in
            SyncPushResponse(
                results: request.operations.map {
                    SyncPushOperationResult(
                        opId: $0.opId,
                        status: .applied,
                        uuid: $0.uuid,
                        serverId: $0.entity == .memo ? 10 : 20,
                        updatedAt: "2026-07-02T06:00:00.000Z",
                        conflictCopyUuid: nil
                    )
                },
                latestSeq: 2
            )
        }

        let summary = await engine.syncNow()
        XCTAssertEqual(summary.pushedCount, 2)
        XCTAssertTrue(summary.errors.isEmpty)

        let row = try await database.dbWriter.read { db in
            try Row.fetchOne(db, sql: "SELECT server_id, server_updated_at FROM comments")
        }
        XCTAssertEqual(row?["server_id"], 20)
        XCTAssertEqual(row?["server_updated_at"], "2026-07-02T06:00:00.000Z")

        let opCount = try await pendingOps().count
        XCTAssertEqual(opCount, 0)

        // With a server_id assigned, list reads surface the positive id.
        let comments = try await dataSource.listComments(memoId: 10)
        XCTAssertEqual(comments.map(\.id), [20])
    }

    // MARK: - Offline comments: local list reads

    func testListCommentsReadsLocallyOrderedAndExcludesDeleted() async throws {
        let memo = try await dataSource.createMemo(CreateMemoRequest(bodyMd: "negative-id parent"))
        XCTAssertLessThan(memo.id, 0, "Local reads must work for unsynced memos too")
        let memoUuid = try await database.dbWriter.read { db in
            try String.fetchOne(db, sql: "SELECT uuid FROM issues") ?? ""
        }

        // Insert out of chronological order; one row is soft-deleted.
        try await database.dbWriter.write { db in
            for (uuid, body, createdAt, deleted) in [
                ("c-2", "second", "2026-07-02T00:00:00.000Z", false),
                ("c-3", "deleted", "2026-07-03T00:00:00.000Z", true),
                ("c-1", "first", "2026-07-01T00:00:00.000Z", false),
            ] {
                try db.execute(
                    sql: """
                        INSERT INTO comments (
                          uuid, server_id, issue_uuid, body_md,
                          created_at, updated_at, server_updated_at, is_deleted
                        ) VALUES (?, NULL, ?, ?, ?, ?, NULL, ?)
                        """,
                    arguments: [uuid, memoUuid, body, createdAt, createdAt, deleted]
                )
            }
        }

        let comments = try await dataSource.listComments(memoId: memo.id)
        XCTAssertEqual(comments.map(\.bodyMd), ["first", "second"], "created_at ASC, deleted rows excluded")
        XCTAssertTrue(comments.allSatisfy { $0.id < 0 }, "Unsynced comments carry negative local ids")
        XCTAssertTrue(comments.allSatisfy { $0.issueId == memo.id })
    }

    // MARK: - Conflict handling: conflictCopied

    func testConflictCopiedRestoresServerBodyAndDeliversCopy() async throws {
        let synced = try await makeSyncedMemo(body: "original", serverId: 42)

        // Edit offline: queued update with the pre-conflict base.
        _ = try await dataSource.updateMemo(
            id: synced.id,
            UpdateMemoRequest(bodyMd: "local edited", isBookmarked: nil)
        )

        // The server was edited concurrently: the push answers conflictCopied,
        // and the following pull delivers BOTH the server's version of the
        // memo AND the conflicted-copy memo carrying the client body.
        transport.pushResponder = { request in
            SyncPushResponse(
                results: request.operations.map {
                    SyncPushOperationResult(
                        opId: $0.opId,
                        status: .conflictCopied,
                        uuid: $0.uuid,
                        serverId: 42,
                        updatedAt: "2026-07-02T07:00:00.000Z",
                        conflictCopyUuid: "copy-uuid"
                    )
                },
                latestSeq: 9
            )
        }
        transport.changePages = [
            SyncChangesResponse(
                changes: [
                    issueChange(
                        seq: 8,
                        uuid: synced.uuid,
                        serverId: 42,
                        body: "server edited",
                        updatedAt: "2026-07-02T07:00:00.000Z"
                    ),
                    issueChange(
                        seq: 9,
                        uuid: "copy-uuid",
                        serverId: 43,
                        body: "local edited\n\n> conflicted copy (from device, 2026-07-02)"
                    ),
                ],
                latestSeq: 9,
                hasMore: false
            ),
        ]

        let summary = await engine.syncNow()
        XCTAssertEqual(summary.pushedCount, 1)
        XCTAssertEqual(summary.conflictCopiedCount, 1)
        XCTAssertEqual(summary.pulledCount, 2, "The conflicted op left the outbox, so its uuid is pullable in the same run")
        XCTAssertTrue(summary.errors.isEmpty)

        let bodies = try await database.dbWriter.read { db in
            (
                original: try String.fetchOne(
                    db,
                    sql: "SELECT body_md FROM issues WHERE uuid = ?",
                    arguments: [synced.uuid]
                ),
                copy: try String.fetchOne(
                    db,
                    sql: "SELECT body_md FROM issues WHERE uuid = 'copy-uuid'"
                )
            )
        }
        XCTAssertEqual(bodies.original, "server edited", "The server version wins on the original memo")
        XCTAssertTrue(bodies.copy?.hasPrefix("local edited") == true, "The client body survives as a new conflicted-copy memo")

        let opCount = try await pendingOps().count
        XCTAssertEqual(opCount, 0)
    }

    // MARK: - Conflict handling: skipped delete (edit beats delete)

    func testSkippedDeleteIsRestoredByPull() async throws {
        let synced = try await makeSyncedMemo(body: "to delete", serverId: 42)

        try await dataSource.deleteMemo(id: synced.id)
        let deletedLocally = try await database.dbWriter.read { db in
            try Bool.fetchOne(
                db,
                sql: "SELECT is_deleted FROM issues WHERE uuid = ?",
                arguments: [synced.uuid]
            )
        }
        XCTAssertEqual(deletedLocally, true)

        // The memo changed server-side after our base: the delete is skipped
        // (edit beats delete) and the pull restores the living server row.
        transport.pushResponder = { request in
            SyncPushResponse(
                results: request.operations.map {
                    SyncPushOperationResult(
                        opId: $0.opId,
                        status: .skipped,
                        uuid: $0.uuid,
                        serverId: 42,
                        updatedAt: "2026-07-02T08:00:00.000Z",
                        conflictCopyUuid: nil
                    )
                },
                latestSeq: 12
            )
        }
        transport.changePages = [
            SyncChangesResponse(
                changes: [
                    issueChange(
                        seq: 12,
                        uuid: synced.uuid,
                        serverId: 42,
                        body: "edited on server",
                        deleted: false,
                        updatedAt: "2026-07-02T08:00:00.000Z"
                    ),
                ],
                latestSeq: 12,
                hasMore: false
            ),
        ]

        let summary = await engine.syncNow()
        XCTAssertEqual(summary.pushedCount, 1)
        XCTAssertEqual(summary.conflictCopiedCount, 0)
        XCTAssertEqual(summary.pulledCount, 1)

        let row = try await database.dbWriter.read { db in
            try Row.fetchOne(
                db,
                sql: "SELECT body_md, is_deleted FROM issues WHERE uuid = ?",
                arguments: [synced.uuid]
            )
        }
        XCTAssertEqual(row?["is_deleted"], false)
        XCTAssertEqual(row?["body_md"], "edited on server")

        let opCount = try await pendingOps().count
        XCTAssertEqual(opCount, 0)
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

import Foundation
import GRDB
import XCTest
@testable import MemeGTD

private actor TaskReplyTransport: SyncTransport {
    private var nextChanges: [SyncChange] = []
    private var supportsTaskWrites = false
    private(set) var requestedOperations: [SyncPushOperation] = []

    func giveChanges(_ changes: [SyncChange], supportsTaskWrites: Bool = false) {
        nextChanges = changes
        self.supportsTaskWrites = supportsTaskWrites
    }

    func supportsTaskSyncWrites() async throws -> Bool { supportsTaskWrites }

    func fetchChanges(since: Int, limit: Int) async throws -> SyncChangesResponse {
        let changes = nextChanges
        nextChanges = []
        return SyncChangesResponse(changes: changes, latestSeq: changes.last?.serverSeq ?? since, hasMore: false)
    }

    func push(_ request: SyncPushRequest) async throws -> SyncPushResponse {
        requestedOperations += request.operations
        return SyncPushResponse(results: request.operations.map { op in
            SyncPushOperationResult(opId: op.opId, status: .skipped, uuid: op.uuid, serverId: nil,
                updatedAt: nil, conflictCopyUuid: nil, reason: "Task was not found")
        }, latestSeq: 0)
    }
}

private final class TaskRelationFixture: URLProtocol {
    override class func canInit(with request: URLRequest) -> Bool { true }
    override class func canonicalRequest(for request: URLRequest) -> URLRequest { request }

    override func startLoading() {
        guard let url = request.url else { return }
        let status: Int
        let body: String
        switch url.path {
        case "/api/issues/42/links":
            status = 200
            body = #"[{"id":88,"sourceIssueId":42,"targetIssueId":9,"linkType":"relates","createdAt":"now","direction":"outgoing","targetIssue":{"id":9,"type":"memo","title":"Canonical target"}}]"#
        case "/api/issues/42/url-links":
            status = 200
            body = #"[{"id":99,"issueId":42,"url":"https://example.com/reference","title":"Reference","createdAt":"now"}]"#
        default:
            status = 404
            body = "{}"
        }
        let response = HTTPURLResponse(url: url, statusCode: status, httpVersion: nil, headerFields: nil)!
        client?.urlProtocol(self, didReceive: response, cacheStoragePolicy: .notAllowed)
        client?.urlProtocol(self, didLoad: Data(body.utf8))
        client?.urlProtocolDidFinishLoading(self)
    }

    override func stopLoading() {}
}

final class OfflineTaskReplayTests: XCTestCase {
    func testQueuedStatusMergesRemoteTitleAndBodyAndReviewedStatusDoesNotHideTombstone() async throws {
        let db = try AppDatabase.makeInMemory()
        let tasks = OfflineFirstTaskDataSource(database: db, remote: RemoteTaskDataSource())
        let transport = TaskReplyTransport()
        let sync = SyncEngine(database: db, transport: transport)
        await transport.giveChanges([taskChange(seq: 1, title: "Original", body: "Original body", status: "inbox")])
        let seed = await sync.syncNow()
        XCTAssertTrue(seed.errors.isEmpty)

        let edited = try await tasks.updateTask(id: 42, UpdateTaskRequest(title: nil, bodyMd: nil, status: "next"))
        let offlineStart = try XCTUnwrap(edited.actualStart)
        await transport.giveChanges([taskChange(seq: 2, title: "Server rename", body: "Server body", status: "open")])
        let remoteEdit = await sync.syncNow()
        XCTAssertEqual(remoteEdit.remainingOutboxCount, 1)
        XCTAssertEqual(remoteEdit.pulledCount, 1)
        let merged = try await tasks.getTask(id: 42)
        XCTAssertEqual(merged.title, "Server rename")
        XCTAssertEqual(merged.bodyMd, "Server body")
        XCTAssertEqual(merged.status, "next")
        XCTAssertEqual(merged.actualStart, offlineStart)
        XCTAssertNil(merged.actualEnd)

        await transport.giveChanges([taskChange(seq: 3, title: "Server rename", body: "Server body",
                                               status: "open", deleted: true)], supportsTaskWrites: true)
        let rejected = await sync.syncNow()
        XCTAssertEqual(rejected.remainingOutboxCount, 0)
        let replayed = await transport.requestedOperations
        XCTAssertEqual(replayed.first?.payload?.actualStart, offlineStart)
        let review = try await db.dbWriter.read { database in
            try PendingOperationRecord.fetchOne(database, sql: "SELECT * FROM pending_operations WHERE state = 'review'")
        }
        XCTAssertEqual(review?.targetUuid, "task-uuid")
        let tombstone = try await db.dbWriter.read { database in
            try Bool.fetchOne(database, sql: "SELECT is_deleted FROM issues WHERE uuid = 'task-uuid'")
        }
        XCTAssertEqual(tombstone, true)
    }

    func testSavedTaskShowsPendingRelationsAndSwitchesToCanonicalLinksAfterAcknowledgment() async throws {
        let directory = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        defer { try? FileManager.default.removeItem(at: directory) }
        let path = directory.appendingPathComponent("relations.sqlite").path
        let taskID: Int
        do {
            let db = try AppDatabase(DatabaseQueue(path: path))
            let tasks = OfflineFirstTaskDataSource(database: db, remote: RemoteTaskDataSource())
            let request = CreateTaskRequest(title: "Pending Task", bodyMd: nil, status: nil, taskKind: nil,
                scheduledStart: nil, scheduledEnd: nil, isAllDay: nil)
            let task = try await tasks.createTask(request, labels: [], projectIDs: [],
                links: [PendingLink(targetIssueId: 9, linkType: .relates, title: "Cached target", targetType: "memo")],
                urls: [PendingUrlLink(url: "https://example.com/reference", title: "Reference")])
            taskID = task.id
        }

        let db = try AppDatabase(DatabaseQueue(path: path))
        let config = URLSessionConfiguration.ephemeral
        config.protocolClasses = [TaskRelationFixture.self]
        let api = APIClient(baseUrl: "https://relations.test", session: URLSession(configuration: config))
        let relations = RemoteIssueRelationsDataSource(client: api, localPendingTasks: LocalIssueRelationsDataSource(database: db))
        let pendingLinks = try await relations.listLinks(issueId: taskID)
        let pendingURLs = try await relations.listUrlLinks(issueId: taskID)
        XCTAssertEqual(pendingLinks.map { $0.id }, [-1])
        XCTAssertEqual(pendingLinks.first?.targetIssue.title, "Cached target")
        XCTAssertEqual(pendingLinks.first?.targetIssue.type, "memo")
        XCTAssertEqual(pendingURLs.map { $0.url }, ["https://example.com/reference"])

        try await db.dbWriter.write { database in
            try database.execute(sql: "UPDATE issues SET server_id = 42 WHERE rowid = ?", arguments: [-taskID])
            try database.execute(sql: "DELETE FROM pending_operations WHERE entity = 'task' AND op_type = 'create'")
        }
        let links = try await relations.listLinks(issueId: taskID)
        let urls = try await relations.listUrlLinks(issueId: taskID)
        XCTAssertEqual(links.map { $0.id }, [88])
        XCTAssertEqual(links.first?.targetIssue.title, "Canonical target")
        XCTAssertEqual(urls.map { $0.id }, [99])
    }

    private func taskChange(seq: Int, title: String, body: String, status: String, deleted: Bool = false) -> SyncChange {
        SyncChange(serverSeq: seq, entity: .issue, op: .upsert, data: [
            "id": .number(42), "uuid": .string("task-uuid"), "type": .string("task"),
            "title": .string(title), "bodyMd": .string(body), "status": .string(status),
            "isDeleted": .bool(deleted), "actualEnd": .string("2025-01-01T04:30:00"),
            "createdAt": .string("2025-01-01T04:00:00.000Z"), "updatedAt": .string("2025-01-01T04:30:00.000Z"),
        ])
    }
}

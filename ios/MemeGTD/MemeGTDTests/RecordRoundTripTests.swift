import XCTest
import GRDB
@testable import MemeGTD

final class RecordRoundTripTests: XCTestCase {
    func testIssueRecordRoundTrip() throws {
        let database = try AppDatabase.makeInMemory()
        let issue = IssueRecord(
            uuid: UUIDv7.generate(),
            serverId: 12,
            type: "memo",
            title: "A title",
            bodyMd: "Some **markdown** body",
            status: "inbox",
            scheduledOn: "2026-07-02",
            scheduledStart: "2026-07-02T09:00:00",
            scheduledEnd: "2026-07-02T10:00:00",
            isAllDay: true,
            actualStart: "2026-07-02T09:05:00",
            actualEnd: "2026-07-02T09:55:00",
            startTime: "09:00",
            endTime: "10:00",
            endDate: "2026-07-03",
            duration: 60,
            taskKind: "single",
            meta: "{\"url\":\"https://example.com\"}",
            isBookmarked: true,
            isDeleted: false,
            createdAt: "2026-07-02T08:00:00.000Z",
            updatedAt: "2026-07-02T08:30:00.000Z",
            serverUpdatedAt: "2026-07-02T08:30:00.000Z",
            serverSeq: 99
        )

        try database.dbWriter.write { db in try issue.insert(db) }
        let fetched = try database.dbWriter.read { db in
            try IssueRecord.fetchOne(db, key: issue.uuid)
        }

        XCTAssertEqual(fetched, issue)
    }

    func testIssueRecordNilColumnsRoundTrip() throws {
        let database = try AppDatabase.makeInMemory()
        let issue = IssueRecord(
            uuid: UUIDv7.generate(),
            type: "memo",
            bodyMd: "Minimal memo",
            createdAt: "2026-07-02T08:00:00.000Z",
            updatedAt: "2026-07-02T08:00:00.000Z"
        )

        try database.dbWriter.write { db in try issue.insert(db) }
        let fetched = try database.dbWriter.read { db in
            try IssueRecord.fetchOne(db, key: issue.uuid)
        }

        XCTAssertEqual(fetched, issue)
        XCTAssertNil(fetched?.serverId)
        XCTAssertNil(fetched?.serverSeq)
    }

    func testCommentRecordRoundTrip() throws {
        let database = try AppDatabase.makeInMemory()
        let comment = CommentRecord(
            uuid: UUIDv7.generate(),
            serverId: 7,
            issueUuid: UUIDv7.generate(),
            bodyMd: "A comment",
            createdAt: "2026-07-02T08:00:00.000Z",
            updatedAt: "2026-07-02T08:00:00.000Z",
            serverUpdatedAt: nil,
            isDeleted: false
        )

        try database.dbWriter.write { db in try comment.insert(db) }
        let fetched = try database.dbWriter.read { db in
            try CommentRecord.fetchOne(db, key: comment.uuid)
        }

        XCTAssertEqual(fetched, comment)
    }

    func testLabelRecordRoundTrip() throws {
        let database = try AppDatabase.makeInMemory()
        let label = LabelRecord(
            name: "work",
            serverId: 3,
            description: "Work-related items",
            createdAt: "2026-07-02T08:00:00.000Z"
        )

        try database.dbWriter.write { db in try label.insert(db) }
        let fetched = try database.dbWriter.read { db in
            try LabelRecord.fetchOne(db, key: label.name)
        }

        XCTAssertEqual(fetched, label)
    }

    func testIssueLabelRecordRoundTrip() throws {
        let database = try AppDatabase.makeInMemory()
        let issueLabel = IssueLabelRecord(
            issueUuid: UUIDv7.generate(),
            labelName: "work"
        )

        try database.dbWriter.write { db in try issueLabel.insert(db) }
        let fetched = try database.dbWriter.read { db in
            try IssueLabelRecord.fetchOne(db, key: [
                "issue_uuid": issueLabel.issueUuid,
                "label_name": issueLabel.labelName,
            ])
        }

        XCTAssertEqual(fetched, issueLabel)
    }

    func testPendingOperationRecordRoundTrip() throws {
        let database = try AppDatabase.makeInMemory()
        var operation = PendingOperationRecord(
            id: nil,
            opId: UUID().uuidString.lowercased(),
            entity: "memo",
            opType: "update",
            targetUuid: UUIDv7.generate(),
            issueUuid: nil,
            payload: "{\"bodyMd\":\"edited\"}",
            baseUpdatedAt: "2026-07-02T08:00:00.000Z",
            state: "queued",
            retryCount: 0,
            createdAt: "2026-07-02T08:01:00.000Z"
        )

        try database.dbWriter.write { db in try operation.insert(db) }

        // The auto-increment id is filled in by didInsert.
        XCTAssertNotNil(operation.id)

        let fetched = try database.dbWriter.read { db in
            try PendingOperationRecord.fetchOne(db, key: operation.id)
        }
        XCTAssertEqual(fetched, operation)
    }

    func testPendingOperationIdsPreserveFIFOOrder() throws {
        let database = try AppDatabase.makeInMemory()

        let opIds = (0..<5).map { _ in UUID().uuidString.lowercased() }
        try database.dbWriter.write { db in
            for opId in opIds {
                var operation = PendingOperationRecord(
                    id: nil,
                    opId: opId,
                    entity: "memo",
                    opType: "create",
                    targetUuid: UUIDv7.generate(),
                    issueUuid: nil,
                    payload: nil,
                    baseUpdatedAt: nil,
                    state: "queued",
                    retryCount: 0,
                    createdAt: "2026-07-02T08:00:00.000Z"
                )
                try operation.insert(db)
            }
        }

        let fetchedOpIds = try database.dbWriter.read { db in
            try String.fetchAll(
                db,
                sql: "SELECT op_id FROM pending_operations ORDER BY id"
            )
        }
        XCTAssertEqual(fetchedOpIds, opIds)
    }
}

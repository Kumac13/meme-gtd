import XCTest
@testable import MemeGTD

final class IssueCopyJSONEncoderTests: XCTestCase {
    func testTaskJSONPreservesScheduleAndCommentDates() throws {
        let task = TaskItem(
            id: 42,
            type: "task",
            title: "Dated task",
            bodyMd: "Task body",
            status: "scheduled",
            taskKind: "event",
            scheduledStart: "2026-08-06T09:30:00",
            scheduledEnd: "2026-08-06T10:30:00",
            isAllDay: false,
            actualStart: nil,
            actualEnd: nil,
            scheduledOn: "2026-08-06",
            startTime: "09:30",
            endDate: "2026-08-06",
            endTime: "10:30",
            duration: 60,
            isBookmarked: true,
            isDeleted: false,
            createdAt: "2026-08-05T01:02:03.000Z",
            updatedAt: "2026-08-06T04:05:06.000Z",
            labels: ["calendar"],
            commentCount: 1,
            preview: nil,
            projectIds: [3],
            linkIds: [9]
        )
        let comment = Comment(
            id: 7,
            issueId: 42,
            bodyMd: "Comment body",
            createdAt: "2026-08-06T05:00:00.000Z",
            updatedAt: "2026-08-06T05:30:00.000Z"
        )

        let payload = try XCTUnwrap(jsonObject(
            IssueCopyJSONEncoder.string(item: task, comments: [comment])
        ))
        let item = try XCTUnwrap(payload["item"] as? [String: Any])
        let comments = try XCTUnwrap(payload["comments"] as? [[String: Any]])

        XCTAssertEqual(item["scheduledStart"] as? String, "2026-08-06T09:30:00")
        XCTAssertEqual(item["createdAt"] as? String, "2026-08-05T01:02:03.000Z")
        XCTAssertEqual(item["updatedAt"] as? String, "2026-08-06T04:05:06.000Z")
        XCTAssertEqual(comments.first?["createdAt"] as? String, "2026-08-06T05:00:00.000Z")
        XCTAssertEqual(comments.first?["updatedAt"] as? String, "2026-08-06T05:30:00.000Z")
    }

    func testMemoJSONPreservesItemAndCommentDates() throws {
        let memo = Memo(
            id: 12,
            type: "memo",
            bodyMd: "Memo body",
            isBookmarked: false,
            isDeleted: false,
            createdAt: "2026-08-01T01:02:03.000Z",
            updatedAt: "2026-08-02T04:05:06.000Z",
            labels: ["inbox"],
            commentCount: 0
        )

        let payload = try XCTUnwrap(jsonObject(
            IssueCopyJSONEncoder.string(item: memo, comments: [])
        ))
        let item = try XCTUnwrap(payload["item"] as? [String: Any])
        let comments = try XCTUnwrap(payload["comments"] as? [[String: Any]])

        XCTAssertEqual(item["createdAt"] as? String, "2026-08-01T01:02:03.000Z")
        XCTAssertEqual(item["updatedAt"] as? String, "2026-08-02T04:05:06.000Z")
        XCTAssertTrue(comments.isEmpty)
    }

    private func jsonObject(_ string: String?) throws -> [String: Any]? {
        guard let string else { return nil }
        let data = try XCTUnwrap(string.data(using: .utf8))
        return try JSONSerialization.jsonObject(with: data) as? [String: Any]
    }
}

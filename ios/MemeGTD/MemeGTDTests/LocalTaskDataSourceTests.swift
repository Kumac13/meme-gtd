import XCTest
import GRDB
@testable import MemeGTD

/// Phase 9 coverage: the Standalone-mode `LocalTaskDataSource` (pure local
/// CRUD, NO outbox, NO network) plus the local label writes of
/// `LocalLabelDataSource`.
///
/// Semantics asserted against the server reference implementation
/// (packages/db/src/taskRepository.ts / labelRepository.ts): create defaults,
/// the actual_start / actual_end auto-stamps on status transitions, list
/// filter behavior, hard-delete cleanup, and label validation messages.
final class LocalTaskDataSourceTests: XCTestCase {
    private var database: AppDatabase!
    private var dataSource: LocalTaskDataSource!
    private var labelSource: LocalLabelDataSource!

    override func setUpWithError() throws {
        database = try AppDatabase.makeInMemory()
        dataSource = LocalTaskDataSource(database: database)
        labelSource = LocalLabelDataSource(database: database)
    }

    // MARK: - Helpers

    /// Local wall-clock datetime shape the server writes into
    /// actual_start/actual_end: YYYY-MM-DDTHH:mm:00.
    private let localDateTimePattern = "^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:00$"

    private func makeTask(
        title: String,
        bodyMd: String? = nil,
        status: String? = nil,
        taskKind: String? = nil,
        scheduledStart: String? = nil,
        scheduledEnd: String? = nil,
        isAllDay: Bool? = nil
    ) async throws -> TaskItem {
        try await dataSource.createTask(CreateTaskRequest(
            title: title,
            bodyMd: bodyMd,
            status: status,
            taskKind: taskKind,
            scheduledStart: scheduledStart,
            scheduledEnd: scheduledEnd,
            isAllDay: isAllDay
        ))
    }

    private func outboxCount() async throws -> Int {
        try await database.dbWriter.read { db in
            try Int.fetchOne(db, sql: "SELECT COUNT(*) FROM pending_operations") ?? -1
        }
    }

    private func setUpdatedAt(_ updatedAt: String, taskId: Int) async throws {
        try await database.dbWriter.write { db in
            try db.execute(
                sql: "UPDATE issues SET updated_at = ? WHERE rowid = ?",
                arguments: [updatedAt, -taskId]
            )
        }
    }

    // MARK: - Create

    func testCreateAppliesServerDefaults() async throws {
        let task = try await makeTask(title: "Buy milk")

        XCTAssertLessThan(task.id, 0, "Rows without a server identity surface negative local ids")
        XCTAssertEqual(task.type, "task")
        XCTAssertEqual(task.title, "Buy milk")
        XCTAssertEqual(task.bodyMd, "", "createTaskHandler defaults bodyMd to an empty string")
        XCTAssertEqual(task.status, "inbox", "Server default status is 'inbox'")
        XCTAssertEqual(task.taskKind, "action", "Server default task_kind is 'action'")
        XCTAssertNil(task.actualStart)
        XCTAssertNil(task.actualEnd)
        XCTAssertFalse(task.isAllDay)
        XCTAssertEqual(task.labels, [])
        XCTAssertEqual(task.commentCount, 0)

        let outbox = try await outboxCount()
        XCTAssertEqual(outbox, 0, "Standalone writes never touch the outbox")
    }

    func testCreateWithExplicitFieldsAndSchedule() async throws {
        let task = try await makeTask(
            title: "Team offsite",
            bodyMd: "Agenda TBD",
            status: "scheduled",
            taskKind: "event",
            scheduledStart: "2026-07-10T09:00:00",
            scheduledEnd: "2026-07-10T17:00:00",
            isAllDay: true
        )

        XCTAssertEqual(task.bodyMd, "Agenda TBD")
        XCTAssertEqual(task.status, "scheduled")
        XCTAssertEqual(task.taskKind, "event")
        XCTAssertEqual(task.scheduledStart, "2026-07-10T09:00:00")
        XCTAssertEqual(task.scheduledEnd, "2026-07-10T17:00:00")
        XCTAssertTrue(task.isAllDay)
    }

    func testCreateInNextStatusStampsActualStart() async throws {
        let task = try await makeTask(title: "Start now", status: "next")

        XCTAssertEqual(task.status, "next")
        let actualStart = try XCTUnwrap(task.actualStart)
        XCTAssertNotNil(
            actualStart.range(of: localDateTimePattern, options: .regularExpression),
            "Creating in 'next' stamps actual_start like the server (\(actualStart))"
        )
    }

    // MARK: - Get / list

    func testGetTaskThrowsForUnknownId() async throws {
        do {
            _ = try await dataSource.getTask(id: 12345)
            XCTFail("Expected LocalTaskError.taskNotFound")
        } catch let error as LocalTaskError {
            XCTAssertEqual(error, .taskNotFound)
        }
    }

    func testListFiltersStatusBookmarkSearchAndSchedule() async throws {
        let inboxTask = try await makeTask(title: "Sort inbox")
        let scheduled = try await makeTask(
            title: "Dentist appointment",
            status: "scheduled",
            scheduledStart: "2026-07-10T12:00:00"
        )
        let bookmarked = try await makeTask(title: "Read paper", status: "open")
        _ = try await dataSource.bookmarkTask(id: bookmarked.id)

        // Status filter.
        var page = try await dataSource.listTasks(queryItems: [
            URLQueryItem(name: "status", value: "inbox"),
        ])
        XCTAssertEqual(page.data.map(\.id), [inboxTask.id])
        XCTAssertEqual(page.total, 1)

        // Bookmark filter.
        page = try await dataSource.listTasks(queryItems: [
            URLQueryItem(name: "bookmarked", value: "true"),
        ])
        XCTAssertEqual(page.data.map(\.id), [bookmarked.id])

        // Title LIKE substring search (server searches title only).
        page = try await dataSource.listTasks(queryItems: [
            URLQueryItem(name: "search", value: "entist"),
        ])
        XCTAssertEqual(page.data.map(\.id), [scheduled.id])

        // Scheduled range around the pinned date (bounds ±1 day so the
        // DATE(..., 'localtime') conversion cannot move it outside).
        page = try await dataSource.listTasks(queryItems: [
            URLQueryItem(name: "scheduledFrom", value: "2026-07-09"),
            URLQueryItem(name: "scheduledTo", value: "2026-07-11"),
        ])
        XCTAssertEqual(page.data.map(\.id), [scheduled.id])
    }

    func testListFallsBackToActualStartWhenNoSchedule() async throws {
        let task = try await makeTask(title: "Unscheduled but started")
        try await database.dbWriter.write { db in
            try db.execute(
                sql: "UPDATE issues SET actual_start = '2026-07-10T12:00:00' WHERE rowid = ?",
                arguments: [-task.id]
            )
        }

        let page = try await dataSource.listTasks(queryItems: [
            URLQueryItem(name: "scheduledFrom", value: "2026-07-09"),
            URLQueryItem(name: "scheduledTo", value: "2026-07-11"),
        ])
        XCTAssertEqual(page.data.map(\.id), [task.id])
    }

    func testListOrderLimitOffsetAndProjectFilter() async throws {
        let a = try await makeTask(title: "oldest")
        let b = try await makeTask(title: "middle")
        let c = try await makeTask(title: "newest")
        try await setUpdatedAt("2026-06-01T12:00:00.000Z", taskId: a.id)
        try await setUpdatedAt("2026-06-02T12:00:00.000Z", taskId: b.id)
        try await setUpdatedAt("2026-06-03T12:00:00.000Z", taskId: c.id)

        // Default order: updated_at DESC.
        var page = try await dataSource.listTasks(queryItems: [])
        XCTAssertEqual(page.data.map(\.id), [c.id, b.id, a.id])

        // Pagination.
        page = try await dataSource.listTasks(queryItems: [
            URLQueryItem(name: "limit", value: "1"),
            URLQueryItem(name: "offset", value: "1"),
        ])
        XCTAssertEqual(page.data.map(\.id), [b.id])
        XCTAssertEqual(page.total, 3)
        XCTAssertEqual(page.limit, 1)
        XCTAssertEqual(page.offset, 1)

        // Project membership has no local data in Standalone: honest empty
        // page (same rule as memos).
        page = try await dataSource.listTasks(queryItems: [
            URLQueryItem(name: "projectId", value: "3"),
            URLQueryItem(name: "limit", value: "20"),
        ])
        XCTAssertTrue(page.data.isEmpty)
        XCTAssertEqual(page.total, 0)
    }

    func testSearchTasksReturnsSlimShape() async throws {
        let task = try await makeTask(title: "Linkable task", status: "open")

        let response = try await dataSource.searchTasks(queryItems: [
            URLQueryItem(name: "search", value: "Linkable"),
        ])
        XCTAssertEqual(response.data.count, 1)
        XCTAssertEqual(response.data[0].id, task.id)
        XCTAssertEqual(response.data[0].type, "task")
        XCTAssertEqual(response.data[0].title, "Linkable task")
        XCTAssertEqual(response.data[0].status, "open")
    }

    // MARK: - Update / status transitions

    func testUpdateTitleAndBodyKeepsStatusFields() async throws {
        let task = try await makeTask(title: "before", bodyMd: "- [ ] todo")

        let updated = try await dataSource.updateTask(
            id: task.id,
            UpdateTaskRequest(title: "after", bodyMd: "- [x] todo", status: nil)
        )
        XCTAssertEqual(updated.id, task.id)
        XCTAssertEqual(updated.title, "after")
        XCTAssertEqual(updated.bodyMd, "- [x] todo", "Body full-replacement is how the TODO checkbox toggle persists")
        XCTAssertEqual(updated.status, "inbox")
        XCTAssertNil(updated.actualStart)
        XCTAssertNil(updated.actualEnd)
    }

    func testStatusTransitionToEveryStatus() async throws {
        // Any status may move to any other on the server (no transition
        // matrix); only 'done' and 'next' have side effects.
        for target in ["open", "waiting", "scheduled", "someday", "canceled", "inbox"] {
            let task = try await makeTask(title: "to \(target)")
            let updated = try await dataSource.updateTask(
                id: task.id,
                UpdateTaskRequest(title: nil, bodyMd: nil, status: target)
            )
            XCTAssertEqual(updated.status, target)
            XCTAssertNil(updated.actualStart, "Only 'next' stamps actual_start")
            XCTAssertNil(updated.actualEnd, "Only 'done' stamps actual_end")
        }
    }

    func testStatusTransitionToDoneStampsActualEnd() async throws {
        let task = try await makeTask(title: "finish me", status: "open")

        let done = try await dataSource.updateTask(
            id: task.id,
            UpdateTaskRequest(title: nil, bodyMd: nil, status: "done")
        )
        XCTAssertEqual(done.status, "done")
        let actualEnd = try XCTUnwrap(done.actualEnd)
        XCTAssertNotNil(actualEnd.range(of: localDateTimePattern, options: .regularExpression))
    }

    func testStatusTransitionToNextStampsStartAndClearsEnd() async throws {
        let task = try await makeTask(title: "restart me", status: "open")
        _ = try await dataSource.updateTask(
            id: task.id,
            UpdateTaskRequest(title: nil, bodyMd: nil, status: "done")
        )

        let restarted = try await dataSource.updateTask(
            id: task.id,
            UpdateTaskRequest(title: nil, bodyMd: nil, status: "next")
        )
        XCTAssertEqual(restarted.status, "next")
        let actualStart = try XCTUnwrap(restarted.actualStart)
        XCTAssertNotNil(actualStart.range(of: localDateTimePattern, options: .regularExpression))
        XCTAssertNil(restarted.actualEnd, "Restarting a task clears actual_end like the server")
    }

    func testSameStatusUpdateDoesNotRestamp() async throws {
        let task = try await makeTask(title: "already next", status: "next")
        let stampedStart = try XCTUnwrap(task.actualStart)

        // Re-sending the current status is NOT a transition on the server
        // (input.status !== task.status), so nothing is restamped.
        try await database.dbWriter.write { db in
            try db.execute(
                sql: "UPDATE issues SET actual_start = '2026-01-01T09:00:00' WHERE rowid = ?",
                arguments: [-task.id]
            )
        }
        let updated = try await dataSource.updateTask(
            id: task.id,
            UpdateTaskRequest(title: nil, bodyMd: nil, status: "next")
        )
        XCTAssertEqual(updated.actualStart, "2026-01-01T09:00:00")
        _ = stampedStart
    }

    // MARK: - Bookmark / delete

    func testBookmarkRoundTrip() async throws {
        let task = try await makeTask(title: "bookmark me")

        let bookmarked = try await dataSource.bookmarkTask(id: task.id)
        XCTAssertTrue(bookmarked.isBookmarked)
        XCTAssertEqual(bookmarked.title, "bookmark me")

        let unbookmarked = try await dataSource.unbookmarkTask(id: task.id)
        XCTAssertFalse(unbookmarked.isBookmarked)
    }

    func testDeleteTaskHardDeletesRowAndRelated() async throws {
        let task = try await makeTask(title: "doomed")
        _ = try await dataSource.createComment(taskId: task.id, CreateCommentRequest(bodyMd: "gone too"))

        // Label assignment and links hanging off the task.
        let label = try await labelSource.createLabel(CreateLabelRequest(name: "doom", description: nil))
        _ = try await labelSource.assignLabel(issueId: task.id, AssignLabelRequest(labelId: label.id))
        let other = try await makeTask(title: "survivor")
        let relations = LocalIssueRelationsDataSource(database: database)
        _ = try await relations.createLink(CreateLinkRequest(
            sourceIssueId: task.id,
            targetIssueId: other.id,
            linkType: .relates
        ))
        _ = try await relations.createUrlLink(
            issueId: task.id,
            CreateUrlLinkRequest(url: "https://example.com", title: nil)
        )

        try await dataSource.deleteTask(id: task.id)

        let counts = try await database.dbWriter.read { db in
            [
                try Int.fetchOne(db, sql: "SELECT COUNT(*) FROM issues WHERE title = 'doomed'") ?? -1,
                try Int.fetchOne(db, sql: "SELECT COUNT(*) FROM comments") ?? -1,
                try Int.fetchOne(db, sql: "SELECT COUNT(*) FROM issue_labels") ?? -1,
                try Int.fetchOne(db, sql: "SELECT COUNT(*) FROM links") ?? -1,
                try Int.fetchOne(db, sql: "SELECT COUNT(*) FROM url_links") ?? -1,
            ]
        }
        XCTAssertEqual(counts, [0, 0, 0, 0, 0], "Hard delete drops the row plus comments/labels/links/url-links")

        let outbox = try await outboxCount()
        XCTAssertEqual(outbox, 0)
    }

    // MARK: - Comments

    func testTaskCommentCrud() async throws {
        let task = try await makeTask(title: "with comments")

        let comment = try await dataSource.createComment(
            taskId: task.id,
            CreateCommentRequest(bodyMd: "first")
        )
        XCTAssertLessThan(comment.id, 0)
        XCTAssertEqual(comment.issueId, task.id)

        var comments = try await dataSource.listComments(taskId: task.id)
        XCTAssertEqual(comments.map(\.bodyMd), ["first"])

        let withCount = try await dataSource.getTask(id: task.id)
        XCTAssertEqual(withCount.commentCount, 1)

        let updated = try await dataSource.updateComment(
            taskId: task.id,
            commentId: comment.id,
            UpdateCommentRequest(bodyMd: "edited")
        )
        XCTAssertEqual(updated.id, comment.id)
        XCTAssertEqual(updated.bodyMd, "edited")

        try await dataSource.deleteComment(taskId: task.id, commentId: comment.id)
        comments = try await dataSource.listComments(taskId: task.id)
        XCTAssertTrue(comments.isEmpty)

        let commentRows = try await database.dbWriter.read { db in
            try Int.fetchOne(db, sql: "SELECT COUNT(*) FROM comments") ?? -1
        }
        XCTAssertEqual(commentRows, 0, "Standalone comment deletes are hard deletes")

        let outbox = try await outboxCount()
        XCTAssertEqual(outbox, 0)
    }
}

/// Phase 9 coverage: the local label writes (create / assign / remove) of
/// `LocalLabelDataSource` in Standalone mode.
final class LocalLabelWritesTests: XCTestCase {
    private var database: AppDatabase!
    private var labelSource: LocalLabelDataSource!
    private var taskSource: LocalTaskDataSource!

    override func setUpWithError() throws {
        database = try AppDatabase.makeInMemory()
        labelSource = LocalLabelDataSource(database: database)
        taskSource = LocalTaskDataSource(database: database)
    }

    func testCreateAssignAndRemoveLabelLocally() async throws {
        let task = try await taskSource.createTask(CreateTaskRequest(
            title: "labelled",
            bodyMd: nil,
            status: nil,
            taskKind: nil,
            scheduledStart: nil,
            scheduledEnd: nil,
            isAllDay: nil
        ))

        let label = try await labelSource.createLabel(
            CreateLabelRequest(name: "work", description: "Work stuff")
        )
        XCTAssertLessThan(label.id, 0, "Locally created labels surface negative ids")
        XCTAssertEqual(label.name, "work")
        XCTAssertEqual(label.description, "Work stuff")

        let response = try await labelSource.assignLabel(
            issueId: task.id,
            AssignLabelRequest(labelId: label.id)
        )
        XCTAssertTrue(response.success)

        // Idempotent like the server's INSERT OR IGNORE.
        _ = try await labelSource.assignLabel(issueId: task.id, AssignLabelRequest(labelId: label.id))

        var fetched = try await taskSource.getTask(id: task.id)
        XCTAssertEqual(fetched.labels, ["work"])

        let listed = try await labelSource.listLabels()
        XCTAssertEqual(listed.map(\.name), ["work"])
        XCTAssertEqual(listed[0].taskCount, 1)

        try await labelSource.removeLabel(issueId: task.id, labelId: label.id)
        fetched = try await taskSource.getTask(id: task.id)
        XCTAssertEqual(fetched.labels, [])
    }

    func testCreateDuplicateLabelFailsLikeServer() async throws {
        _ = try await labelSource.createLabel(CreateLabelRequest(name: "dup", description: nil))
        do {
            _ = try await labelSource.createLabel(CreateLabelRequest(name: "dup", description: nil))
            XCTFail("Expected duplicate-name error")
        } catch let error as LocalLabelError {
            XCTAssertEqual(error.localizedDescription, "Label 'dup' already exists")
        }
    }

    func testAssignToUnknownIssueOrLabelFails() async throws {
        let label = try await labelSource.createLabel(CreateLabelRequest(name: "x", description: nil))

        do {
            _ = try await labelSource.assignLabel(issueId: 999, AssignLabelRequest(labelId: label.id))
            XCTFail("Expected unknown-issue error")
        } catch let error as LocalLabelError {
            XCTAssertEqual(error.localizedDescription, "Issue #999 not found or deleted")
        }

        let task = try await taskSource.createTask(CreateTaskRequest(
            title: "t",
            bodyMd: nil,
            status: nil,
            taskKind: nil,
            scheduledStart: nil,
            scheduledEnd: nil,
            isAllDay: nil
        ))
        do {
            _ = try await labelSource.assignLabel(issueId: task.id, AssignLabelRequest(labelId: 999))
            XCTFail("Expected unknown-label error")
        } catch let error as LocalLabelError {
            XCTAssertEqual(error.localizedDescription, "Label #999 not found")
        }
    }
}

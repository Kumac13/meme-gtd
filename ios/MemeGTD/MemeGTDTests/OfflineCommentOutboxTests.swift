import XCTest
import GRDB
@testable import MemeGTD

/// Offline comment writes on TASKS and ARTICLES. The item itself stays
/// read-only without a server, but its comments go through the same
/// `CommentOutbox` path memo comments have always used: the local row and its
/// pending operation are written together, and the push carries the parent's
/// uuid so the server resolves the comment regardless of issue type.
final class OfflineCommentOutboxTests: XCTestCase {
    private var database: AppDatabase!

    override func setUpWithError() throws {
        database = try AppDatabase.makeInMemory()
    }

    // MARK: - Seeding

    private func seedIssues() async throws {
        try await database.dbWriter.write { db in
            try IssueRecord(
                uuid: "task-1",
                serverId: 101,
                type: "task",
                title: "Fix login bug",
                bodyMd: "task one body",
                status: "next",
                taskKind: "action",
                createdAt: "2026-07-01T00:00:00.000Z",
                updatedAt: "2026-07-02T00:00:00.000Z"
            ).insert(db)
            try IssueRecord(
                uuid: "article-1",
                serverId: 301,
                type: "article",
                title: "Interesting article",
                bodyMd: "archived content",
                createdAt: "2026-06-30T00:00:00.000Z",
                updatedAt: "2026-06-30T00:00:00.000Z"
            ).insert(db)
            // A comment the pull already mirrored (has a server identity).
            try CommentRecord(
                uuid: "comment-1",
                serverId: 201,
                issueUuid: "task-1",
                bodyMd: "synced comment",
                createdAt: "2026-07-01T10:00:00.000Z",
                updatedAt: "2026-07-01T10:00:00.000Z",
                serverUpdatedAt: "2026-07-01T10:00:00.000Z"
            ).insert(db)
        }
    }

    // MARK: - Outbox inspection helpers

    private func operations() async throws -> [PendingOperationRecord] {
        try await database.dbWriter.read { db in
            try PendingOperationRecord.fetchAll(
                db,
                sql: "SELECT * FROM pending_operations ORDER BY id"
            )
        }
    }

    private func commentExists(uuid: String) async throws -> Bool {
        try await database.dbWriter.read { db in
            try Bool.fetchOne(
                db,
                sql: "SELECT EXISTS(SELECT 1 FROM comments WHERE uuid = ?)",
                arguments: [uuid]
            ) ?? false
        }
    }

    private func isCommentDeleted(uuid: String) async throws -> Bool {
        try await database.dbWriter.read { db in
            try Bool.fetchOne(
                db,
                sql: "SELECT is_deleted FROM comments WHERE uuid = ?",
                arguments: [uuid]
            ) ?? false
        }
    }

    // MARK: - Task comments

    func testTaskCommentCreateQueuesWhileServerUnreachable() async throws {
        try await seedIssues()
        let syncRequests = CallCounter()
        let dataSource = OfflineFirstTaskDataSource(
            database: database,
            remote: OfflineTaskRemote(),
            onLocalWrite: { syncRequests.increment() }
        )

        let comment = try await dataSource.createComment(
            taskId: 101,
            CreateCommentRequest(bodyMd: "written offline")
        )

        XCTAssertLessThan(comment.id, 0, "an unpushed comment surfaces as -rowid")
        XCTAssertEqual(comment.issueId, 101)
        XCTAssertEqual(comment.bodyMd, "written offline")
        XCTAssertEqual(syncRequests.count, 1, "a local write pokes the scheduler")

        let ops = try await operations()
        XCTAssertEqual(ops.count, 1)
        XCTAssertEqual(ops[0].entity, "comment")
        XCTAssertEqual(ops[0].opType, "create")
        XCTAssertEqual(ops[0].issueUuid, "task-1", "the op carries the PARENT's uuid")
        XCTAssertEqual(ops[0].state, "queued")
        XCTAssertNil(ops[0].baseUpdatedAt)
        let payload = try PendingOperationQueue.decodePayload(ops[0].payload)
        XCTAssertEqual(payload?.bodyMd, "written offline")
        XCTAssertNotNil(payload?.createdAt)

        // The comment is readable straight away, offline.
        let listed = try await dataSource.listComments(taskId: 101)
        XCTAssertEqual(listed.map(\.bodyMd), ["synced comment", "written offline"])
    }

    func testOfflineCommentEditMergesIntoTheQueuedCreateAndDeleteCancelsIt() async throws {
        try await seedIssues()
        let dataSource = OfflineFirstTaskDataSource(database: database, remote: OfflineTaskRemote())

        let created = try await dataSource.createComment(
            taskId: 101,
            CreateCommentRequest(bodyMd: "first draft")
        )
        let edited = try await dataSource.updateComment(
            taskId: 101,
            commentId: created.id,
            UpdateCommentRequest(bodyMd: "second draft")
        )
        XCTAssertEqual(edited.bodyMd, "second draft")

        var ops = try await operations()
        XCTAssertEqual(ops.count, 1, "the edit merges into the unsent create")
        XCTAssertEqual(ops[0].opType, "create")
        XCTAssertEqual(try PendingOperationQueue.decodePayload(ops[0].payload)?.bodyMd, "second draft")

        // create + delete while still queued cancel each other: nothing to
        // push, no row left behind.
        let uuid = ops[0].targetUuid
        try await dataSource.deleteComment(taskId: 101, commentId: created.id)
        ops = try await operations()
        XCTAssertTrue(ops.isEmpty)
        let stillThere = try await commentExists(uuid: uuid)
        XCTAssertFalse(stillThere, "a comment that never reached the server is hard-deleted")
    }

    func testOfflineEditOfSyncedCommentQueuesUpdateWithBaseUpdatedAt() async throws {
        try await seedIssues()
        let dataSource = OfflineFirstTaskDataSource(database: database, remote: OfflineTaskRemote())

        let edited = try await dataSource.updateComment(
            taskId: 101,
            commentId: 201,
            UpdateCommentRequest(bodyMd: "edited offline")
        )
        XCTAssertEqual(edited.id, 201, "a synced comment keeps its server id")
        XCTAssertEqual(edited.bodyMd, "edited offline")

        let ops = try await operations()
        XCTAssertEqual(ops.count, 1)
        XCTAssertEqual(ops[0].opType, "update")
        XCTAssertEqual(ops[0].targetUuid, "comment-1")
        XCTAssertEqual(
            ops[0].baseUpdatedAt,
            "2026-07-01T10:00:00.000Z",
            "the server's own updatedAt is what the conflict rules compare against"
        )
    }

    func testOfflineDeleteOfSyncedCommentSoftDeletesAndQueuesDelete() async throws {
        try await seedIssues()
        let dataSource = OfflineFirstTaskDataSource(database: database, remote: OfflineTaskRemote())

        try await dataSource.deleteComment(taskId: 101, commentId: 201)

        let ops = try await operations()
        XCTAssertEqual(ops.count, 1)
        XCTAssertEqual(ops[0].opType, "delete")
        XCTAssertEqual(ops[0].targetUuid, "comment-1")
        XCTAssertEqual(ops[0].baseUpdatedAt, "2026-07-01T10:00:00.000Z")

        let isDeleted = try await isCommentDeleted(uuid: "comment-1")
        XCTAssertTrue(isDeleted, "soft delete mirrors the server")
        let listed = try await dataSource.listComments(taskId: 101)
        XCTAssertTrue(listed.isEmpty)
    }

    func testCommentWriteOnAnUnmirroredTaskStaysReadOnly() async throws {
        try await seedIssues()
        let dataSource = OfflineFirstTaskDataSource(database: database, remote: OfflineTaskRemote())

        do {
            _ = try await dataSource.createComment(taskId: 999, CreateCommentRequest(bodyMd: "nope"))
            XCTFail("Expected OfflineReadOnlyError")
        } catch is OfflineReadOnlyError {}

        let ops = try await operations()
        XCTAssertTrue(ops.isEmpty, "the rolled-back transaction leaves no op behind")
    }

    // MARK: - Online behavior

    func testPendingCommentsSurviveTheReturnOfTheServer() async throws {
        try await seedIssues()
        let remote = ScriptedTaskRemote()
        remote.reachable = false
        let dataSource = OfflineFirstTaskDataSource(database: database, remote: remote)

        _ = try await dataSource.createComment(taskId: 101, CreateCommentRequest(bodyMd: "queued while away"))

        // Server is back, but the push has not run yet: its comment list
        // cannot know about the queued comment, which must stay visible.
        remote.reachable = true
        remote.comments = [
            Comment(
                id: 201,
                issueId: 101,
                bodyMd: "synced comment",
                createdAt: "2026-07-01T10:00:00.000Z",
                updatedAt: "2026-07-01T10:00:00.000Z"
            ),
        ]
        let listed = try await dataSource.listComments(taskId: 101)
        XCTAssertEqual(listed.map(\.bodyMd), ["synced comment", "queued while away"])
    }

    func testEditingAnUnpushedCommentNeverReachesTheServer() async throws {
        try await seedIssues()
        let remote = ScriptedTaskRemote()
        remote.reachable = false
        let dataSource = OfflineFirstTaskDataSource(database: database, remote: remote)

        let created = try await dataSource.createComment(taskId: 101, CreateCommentRequest(bodyMd: "draft"))

        // Online again: the server has no id for this comment yet, so the
        // edit and the delete must stay in the outbox instead of hitting
        // /comments/-1.
        remote.reachable = true
        _ = try await dataSource.updateComment(
            taskId: 101,
            commentId: created.id,
            UpdateCommentRequest(bodyMd: "still local")
        )
        XCTAssertEqual(remote.updateCommentCalls, 0)

        try await dataSource.deleteComment(taskId: 101, commentId: created.id)
        XCTAssertEqual(remote.deleteCommentCalls, 0)
        let remaining = try await operations()
        XCTAssertTrue(remaining.isEmpty)
    }

    // MARK: - Article comments

    func testArticleCommentsReadFromTheLocalMirrorAndQueueOffline() async throws {
        try await seedIssues()
        try await database.dbWriter.write { db in
            try CommentRecord(
                uuid: "article-comment-1",
                serverId: 401,
                issueUuid: "article-1",
                bodyMd: "synced article comment",
                createdAt: "2026-06-30T10:00:00.000Z",
                updatedAt: "2026-06-30T10:00:00.000Z",
                serverUpdatedAt: "2026-06-30T10:00:00.000Z"
            ).insert(db)
        }
        let syncRequests = CallCounter()
        let dataSource = OfflineFirstArticleDataSource(
            database: database,
            remote: OfflineArticleRemote(),
            onLocalWrite: { syncRequests.increment() }
        )

        // Reading comments offline used to fail outright, which left the
        // article timeline empty.
        let listed = try await dataSource.listComments(articleId: 301)
        XCTAssertEqual(listed.map(\.bodyMd), ["synced article comment"])

        let created = try await dataSource.createComment(
            articleId: 301,
            CreateCommentRequest(bodyMd: "offline article comment")
        )
        XCTAssertLessThan(created.id, 0)
        XCTAssertEqual(syncRequests.count, 1)

        let ops = try await operations()
        XCTAssertEqual(ops.count, 1)
        XCTAssertEqual(ops[0].entity, "comment")
        XCTAssertEqual(ops[0].issueUuid, "article-1")

        // Article fields themselves stay read-only offline.
        do {
            _ = try await dataSource.updateArticle(id: 301, UpdateArticleRequest(title: "no", bodyMd: nil))
            XCTFail("Expected OfflineReadOnlyError")
        } catch is OfflineReadOnlyError {}
    }
}

// MARK: - Test doubles

/// Counts `onLocalWrite` callbacks without capturing a mutable local.
private final class CallCounter: @unchecked Sendable {
    private(set) var count = 0
    func increment() { count += 1 }
}

// MARK: - Remotes

/// Every call fails the way the real APIClient fails against an unreachable
/// server.
private struct OfflineTaskRemote: TaskDataSource {
    private func fail() -> Error { APIError.networkError(URLError(.cannotConnectToHost)) }
    func listTasks(queryItems: [URLQueryItem]) async throws -> TaskListResponse { throw fail() }
    func searchTasks(queryItems: [URLQueryItem]) async throws -> SearchTasksResponse { throw fail() }
    func getTask(id: Int) async throws -> TaskItem { throw fail() }
    func createTask(_ request: CreateTaskRequest) async throws -> TaskItem { throw fail() }
    func updateTask(id: Int, _ request: UpdateTaskRequest) async throws -> TaskItem { throw fail() }
    func deleteTask(id: Int) async throws { throw fail() }
    func bookmarkTask(id: Int) async throws -> TaskItem { throw fail() }
    func unbookmarkTask(id: Int) async throws -> TaskItem { throw fail() }
    func listComments(taskId: Int) async throws -> [Comment] { throw fail() }
    func createComment(taskId: Int, _ request: CreateCommentRequest) async throws -> Comment { throw fail() }
    func updateComment(taskId: Int, commentId: Int, _ request: UpdateCommentRequest) async throws -> Comment { throw fail() }
    func deleteComment(taskId: Int, commentId: Int) async throws { throw fail() }
}

private struct OfflineArticleRemote: ArticleDataSource {
    private func fail() -> Error { APIError.networkError(URLError(.cannotConnectToHost)) }
    func listArticles(queryItems: [URLQueryItem]) async throws -> ArticleListResponse { throw fail() }
    func searchArticles(queryItems: [URLQueryItem]) async throws -> SearchArticlesResponse { throw fail() }
    func getArticle(id: Int) async throws -> Article { throw fail() }
    func createArticle(_ request: CreateManualArticleRequest) async throws -> Article { throw fail() }
    func updateArticle(id: Int, _ request: UpdateArticleRequest) async throws -> Article { throw fail() }
    func bookmarkArticle(id: Int) async throws -> Article { throw fail() }
    func unbookmarkArticle(id: Int) async throws -> Article { throw fail() }
    func listComments(articleId: Int) async throws -> [Comment] { throw fail() }
    func createComment(articleId: Int, _ request: CreateCommentRequest) async throws -> Comment { throw fail() }
    func updateComment(articleId: Int, commentId: Int, _ request: UpdateCommentRequest) async throws -> Comment { throw fail() }
    func deleteComment(articleId: Int, commentId: Int) async throws { throw fail() }
    func deleteArticle(id: Int) async throws { throw fail() }
}

/// Task remote whose reachability is scripted, and which records the comment
/// mutations it was asked to perform.
private final class ScriptedTaskRemote: TaskDataSource, @unchecked Sendable {
    var reachable = true
    var comments: [Comment] = []
    private(set) var updateCommentCalls = 0
    private(set) var deleteCommentCalls = 0

    private func requireReachable() throws {
        if !reachable { throw APIError.networkError(URLError(.cannotConnectToHost)) }
    }

    private func unused() -> Error { APIError.serverError(500, "not part of this test") }

    func listTasks(queryItems: [URLQueryItem]) async throws -> TaskListResponse { throw unused() }
    func searchTasks(queryItems: [URLQueryItem]) async throws -> SearchTasksResponse { throw unused() }
    func getTask(id: Int) async throws -> TaskItem { throw unused() }
    func createTask(_ request: CreateTaskRequest) async throws -> TaskItem { throw unused() }
    func updateTask(id: Int, _ request: UpdateTaskRequest) async throws -> TaskItem { throw unused() }
    func deleteTask(id: Int) async throws { throw unused() }
    func bookmarkTask(id: Int) async throws -> TaskItem { throw unused() }
    func unbookmarkTask(id: Int) async throws -> TaskItem { throw unused() }

    func listComments(taskId: Int) async throws -> [Comment] {
        try requireReachable()
        return comments
    }

    func createComment(taskId: Int, _ request: CreateCommentRequest) async throws -> Comment {
        try requireReachable()
        return Comment(
            id: 900,
            issueId: taskId,
            bodyMd: request.bodyMd,
            createdAt: "2026-07-03T00:00:00.000Z",
            updatedAt: "2026-07-03T00:00:00.000Z"
        )
    }

    func updateComment(taskId: Int, commentId: Int, _ request: UpdateCommentRequest) async throws -> Comment {
        updateCommentCalls += 1
        try requireReachable()
        return Comment(
            id: commentId,
            issueId: taskId,
            bodyMd: request.bodyMd,
            createdAt: "2026-07-03T00:00:00.000Z",
            updatedAt: "2026-07-03T00:00:00.000Z"
        )
    }

    func deleteComment(taskId: Int, commentId: Int) async throws {
        deleteCommentCalls += 1
        try requireReachable()
    }
}

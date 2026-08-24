import XCTest
import GRDB
@testable import MemeGTD

/// Offline comment writes on tasks and articles: unlike the rest of their
/// content (read-only offline), comments fall back to the same local-write +
/// outbox path memo comments use (`CommentOutbox`) when the server is
/// unreachable, and reads fall back to the local mirror. The memo-side
/// behavior of the shared helper is covered by SyncConflictAndCommentTests.
final class OfflineCommentOutboxTests: XCTestCase {
    private var database: AppDatabase!

    override func setUpWithError() throws {
        database = try AppDatabase.makeInMemory()
    }

    private func seedRows() async throws {
        try await database.dbWriter.write { db in
            try IssueRecord(
                uuid: "task-1",
                serverId: 101,
                type: "task",
                title: "Fix login bug",
                bodyMd: "task body",
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
                bodyMd: "article body",
                createdAt: "2026-06-30T00:00:00.000Z",
                updatedAt: "2026-06-30T00:00:00.000Z"
            ).insert(db)
            // A synced comment on each parent, as the pull would seed them.
            try CommentRecord(
                uuid: "comment-1",
                serverId: 201,
                issueUuid: "task-1",
                bodyMd: "synced task comment",
                createdAt: "2026-07-01T10:00:00.000Z",
                updatedAt: "2026-07-01T10:00:00.000Z",
                serverUpdatedAt: "2026-07-01T10:00:00.000Z"
            ).insert(db)
            try CommentRecord(
                uuid: "comment-2",
                serverId: 202,
                issueUuid: "article-1",
                bodyMd: "synced article comment",
                createdAt: "2026-06-30T10:00:00.000Z",
                updatedAt: "2026-06-30T10:00:00.000Z",
                serverUpdatedAt: "2026-06-30T10:00:00.000Z"
            ).insert(db)
        }
    }

    private func pendingOps() async throws -> [PendingOperationRecord] {
        try await database.dbWriter.read { db in
            try PendingOperationRecord.fetchAll(db, sql: "SELECT * FROM pending_operations ORDER BY id ASC")
        }
    }

    // MARK: - Task comments

    func testTaskCommentCreateOfflineQueuesAndPokesScheduler() async throws {
        try await seedRows()
        var pokes = 0
        let dataSource = OfflineFirstTaskDataSource(
            database: database,
            remote: UnreachableTaskCommentRemote(),
            onLocalWrite: { pokes += 1 }
        )

        let comment = try await dataSource.createComment(
            taskId: 101, CreateCommentRequest(bodyMd: "offline task comment")
        )
        XCTAssertLessThan(comment.id, 0, "local-only rows surface -rowid ids")
        XCTAssertEqual(comment.issueId, 101)
        XCTAssertEqual(comment.bodyMd, "offline task comment")
        XCTAssertEqual(pokes, 1)

        let ops = try await pendingOps()
        XCTAssertEqual(ops.count, 1)
        XCTAssertEqual(ops[0].entity, "comment")
        XCTAssertEqual(ops[0].opType, "create")
        XCTAssertEqual(ops[0].issueUuid, "task-1", "op carries the PARENT task's uuid")

        // The offline read fallback lists it after the synced comment.
        let comments = try await dataSource.listComments(taskId: 101)
        XCTAssertEqual(comments.map(\.bodyMd), ["synced task comment", "offline task comment"])
    }

    func testTaskCommentUpdateOfflineMergesIntoQueuedCreate() async throws {
        try await seedRows()
        let dataSource = OfflineFirstTaskDataSource(
            database: database,
            remote: UnreachableTaskCommentRemote()
        )

        let created = try await dataSource.createComment(
            taskId: 101, CreateCommentRequest(bodyMd: "v1")
        )
        let updated = try await dataSource.updateComment(
            taskId: 101, commentId: created.id, UpdateCommentRequest(bodyMd: "v2")
        )
        XCTAssertEqual(updated.id, created.id)
        XCTAssertEqual(updated.bodyMd, "v2")

        // Outbox compression: still a single create op, now carrying v2.
        let ops = try await pendingOps()
        XCTAssertEqual(ops.map(\.opType), ["create"])
        XCTAssertTrue(ops[0].payload?.contains("v2") ?? false)
    }

    func testTaskCommentDeleteOfflineCancelsQueuedCreate() async throws {
        try await seedRows()
        let dataSource = OfflineFirstTaskDataSource(
            database: database,
            remote: UnreachableTaskCommentRemote()
        )

        let created = try await dataSource.createComment(
            taskId: 101, CreateCommentRequest(bodyMd: "never reaches the server")
        )
        try await dataSource.deleteComment(taskId: 101, commentId: created.id)

        let ops = try await pendingOps()
        XCTAssertTrue(ops.isEmpty, "create + delete while queued cancel each other")
        let comments = try await dataSource.listComments(taskId: 101)
        XCTAssertEqual(comments.map(\.bodyMd), ["synced task comment"])
    }

    func testSyncedTaskCommentUpdateAndDeleteOfflineEnqueue() async throws {
        try await seedRows()
        let dataSource = OfflineFirstTaskDataSource(
            database: database,
            remote: UnreachableTaskCommentRemote()
        )

        let updated = try await dataSource.updateComment(
            taskId: 101, commentId: 201, UpdateCommentRequest(bodyMd: "edited offline")
        )
        XCTAssertEqual(updated.id, 201)
        XCTAssertEqual(updated.bodyMd, "edited offline")

        try await dataSource.deleteComment(taskId: 101, commentId: 201)

        let ops = try await pendingOps()
        XCTAssertEqual(ops.map(\.opType), ["delete"], "the delete supersedes the queued update")
        XCTAssertEqual(ops[0].baseUpdatedAt, "2026-07-01T10:00:00.000Z", "edit-beats-delete base is the server timestamp")

        let comments = try await dataSource.listComments(taskId: 101)
        XCTAssertTrue(comments.isEmpty, "soft-deleted rows disappear from the list")
    }

    func testTaskCommentCreateOnUnmirroredTaskSurfacesNetworkError() async throws {
        try await seedRows()
        let dataSource = OfflineFirstTaskDataSource(
            database: database,
            remote: UnreachableTaskCommentRemote()
        )

        do {
            _ = try await dataSource.createComment(taskId: 999, CreateCommentRequest(bodyMd: "hi"))
            XCTFail("Expected the network error to surface")
        } catch is OfflineReadOnlyError {
            XCTFail("Comment writes must not be translated into the read-only error")
        } catch {
            // Expected: the original APIError.networkError surfaces.
        }
    }

    // MARK: - Article comments

    func testArticleCommentsReadAndWriteOffline() async throws {
        try await seedRows()
        var pokes = 0
        let dataSource = OfflineFirstArticleDataSource(
            database: database,
            remote: UnreachableArticleCommentRemote(),
            onLocalWrite: { pokes += 1 }
        )

        // Reads fall back to the local mirror (this used to throw
        // OfflineReadOnlyError, unlike the task data source).
        let before = try await dataSource.listComments(articleId: 301)
        XCTAssertEqual(before.map(\.bodyMd), ["synced article comment"])

        let comment = try await dataSource.createComment(
            articleId: 301, CreateCommentRequest(bodyMd: "offline article comment")
        )
        XCTAssertLessThan(comment.id, 0)
        XCTAssertEqual(pokes, 1)

        let ops = try await pendingOps()
        XCTAssertEqual(ops.map(\.entity), ["comment"])
        XCTAssertEqual(ops[0].issueUuid, "article-1")

        let after = try await dataSource.listComments(articleId: 301)
        XCTAssertEqual(after.map(\.bodyMd), ["synced article comment", "offline article comment"])

        // Update + delete of the synced comment queue like on tasks.
        _ = try await dataSource.updateComment(
            articleId: 301, commentId: 202, UpdateCommentRequest(bodyMd: "edited offline")
        )
        try await dataSource.deleteComment(articleId: 301, commentId: 202)
        let finalOps = try await pendingOps()
        XCTAssertEqual(finalOps.map(\.opType), ["create", "delete"])
    }

    func testArticleCommentsOnUnmirroredArticleSurfaceNetworkError() async throws {
        let dataSource = OfflineFirstArticleDataSource(
            database: database,
            remote: UnreachableArticleCommentRemote()
        )

        do {
            _ = try await dataSource.listComments(articleId: 999)
            XCTFail("Expected the network error to surface")
        } catch is OfflineReadOnlyError {
            XCTFail("Comment reads must not be translated into the read-only error")
        } catch {
            // Expected: the original APIError.networkError surfaces.
        }
    }
}

// MARK: - Test doubles

private struct UnreachableTaskCommentRemote: TaskDataSource {
    private func fail() -> Error { APIError.networkError(URLError(.notConnectedToInternet)) }
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

private struct UnreachableArticleCommentRemote: ArticleDataSource {
    private func fail() -> Error { APIError.networkError(URLError(.notConnectedToInternet)) }
    func listArticles(queryItems: [URLQueryItem]) async throws -> ArticleListResponse { throw fail() }
    func searchArticles(queryItems: [URLQueryItem]) async throws -> SearchArticlesResponse { throw fail() }
    func getArticle(id: Int) async throws -> Article { throw fail() }
    func deleteArticle(id: Int) async throws { throw fail() }
    func listComments(articleId: Int) async throws -> [Comment] { throw fail() }
    func createComment(articleId: Int, _ request: CreateCommentRequest) async throws -> Comment { throw fail() }
    func updateComment(articleId: Int, commentId: Int, _ request: UpdateCommentRequest) async throws -> Comment { throw fail() }
    func deleteComment(articleId: Int, commentId: Int) async throws { throw fail() }
}

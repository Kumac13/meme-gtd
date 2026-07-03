import XCTest
import GRDB
@testable import MemeGTD

/// Phase 7 read-cache behavior: tasks / articles / projects fall back to the
/// local GRDB mirror when the server is unreachable, refuse writes offline
/// with `OfflineReadOnlyError`, and projects keep a snapshot cache written on
/// every successful online fetch.
final class OfflineFirstReadCacheTests: XCTestCase {
    private var database: AppDatabase!

    override func setUpWithError() throws {
        database = try AppDatabase.makeInMemory()
    }

    /// The error the real APIClient surfaces when the server is unreachable.
    private static func unreachable() -> Error {
        APIError.networkError(URLError(.notConnectedToInternet))
    }

    // MARK: - Seeding helpers

    private func seedTaskRows() async throws {
        try await database.dbWriter.write { db in
            // Synced task, bookmarked, labeled, one comment.
            try IssueRecord(
                uuid: "task-1",
                serverId: 101,
                type: "task",
                title: "Fix login bug",
                bodyMd: "task one body",
                status: "next",
                taskKind: "action",
                isBookmarked: true,
                createdAt: "2026-07-01T00:00:00.000Z",
                updatedAt: "2026-07-02T00:00:00.000Z"
            ).insert(db)
            try IssueRecord(
                uuid: "task-2",
                serverId: 102,
                type: "task",
                title: "Write release notes",
                bodyMd: "task two body",
                status: "done",
                taskKind: "action",
                createdAt: "2026-07-01T01:00:00.000Z",
                updatedAt: "2026-07-01T01:00:00.000Z"
            ).insert(db)
            // Rows the task list must never surface: another type, a deleted task.
            try IssueRecord(
                uuid: "memo-1",
                serverId: 103,
                type: "memo",
                bodyMd: "memo body",
                createdAt: "2026-07-01T02:00:00.000Z",
                updatedAt: "2026-07-01T02:00:00.000Z"
            ).insert(db)
            try IssueRecord(
                uuid: "task-3",
                serverId: 104,
                type: "task",
                title: "Deleted task",
                bodyMd: "",
                status: "open",
                isDeleted: true,
                createdAt: "2026-07-01T03:00:00.000Z",
                updatedAt: "2026-07-01T03:00:00.000Z"
            ).insert(db)

            try LabelRecord(
                name: "bug",
                serverId: 1,
                description: nil,
                createdAt: "2026-06-01T00:00:00.000Z"
            ).insert(db)
            try IssueLabelRecord(issueUuid: "task-1", labelName: "bug").insert(db)

            try CommentRecord(
                uuid: "comment-1",
                serverId: 201,
                issueUuid: "task-1",
                bodyMd: "first comment",
                createdAt: "2026-07-01T10:00:00.000Z",
                updatedAt: "2026-07-01T10:00:00.000Z",
                serverUpdatedAt: "2026-07-01T10:00:00.000Z"
            ).insert(db)
            try CommentRecord(
                uuid: "comment-2",
                serverId: 202,
                issueUuid: "task-1",
                bodyMd: "second comment",
                createdAt: "2026-07-01T11:00:00.000Z",
                updatedAt: "2026-07-01T11:00:00.000Z",
                serverUpdatedAt: "2026-07-01T11:00:00.000Z"
            ).insert(db)
        }
    }

    private func seedArticleRow() async throws {
        try await database.dbWriter.write { db in
            try IssueRecord(
                uuid: "article-1",
                serverId: 301,
                type: "article",
                title: "Interesting article",
                bodyMd: "long archived haystack content",
                meta: """
                    {"originalUrl":"https://example.com/post","siteName":"Example","archivedAt":"2026-06-30T00:00:00.000Z"}
                    """,
                createdAt: "2026-06-30T00:00:00.000Z",
                updatedAt: "2026-06-30T00:00:00.000Z"
            ).insert(db)
        }
    }

    // MARK: - Task read fallback

    func testListTasksFallsBackToLocalAndAppliesFilters() async throws {
        try await seedTaskRows()
        let dataSource = OfflineFirstTaskDataSource(
            database: database,
            remote: UnreachableTaskRemote()
        )

        // Unfiltered: both live tasks, updated_at DESC, no memo/deleted rows.
        let all = try await dataSource.listTasks(queryItems: [])
        XCTAssertEqual(all.data.map(\.id), [101, 102])
        XCTAssertEqual(all.total, 2)
        XCTAssertEqual(all.data[0].labels, ["bug"])
        XCTAssertEqual(all.data[0].commentCount, 2)
        XCTAssertEqual(all.data[0].title, "Fix login bug")

        // Status filter.
        let next = try await dataSource.listTasks(queryItems: [
            URLQueryItem(name: "status", value: "next"),
        ])
        XCTAssertEqual(next.data.map(\.id), [101])

        // Bookmark filter.
        let bookmarked = try await dataSource.listTasks(queryItems: [
            URLQueryItem(name: "bookmarked", value: "true"),
        ])
        XCTAssertEqual(bookmarked.data.map(\.id), [101])

        // Label filter (OR list).
        let labeled = try await dataSource.listTasks(queryItems: [
            URLQueryItem(name: "label", value: "bug,enhancement"),
        ])
        XCTAssertEqual(labeled.data.map(\.id), [101])

        // Search mirrors the server: title LIKE substring.
        let searched = try await dataSource.listTasks(queryItems: [
            URLQueryItem(name: "search", value: "release"),
        ])
        XCTAssertEqual(searched.data.map(\.id), [102])

        // Pagination.
        let page = try await dataSource.listTasks(queryItems: [
            URLQueryItem(name: "limit", value: "1"),
            URLQueryItem(name: "offset", value: "1"),
        ])
        XCTAssertEqual(page.data.map(\.id), [102])
        XCTAssertEqual(page.total, 2)
    }

    func testListTasksWithProjectFilterReturnsEmptyPageOffline() async throws {
        try await seedTaskRows()
        let dataSource = OfflineFirstTaskDataSource(
            database: database,
            remote: UnreachableTaskRemote()
        )

        // Project membership has no full local mirror: offline, the honest
        // answer is an empty page (same rule as memos).
        let filtered = try await dataSource.listTasks(queryItems: [
            URLQueryItem(name: "projectId", value: "1"),
        ])
        XCTAssertTrue(filtered.data.isEmpty)
        XCTAssertEqual(filtered.total, 0)
    }

    func testGetTaskAndCommentsFallBackToLocal() async throws {
        try await seedTaskRows()
        let dataSource = OfflineFirstTaskDataSource(
            database: database,
            remote: UnreachableTaskRemote()
        )

        let task = try await dataSource.getTask(id: 101)
        XCTAssertEqual(task.title, "Fix login bug")
        XCTAssertEqual(task.status, "next")
        XCTAssertTrue(task.isBookmarked)
        XCTAssertEqual(task.labels, ["bug"])

        let comments = try await dataSource.listComments(taskId: 101)
        XCTAssertEqual(comments.map(\.id), [201, 202], "created_at ASC, like the server")
        XCTAssertEqual(comments.map(\.bodyMd), ["first comment", "second comment"])

        // searchTasks (slim link-picker shape) uses the same fallback.
        let search = try await dataSource.searchTasks(queryItems: [
            URLQueryItem(name: "search", value: "login"),
        ])
        XCTAssertEqual(search.data.map(\.id), [101])

        // A task that is not mirrored locally keeps failing (no invented rows).
        do {
            _ = try await dataSource.getTask(id: 999)
            XCTFail("Expected the network error to surface")
        } catch is OfflineReadOnlyError {
            XCTFail("Reads must not be translated into the read-only error")
        } catch {
            // Expected: the original APIError.networkError surfaces.
        }
    }

    // MARK: - Task writes offline

    func testTaskWritesThrowOfflineReadOnlyErrorOffline() async throws {
        try await seedTaskRows()
        let dataSource = OfflineFirstTaskDataSource(
            database: database,
            remote: UnreachableTaskRemote()
        )

        do {
            _ = try await dataSource.createTask(CreateTaskRequest(
                title: "new", bodyMd: nil, status: nil, taskKind: nil,
                scheduledStart: nil, scheduledEnd: nil, isAllDay: nil
            ))
            XCTFail("Expected OfflineReadOnlyError")
        } catch is OfflineReadOnlyError {}

        do {
            _ = try await dataSource.updateTask(id: 101, UpdateTaskRequest(
                title: nil, bodyMd: nil, status: "done"
            ))
            XCTFail("Expected OfflineReadOnlyError")
        } catch is OfflineReadOnlyError {}

        do {
            try await dataSource.deleteTask(id: 101)
            XCTFail("Expected OfflineReadOnlyError")
        } catch is OfflineReadOnlyError {}

        do {
            _ = try await dataSource.bookmarkTask(id: 102)
            XCTFail("Expected OfflineReadOnlyError")
        } catch is OfflineReadOnlyError {}

        do {
            _ = try await dataSource.createComment(taskId: 101, CreateCommentRequest(bodyMd: "hi"))
            XCTFail("Expected OfflineReadOnlyError")
        } catch is OfflineReadOnlyError {}

        // The local mirror stays untouched by refused writes.
        let count = try await database.dbWriter.read { db in
            try Int.fetchOne(db, sql: "SELECT COUNT(*) FROM issues WHERE type = 'task' AND is_deleted = 0") ?? -1
        }
        XCTAssertEqual(count, 2)
    }

    // MARK: - Article read fallback

    func testArticlesFallBackToLocalWithMetaAndRefuseDeleteOffline() async throws {
        try await seedArticleRow()
        let dataSource = OfflineFirstArticleDataSource(
            database: database,
            remote: UnreachableArticleRemote()
        )

        let list = try await dataSource.listArticles(queryItems: [])
        XCTAssertEqual(list.data.map(\.id), [301])
        XCTAssertEqual(list.total, 1)
        XCTAssertEqual(list.data[0].title, "Interesting article")
        XCTAssertEqual(list.data[0].meta?.originalUrl, "https://example.com/post")
        XCTAssertEqual(list.data[0].meta?.siteName, "Example")

        // search mirrors the server: title OR body LIKE.
        let hit = try await dataSource.listArticles(queryItems: [
            URLQueryItem(name: "search", value: "haystack"),
        ])
        XCTAssertEqual(hit.data.count, 1)
        let miss = try await dataSource.listArticles(queryItems: [
            URLQueryItem(name: "search", value: "no-such-text"),
        ])
        XCTAssertTrue(miss.data.isEmpty)

        let article = try await dataSource.getArticle(id: 301)
        XCTAssertEqual(article.bodyMd, "long archived haystack content")

        do {
            try await dataSource.deleteArticle(id: 301)
            XCTFail("Expected OfflineReadOnlyError")
        } catch is OfflineReadOnlyError {}
    }

    // MARK: - Project snapshot cache

    private static func project(id: Int, name: String, createdAt: String) -> Project {
        Project(
            id: id,
            name: name,
            description: nil,
            status: "active",
            startDate: nil,
            endDate: nil,
            createdAt: createdAt
        )
    }

    func testProjectsSnapshotSavedOnlineAndReadOffline() async throws {
        let remote = MockProjectRemote()
        let dataSource = OfflineFirstProjectDataSource(database: database, remote: remote)

        remote.projects = [
            Self.project(id: 1, name: "Alpha", createdAt: "2026-06-01T00:00:00.000Z"),
            Self.project(id: 2, name: "Beta", createdAt: "2026-06-02T00:00:00.000Z"),
        ]
        let online = try await dataSource.listProjects()
        XCTAssertEqual(online.map(\.id), [1, 2])

        // Offline: the snapshot answers, in the server's created_at DESC order.
        remote.failing = true
        let offline = try await dataSource.listProjects()
        XCTAssertEqual(offline.map(\.id), [2, 1])
        XCTAssertEqual(offline.map(\.name), ["Beta", "Alpha"])

        // A later successful fetch REPLACES the snapshot (projects hard-delete
        // server-side, so removed ones must disappear from the cache too).
        remote.failing = false
        remote.projects = [Self.project(id: 2, name: "Beta", createdAt: "2026-06-02T00:00:00.000Z")]
        _ = try await dataSource.listProjects()
        remote.failing = true
        let afterReplace = try await dataSource.listProjects()
        XCTAssertEqual(afterReplace.map(\.id), [2])
    }

    func testIssueProjectsCachedPerIssueAndReadOffline() async throws {
        let remote = MockProjectRemote()
        let dataSource = OfflineFirstProjectDataSource(database: database, remote: remote)

        remote.issueProjects = [
            101: [Self.project(id: 1, name: "Alpha", createdAt: "2026-06-01T00:00:00.000Z")],
        ]
        let online = try await dataSource.listIssueProjects(issueId: 101)
        XCTAssertEqual(online.map(\.id), [1])

        remote.failing = true
        let offline = try await dataSource.listIssueProjects(issueId: 101)
        XCTAssertEqual(offline.map(\.name), ["Alpha"])

        // Memberships were never fetched for this issue: nothing cached.
        let unknown = try await dataSource.listIssueProjects(issueId: 555)
        XCTAssertTrue(unknown.isEmpty)

        // Local-only ids (negative) never exist server-side.
        let localOnly = try await dataSource.listIssueProjects(issueId: -3)
        XCTAssertTrue(localOnly.isEmpty)
    }

    func testProjectWritesThrowOfflineReadOnlyErrorOffline() async throws {
        let remote = MockProjectRemote()
        remote.failing = true
        let dataSource = OfflineFirstProjectDataSource(database: database, remote: remote)

        do {
            _ = try await dataSource.addProjectItem(projectId: 1, AddProjectItemRequest(issueId: 101))
            XCTFail("Expected OfflineReadOnlyError")
        } catch is OfflineReadOnlyError {}

        do {
            try await dataSource.removeProjectItem(projectId: 1, issueId: 101)
            XCTFail("Expected OfflineReadOnlyError")
        } catch is OfflineReadOnlyError {}
    }
}

// MARK: - Test doubles

/// Remote stubs that fail every call with the same error the real APIClient
/// throws when the server is unreachable, so the fallback paths are exercised
/// exactly as in the field.
private struct UnreachableTaskRemote: TaskDataSource {
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

private struct UnreachableArticleRemote: ArticleDataSource {
    private func fail() -> Error { APIError.networkError(URLError(.notConnectedToInternet)) }
    func listArticles(queryItems: [URLQueryItem]) async throws -> ArticleListResponse { throw fail() }
    func searchArticles(queryItems: [URLQueryItem]) async throws -> SearchArticlesResponse { throw fail() }
    func getArticle(id: Int) async throws -> Article { throw fail() }
    func deleteArticle(id: Int) async throws { throw fail() }
}

/// Scriptable project remote: `failing` toggles between "online" (returns the
/// scripted values) and "unreachable" (throws the APIClient network error).
private final class MockProjectRemote: ProjectDataSource, @unchecked Sendable {
    var failing = false
    var projects: [Project] = []
    var issueProjects: [Int: [Project]] = [:]

    private func failIfOffline() throws {
        if failing { throw APIError.networkError(URLError(.notConnectedToInternet)) }
    }

    func listProjects() async throws -> [Project] {
        try failIfOffline()
        return projects
    }

    func listIssueProjects(issueId: Int) async throws -> [Project] {
        try failIfOffline()
        return issueProjects[issueId] ?? []
    }

    func addProjectItem(projectId: Int, _ request: AddProjectItemRequest) async throws -> ProjectItem {
        try failIfOffline()
        return ProjectItem(
            id: 1,
            projectId: projectId,
            issueId: request.issueId,
            position: 0,
            createdAt: "2026-07-01T00:00:00.000Z",
            updatedAt: "2026-07-01T00:00:00.000Z"
        )
    }

    func removeProjectItem(projectId: Int, issueId: Int) async throws {
        try failIfOffline()
    }
}

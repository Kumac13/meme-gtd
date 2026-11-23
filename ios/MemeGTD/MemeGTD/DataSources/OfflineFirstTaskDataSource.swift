import Foundation
import GRDB

/// 同期済みの本文・コメントを端末から読み、記録を永続キューに追加する。
nonisolated final class OfflineFirstTaskDataSource: TaskDataSource {
    private let threads: OfflineThreadStore
    private let database: AppDatabase
    private let remote: TaskDataSource

    private let onLocalWrite: () -> Void

    init(database: AppDatabase, remote: TaskDataSource, onLocalWrite: @escaping () -> Void = {}) {
        self.onLocalWrite = onLocalWrite
        self.threads = OfflineThreadStore(database: database, onLocalWrite: onLocalWrite)
        self.database = database
        self.remote = remote
    }

    // MARK: - Reads (remote first, local fallback)

    func listTasks(queryItems: [URLQueryItem]) async throws -> TaskListResponse {
        let supported = ["limit", "offset", "label", "status", "bookmarked", "search", "scheduledFrom", "scheduledTo"]
        if queryItems.allSatisfy({ supported.contains($0.name) }) {
            let local = try await localListTasks(queryItems: queryItems)
            if local.total > 0 || database.hasCompletedPull { return local }
        }
        do {
            return try await remote.listTasks(queryItems: queryItems)
        } catch where OfflineFirstSupport.isNetworkError(error) {
            return try await localListTasks(queryItems: queryItems)
        }
    }

    func searchTasks(queryItems: [URLQueryItem]) async throws -> SearchTasksResponse {
        do {
            return try await remote.searchTasks(queryItems: queryItems)
        } catch where OfflineFirstSupport.isNetworkError(error) {
            let list = try await localListTasks(queryItems: queryItems)
            return SearchTasksResponse(
                data: list.data.map {
                    SearchTaskItem(
                        id: $0.id,
                        type: $0.type,
                        title: $0.title,
                        status: $0.status,
                        updatedAt: $0.updatedAt
                    )
                },
                total: list.total,
                limit: list.limit,
                offset: list.offset
            )
        }
    }

    func getTask(id: Int) async throws -> TaskItem {
        if let local = try await database.dbWriter.read({ db -> TaskItem? in
            guard let row = try LocalTaskStore.fetchTaskRow(db, id: id) else { return nil }
            return try LocalTaskStore.taskItem(from: row, db: db)
        }) { return local }
        return try await threads.loadBeforeInitialPull(kind: "task", id: id) { try await remote.getTask(id: id) }
    }

    func listComments(taskId: Int) async throws -> [Comment] {
        try await threads.comments(id: taskId) { try await remote.listComments(taskId: taskId) }
    }

    // MARK: - Writes (online only)

    func createTask(_ request: CreateTaskRequest) async throws -> TaskItem {
        try await onlineOnly { try await self.remote.createTask(request) }
    }

    func updateTask(id: Int, _ request: UpdateTaskRequest) async throws -> TaskItem {
        try await onlineOnly { try await self.remote.updateTask(id: id, request) }
    }

    func archiveToArticle(id: Int) async throws -> Int {
        try await onlineOnly { try await self.remote.archiveToArticle(id: id) }
    }

    func transferToMemo(id: Int) async throws -> Int {
        try await onlineOnly { try await self.remote.transferToMemo(id: id) }
    }

    func deleteTask(id: Int) async throws {
        try await onlineOnly { try await self.remote.deleteTask(id: id) }
    }

    func bookmarkTask(id: Int) async throws -> TaskItem {
        try await onlineOnly { try await self.remote.bookmarkTask(id: id) }
    }

    func unbookmarkTask(id: Int) async throws -> TaskItem {
        try await onlineOnly { try await self.remote.unbookmarkTask(id: id) }
    }

    func createComment(taskId: Int, _ request: CreateCommentRequest) async throws -> Comment {
        try await threads.add(id: taskId, body: request.bodyMd)
    }

    func updateComment(taskId: Int, commentId: Int, _ request: UpdateCommentRequest) async throws -> Comment {
        let parent = try await threads.serverIssueID(taskId)
        let resolved = try await threads.serverCommentID(commentId, parentID: parent)
        return try await onlineOnly { try await self.remote.updateComment(taskId: parent, commentId: resolved, request) }
    }

    func deleteComment(taskId: Int, commentId: Int) async throws {
        let parent = try await threads.serverIssueID(taskId)
        let resolved = try await threads.serverCommentID(commentId, parentID: parent)
        return try await onlineOnly { try await self.remote.deleteComment(taskId: parent, commentId: resolved) }
    }

    /// Delegates a write to the server, translating "unreachable" into the
    /// user-facing read-only error.
    private func onlineOnly<T>(_ operation: () async throws -> T) async throws -> T {
        do {
            let result = try await operation()
            onLocalWrite()
            return result
        } catch where OfflineFirstSupport.isNetworkError(error) {
            throw OfflineReadOnlyError()
        }
    }

    // MARK: - Local list query

    private func localListTasks(queryItems: [URLQueryItem]) async throws -> TaskListResponse {
        let query = LocalTaskStore.ListQuery(queryItems: queryItems)

        // Project membership is only cached per opened issue (see
        // OfflineFirstProjectDataSource), never for the whole task list, so a
        // projectId filter cannot be answered correctly offline. An empty
        // page is the honest answer (same rule as OfflineFirstMemoDataSource;
        // ignoring the filter would show wrong contents).
        if query.hasProjectFilter {
            return query.emptyPage
        }

        return try await database.dbWriter.read { db in
            try LocalTaskStore.listTasks(db, query: query)
        }
    }
}

import Foundation
import GRDB

/// Offline-first `TaskDataSource` (offline support plan Phase 7), active only
/// while the "Offline Sync (Beta)" setting is on.
///
/// Unlike memos, the task CONTENT is READ-ONLY offline:
/// - READS go to the server first; when the server is unreachable
///   (`APIError.networkError`) they fall back to the local GRDB mirror, which
///   the sync pull keeps seeded with task rows. The local read itself lives
///   in `LocalTaskStore` (shared with the Standalone `LocalTaskDataSource`).
/// - TASK WRITES are delegated to the server; when it is unreachable they
///   throw `OfflineReadOnlyError` instead of queueing (tasks have no outbox
///   path).
/// - COMMENTS are the exception: they are remote-first (so the online
///   behavior — server-side `#id` mention rewriting included — is unchanged),
///   but when the server is unreachable they fall back to the same
///   local-write + outbox path memo comments use (`CommentOutbox`), and sync
///   pushes them on recovery. Comment ops on a local-only comment (negative
///   id, queued create) skip the server entirely — it has no server identity
///   to address.
///
/// Successful remote list/detail responses are NOT written back into the
/// local `issues` table: rows there carry sync bookkeeping (uuid,
/// server_updated_at, server_seq) that a REST response does not, so an upsert
/// here could disagree with the pull cursor and clobber sync state. The pull
/// already carries every issue type, which keeps the cache fresh enough for a
/// read-only fallback. Only projects/project_items (see
/// OfflineFirstProjectDataSource) maintain an explicit response cache,
/// because they are not part of the change feed at all.
///
/// Identity follows the app-wide convention: synced rows surface
/// `id == server_id`; rows only exist locally via the pull, so negative
/// (-rowid) ids never occur for tasks in practice but are resolved anyway.
nonisolated final class OfflineFirstTaskDataSource: TaskDataSource {
    private let database: AppDatabase
    private let remote: TaskDataSource
    private let onLocalWrite: () -> Void

    init(
        database: AppDatabase,
        remote: TaskDataSource,
        onLocalWrite: @escaping () -> Void = {}
    ) {
        self.database = database
        self.remote = remote
        self.onLocalWrite = onLocalWrite
    }

    // MARK: - Reads (remote first, local fallback)

    func listTasks(queryItems: [URLQueryItem]) async throws -> TaskListResponse {
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
        do {
            return try await remote.getTask(id: id)
        } catch where OfflineFirstSupport.isNetworkError(error) {
            let local: TaskItem? = try await database.dbWriter.read { db in
                guard let row = try LocalTaskStore.fetchTaskRow(db, id: id) else { return nil }
                return try LocalTaskStore.taskItem(from: row, db: db)
            }
            guard let local else { throw error }
            return local
        }
    }

    func listComments(taskId: Int) async throws -> [Comment] {
        do {
            return try await remote.listComments(taskId: taskId)
        } catch where OfflineFirstSupport.isNetworkError(error) {
            let local: [Comment]? = try await database.dbWriter.read { db in
                guard let taskRow = try LocalTaskStore.fetchTaskRow(db, id: taskId) else { return nil }
                let taskUuid: String = taskRow["uuid"]
                // Same order the server uses: created_at ASC, deleted rows
                // excluded.
                return try LocalCommentStore.listComments(db, issueUuid: taskUuid, issueId: taskId)
            }
            guard let local else { throw error }
            return local
        }
    }

    // MARK: - Writes (online only)

    func createTask(_ request: CreateTaskRequest) async throws -> TaskItem {
        try await onlineOnly { try await self.remote.createTask(request) }
    }

    func updateTask(id: Int, _ request: UpdateTaskRequest) async throws -> TaskItem {
        try await onlineOnly { try await self.remote.updateTask(id: id, request) }
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

    // MARK: - Comments (remote first, outbox fallback offline)

    func createComment(taskId: Int, _ request: CreateCommentRequest) async throws -> Comment {
        do {
            return try await remote.createComment(taskId: taskId, request)
        } catch where OfflineFirstSupport.isNetworkError(error) {
            let local: Comment? = try await database.dbWriter.write { db in
                guard let taskRow = try LocalTaskStore.fetchTaskRow(db, id: taskId) else { return nil }
                let taskUuid: String = taskRow["uuid"]
                return try CommentOutbox.createComment(
                    db,
                    issueUuid: taskUuid,
                    issueId: taskId,
                    bodyMd: request.bodyMd
                )
            }
            // A task that is not mirrored locally has no uuid to attach the
            // comment to: surface the original network error.
            guard let local else { throw error }
            onLocalWrite()
            return local
        }
    }

    func updateComment(taskId: Int, commentId: Int, _ request: UpdateCommentRequest) async throws -> Comment {
        if commentId < 0 {
            return try await localCommentUpdate(taskId: taskId, commentId: commentId, bodyMd: request.bodyMd)
        }
        do {
            return try await remote.updateComment(taskId: taskId, commentId: commentId, request)
        } catch where OfflineFirstSupport.isNetworkError(error) {
            do {
                return try await localCommentUpdate(taskId: taskId, commentId: commentId, bodyMd: request.bodyMd)
            } catch is LocalMemoError {
                throw error
            }
        }
    }

    func deleteComment(taskId: Int, commentId: Int) async throws {
        if commentId < 0 {
            try await localCommentDelete(taskId: taskId, commentId: commentId)
            return
        }
        do {
            try await remote.deleteComment(taskId: taskId, commentId: commentId)
        } catch where OfflineFirstSupport.isNetworkError(error) {
            do {
                try await localCommentDelete(taskId: taskId, commentId: commentId)
            } catch is LocalMemoError {
                throw error
            }
        }
    }

    private func localCommentUpdate(taskId: Int, commentId: Int, bodyMd: String) async throws -> Comment {
        let updated: Comment = try await database.dbWriter.write { db in
            guard let taskRow = try LocalTaskStore.fetchTaskRow(db, id: taskId) else {
                throw LocalMemoError.commentNotFound
            }
            let taskUuid: String = taskRow["uuid"]
            return try CommentOutbox.updateComment(
                db,
                issueUuid: taskUuid,
                issueId: taskId,
                commentId: commentId,
                bodyMd: bodyMd
            )
        }
        onLocalWrite()
        return updated
    }

    private func localCommentDelete(taskId: Int, commentId: Int) async throws {
        try await database.dbWriter.write { db in
            guard let taskRow = try LocalTaskStore.fetchTaskRow(db, id: taskId) else {
                throw LocalMemoError.commentNotFound
            }
            let taskUuid: String = taskRow["uuid"]
            try CommentOutbox.deleteComment(db, issueUuid: taskUuid, commentId: commentId)
        }
        onLocalWrite()
    }

    /// Delegates a write to the server, translating "unreachable" into the
    /// user-facing read-only error.
    private func onlineOnly<T>(_ operation: () async throws -> T) async throws -> T {
        do {
            return try await operation()
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

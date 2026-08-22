import Foundation
import GRDB

/// Offline-first `TaskDataSource` (offline support plan Phase 7), active only
/// while the "Offline Sync (Beta)" setting is on.
///
/// Unlike memos, the task itself is READ-ONLY offline — its COMMENTS are not:
/// - READS go to the server first; when the server is unreachable
///   (`APIError.networkError`) they fall back to the local GRDB mirror, which
///   the sync pull keeps seeded with task rows. The local read itself lives
///   in `LocalTaskStore` (shared with the Standalone `LocalTaskDataSource`).
/// - WRITES on the task (title, body, status, bookmark, delete) are delegated
///   to the server; when it is unreachable they throw `OfflineReadOnlyError`
///   instead of queueing (the task fields have no outbox path).
/// - COMMENT writes DO queue: the sync protocol resolves a comment through
///   its parent's uuid regardless of issue type, so an offline comment on a
///   mirrored task goes through `CommentOutbox` exactly like a memo comment
///   and pushes on the next sync. Online they still go straight to the server
///   (unchanged behavior); only an unreachable server takes the outbox path,
///   which keeps the double-write window to "the request reached the server
///   but its response was lost".
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
            let comments = try await remote.listComments(taskId: taskId)
            return try await withPendingComments(comments, taskId: taskId)
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

    // MARK: - Comment writes (server first, outbox when unreachable)

    func createComment(taskId: Int, _ request: CreateCommentRequest) async throws -> Comment {
        do {
            return try await remote.createComment(taskId: taskId, request)
        } catch where OfflineFirstSupport.isNetworkError(error) {
            let now = ISO8601Millis.now()
            let comment = try await database.dbWriter.write { db -> Comment in
                let issueUuid = try Self.mirroredTaskUuid(db, taskId: taskId)
                return try CommentOutbox.create(
                    db,
                    issueUuid: issueUuid,
                    issueId: taskId,
                    bodyMd: request.bodyMd,
                    now: now
                )
            }
            onLocalWrite()
            return comment
        }
    }

    func updateComment(taskId: Int, commentId: Int, _ request: UpdateCommentRequest) async throws -> Comment {
        // A negative id is a comment written offline that has not been pushed
        // yet: the server has no id for it, so the edit stays in the outbox
        // even when the server is reachable again.
        if commentId < 0 {
            return try await queueCommentUpdate(taskId: taskId, commentId: commentId, bodyMd: request.bodyMd)
        }
        do {
            return try await remote.updateComment(taskId: taskId, commentId: commentId, request)
        } catch where OfflineFirstSupport.isNetworkError(error) {
            return try await queueCommentUpdate(taskId: taskId, commentId: commentId, bodyMd: request.bodyMd)
        }
    }

    func deleteComment(taskId: Int, commentId: Int) async throws {
        if commentId < 0 {
            try await queueCommentDelete(taskId: taskId, commentId: commentId)
            return
        }
        do {
            try await remote.deleteComment(taskId: taskId, commentId: commentId)
        } catch where OfflineFirstSupport.isNetworkError(error) {
            try await queueCommentDelete(taskId: taskId, commentId: commentId)
        }
    }

    private func queueCommentUpdate(taskId: Int, commentId: Int, bodyMd: String) async throws -> Comment {
        let now = ISO8601Millis.now()
        let comment = try await database.dbWriter.write { db -> Comment in
            let issueUuid = try Self.mirroredTaskUuid(db, taskId: taskId)
            return try CommentOutbox.update(
                db,
                issueUuid: issueUuid,
                issueId: taskId,
                commentId: commentId,
                bodyMd: bodyMd,
                now: now
            )
        }
        onLocalWrite()
        return comment
    }

    private func queueCommentDelete(taskId: Int, commentId: Int) async throws {
        let now = ISO8601Millis.now()
        try await database.dbWriter.write { db in
            let issueUuid = try Self.mirroredTaskUuid(db, taskId: taskId)
            try CommentOutbox.delete(db, issueUuid: issueUuid, commentId: commentId, now: now)
        }
        onLocalWrite()
    }

    /// The parent's sync identity, or the read-only error: a task the pull has
    /// not mirrored yet has no uuid to hang a comment on, so it stays fully
    /// read-only offline like every other unmirrored row. Throwing from inside
    /// the write block rolls the transaction back untouched.
    private static func mirroredTaskUuid(_ db: Database, taskId: Int) throws -> String {
        guard let row = try LocalTaskStore.fetchTaskRow(db, id: taskId) else {
            throw OfflineReadOnlyError()
        }
        let uuid: String = row["uuid"]
        return uuid
    }

    /// Appends comments written offline that the server cannot know about yet,
    /// so a queued comment stays on the timeline once connectivity returns.
    /// They are the newest by construction, which is where the server's
    /// `created_at ASC` order puts them anyway.
    private func withPendingComments(_ comments: [Comment], taskId: Int) async throws -> [Comment] {
        let pending = try await database.dbWriter.read { db -> [Comment] in
            guard let row = try LocalTaskStore.fetchTaskRow(db, id: taskId) else { return [] }
            let issueUuid: String = row["uuid"]
            return try CommentOutbox.pendingComments(db, issueUuid: issueUuid, issueId: taskId)
        }
        return pending.isEmpty ? comments : comments + pending
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

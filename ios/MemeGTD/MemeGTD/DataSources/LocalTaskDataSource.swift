import Foundation
import GRDB

/// Standalone-mode `TaskDataSource` (offline support plan Phase 9), active
/// while Storage Mode is "Standalone".
///
/// Every read and write goes straight to the local GRDB database through
/// `LocalTaskStore` / `LocalCommentStore` — there is NO outbox and NO server
/// communication, so the app works with no API URL configured and with
/// networking fully cut off.
///
/// Server semantics mirrored here (packages/db/src/taskRepository.ts +
/// packages/api/src/schemas/taskSchemas.ts):
/// - create defaults: status 'inbox', taskKind 'action', bodyMd '';
///   creating directly in 'next' stamps actual_start
/// - status transitions: → 'done' stamps actual_end, → 'next' stamps
///   actual_start and clears actual_end (there is no other transition
///   restriction on the server; any status may move to any other)
/// - deletes are HARD deletes (same reasoning as `LocalMemoDataSource`:
///   nothing ever syncs, so a tombstone would never be purged), dropping
///   comments / label assignments / links with the row
///
/// Not available in this mode:
/// - projectId list filters: project membership has no local data in
///   Standalone, so a filtered request answers an honest empty page.
nonisolated final class LocalTaskDataSource: TaskDataSource {
    private let database: AppDatabase

    init(database: AppDatabase) {
        self.database = database
    }

    // MARK: - List / search

    func listTasks(queryItems: [URLQueryItem]) async throws -> TaskListResponse {
        let query = LocalTaskStore.ListQuery(queryItems: queryItems)
        if query.hasProjectFilter {
            return query.emptyPage
        }
        return try await database.dbWriter.read { db in
            try LocalTaskStore.listTasks(db, query: query)
        }
    }

    func searchTasks(queryItems: [URLQueryItem]) async throws -> SearchTasksResponse {
        let list = try await listTasks(queryItems: queryItems)
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

    // MARK: - Get

    func getTask(id: Int) async throws -> TaskItem {
        try await database.dbWriter.read { db in
            guard let row = try LocalTaskStore.fetchTaskRow(db, id: id) else {
                throw LocalTaskError.taskNotFound
            }
            return try LocalTaskStore.taskItem(from: row, db: db)
        }
    }

    // MARK: - Create

    func createTask(_ request: CreateTaskRequest) async throws -> TaskItem {
        let uuid = UUIDv7.generate()
        let now = ISO8601Millis.now()

        return try await database.dbWriter.write { db in
            try LocalTaskStore.insertTask(db, uuid: uuid, request: request, now: now)
            guard let row = try LocalTaskStore.fetchTaskRow(db, uuid: uuid) else {
                throw LocalTaskError.taskNotFound
            }
            return try LocalTaskStore.taskItem(from: row, db: db)
        }
    }

    // MARK: - Update

    func updateTask(id: Int, _ request: UpdateTaskRequest) async throws -> TaskItem {
        let now = ISO8601Millis.now()

        return try await database.dbWriter.write { db in
            guard let row = try LocalTaskStore.fetchTaskRow(db, id: id) else {
                throw LocalTaskError.taskNotFound
            }
            let uuid: String = row["uuid"]
            let currentStatus: String? = row["status"]

            try LocalTaskStore.updateTaskFields(
                db,
                uuid: uuid,
                currentStatus: currentStatus,
                title: request.title,
                bodyMd: request.bodyMd,
                status: request.status,
                now: now
            )

            guard let updated = try LocalTaskStore.fetchTaskRow(db, uuid: uuid) else {
                throw LocalTaskError.taskNotFound
            }
            return try LocalTaskStore.taskItem(from: updated, db: db)
        }
    }

    // MARK: - Delete

    func deleteTask(id: Int) async throws {
        try await database.dbWriter.write { db in
            guard let row = try LocalTaskStore.fetchTaskRow(db, id: id) else {
                throw LocalTaskError.taskNotFound
            }
            let uuid: String = row["uuid"]
            try LocalTaskStore.hardDeleteTaskWithRelated(db, uuid: uuid)
        }
    }

    // MARK: - Bookmark

    func bookmarkTask(id: Int) async throws -> TaskItem {
        try await applyBookmark(id: id, isBookmarked: true)
    }

    func unbookmarkTask(id: Int) async throws -> TaskItem {
        try await applyBookmark(id: id, isBookmarked: false)
    }

    private func applyBookmark(id: Int, isBookmarked: Bool) async throws -> TaskItem {
        let now = ISO8601Millis.now()

        return try await database.dbWriter.write { db in
            guard let row = try LocalTaskStore.fetchTaskRow(db, id: id) else {
                throw LocalTaskError.taskNotFound
            }
            let uuid: String = row["uuid"]
            try LocalTaskStore.setBookmark(db, uuid: uuid, isBookmarked: isBookmarked, now: now)
            guard let updated = try LocalTaskStore.fetchTaskRow(db, uuid: uuid) else {
                throw LocalTaskError.taskNotFound
            }
            return try LocalTaskStore.taskItem(from: updated, db: db)
        }
    }

    // MARK: - Comments

    func listComments(taskId: Int) async throws -> [Comment] {
        try await database.dbWriter.read { db in
            guard let taskRow = try LocalTaskStore.fetchTaskRow(db, id: taskId) else {
                throw LocalTaskError.taskNotFound
            }
            let taskUuid: String = taskRow["uuid"]
            return try LocalCommentStore.listComments(db, issueUuid: taskUuid, issueId: taskId)
        }
    }

    func createComment(taskId: Int, _ request: CreateCommentRequest) async throws -> Comment {
        let uuid = UUIDv7.generate()
        let now = ISO8601Millis.now()

        return try await database.dbWriter.write { db in
            guard let taskRow = try LocalTaskStore.fetchTaskRow(db, id: taskId) else {
                throw LocalTaskError.taskNotFound
            }
            let taskUuid: String = taskRow["uuid"]

            try LocalCommentStore.insertComment(
                db,
                uuid: uuid,
                issueUuid: taskUuid,
                bodyMd: request.bodyMd,
                now: now
            )

            guard let row = try LocalCommentStore.fetchCommentRow(db, uuid: uuid) else {
                throw LocalTaskError.commentNotFound
            }
            return LocalCommentStore.comment(from: row, issueId: taskId)
        }
    }

    func updateComment(taskId: Int, commentId: Int, _ request: UpdateCommentRequest) async throws -> Comment {
        let now = ISO8601Millis.now()

        return try await database.dbWriter.write { db in
            guard let taskRow = try LocalTaskStore.fetchTaskRow(db, id: taskId) else {
                throw LocalTaskError.taskNotFound
            }
            let taskUuid: String = taskRow["uuid"]
            guard let row = try LocalCommentStore.fetchCommentRow(db, issueUuid: taskUuid, id: commentId) else {
                throw LocalTaskError.commentNotFound
            }
            let uuid: String = row["uuid"]

            try LocalCommentStore.updateCommentBody(db, uuid: uuid, bodyMd: request.bodyMd, now: now)

            guard let updated = try LocalCommentStore.fetchCommentRow(db, uuid: uuid) else {
                throw LocalTaskError.commentNotFound
            }
            return LocalCommentStore.comment(from: updated, issueId: taskId)
        }
    }

    func deleteComment(taskId: Int, commentId: Int) async throws {
        try await database.dbWriter.write { db in
            guard let taskRow = try LocalTaskStore.fetchTaskRow(db, id: taskId) else {
                throw LocalTaskError.taskNotFound
            }
            let taskUuid: String = taskRow["uuid"]
            guard let row = try LocalCommentStore.fetchCommentRow(db, issueUuid: taskUuid, id: commentId) else {
                throw LocalTaskError.commentNotFound
            }
            let uuid: String = row["uuid"]
            try LocalCommentStore.hardDeleteComment(db, uuid: uuid)
        }
    }
}

import Foundation
import GRDB

/// Offline-first `TaskDataSource` (offline support plan Phase 7), active only
/// while the "Offline Sync (Beta)" setting is on.
///
/// Unlike memos, tasks are READ-ONLY offline:
/// - READS go to the server first; when the server is unreachable
///   (`APIError.networkError`) they fall back to the local GRDB mirror, which
///   the sync pull keeps seeded with task rows.
/// - WRITES are delegated to the server; when it is unreachable they throw
///   `OfflineReadOnlyError` instead of queueing (tasks have no outbox path).
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

    init(database: AppDatabase, remote: TaskDataSource) {
        self.database = database
        self.remote = remote
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
                guard let row = try Self.fetchRow(db, id: id) else { return nil }
                return try Self.taskItem(from: row, db: db)
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
                guard let taskRow = try Self.fetchRow(db, id: taskId) else { return nil }
                let taskUuid: String = taskRow["uuid"]
                // Same order the server uses: created_at ASC, deleted rows
                // excluded.
                let rows = try Row.fetchAll(
                    db,
                    sql: """
                        SELECT c.rowid AS local_rowid, c.*
                        FROM comments c
                        WHERE c.issue_uuid = ? AND c.is_deleted = 0
                        ORDER BY c.created_at ASC
                        """,
                    arguments: [taskUuid]
                )
                return rows.map { row in
                    let serverId: Int? = row["server_id"]
                    let rowid: Int64 = row["local_rowid"]
                    return Comment(
                        id: serverId ?? -Int(rowid),
                        issueId: taskId,
                        bodyMd: row["body_md"],
                        createdAt: row["created_at"],
                        updatedAt: row["updated_at"]
                    )
                }
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

    func createComment(taskId: Int, _ request: CreateCommentRequest) async throws -> Comment {
        try await onlineOnly { try await self.remote.createComment(taskId: taskId, request) }
    }

    func updateComment(taskId: Int, commentId: Int, _ request: UpdateCommentRequest) async throws -> Comment {
        try await onlineOnly { try await self.remote.updateComment(taskId: taskId, commentId: commentId, request) }
    }

    func deleteComment(taskId: Int, commentId: Int) async throws {
        try await onlineOnly { try await self.remote.deleteComment(taskId: taskId, commentId: commentId) }
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

    /// Query items understood by GET /api/tasks, as built by
    /// TaskListViewModel.buildListQueryItems (plus the bare `search` the
    /// link-picker uses).
    private struct ListQuery {
        var limit: Int?
        var offset = 0
        var status: String?
        var labels: [String] = []
        var bookmarked = false
        var search: String?
        var scheduledFrom: String?
        var scheduledTo: String?
        var hasProjectFilter = false

        init(queryItems: [URLQueryItem]) {
            for item in queryItems {
                switch item.name {
                case "limit":
                    limit = item.value.flatMap(Int.init)
                case "offset":
                    offset = item.value.flatMap(Int.init) ?? 0
                case "status":
                    status = item.value
                case "label":
                    labels = (item.value ?? "")
                        .split(separator: ",")
                        .map { $0.trimmingCharacters(in: .whitespaces) }
                        .filter { !$0.isEmpty }
                case "bookmarked":
                    bookmarked = item.value == "true"
                case "search":
                    search = item.value
                case "scheduledFrom":
                    scheduledFrom = item.value
                case "scheduledTo":
                    scheduledTo = item.value
                case "projectId":
                    hasProjectFilter = true
                default:
                    break
                }
            }
        }
    }

    private func localListTasks(queryItems: [URLQueryItem]) async throws -> TaskListResponse {
        let query = ListQuery(queryItems: queryItems)

        // Project membership is only cached per opened issue (see
        // OfflineFirstProjectDataSource), never for the whole task list, so a
        // projectId filter cannot be answered correctly offline. An empty
        // page is the honest answer (same rule as OfflineFirstMemoDataSource;
        // ignoring the filter would show wrong contents).
        if query.hasProjectFilter {
            return TaskListResponse(
                data: [],
                total: 0,
                limit: query.limit ?? 100,
                offset: query.offset
            )
        }

        return try await database.dbWriter.read { db in
            // Filter semantics mirror packages/db/src/taskRepository.ts:
            // labels are OR (any match), `search` is a title LIKE substring,
            // scheduled bounds check scheduled_start first and fall back to
            // actual_start, both as server-localtime DATE() values.
            var conditions = ["i.type = 'task'", "i.is_deleted = 0"]
            var arguments: [DatabaseValueConvertible] = []

            if let status = query.status {
                conditions.append("i.status = ?")
                arguments.append(status)
            }
            if !query.labels.isEmpty {
                let placeholders = query.labels.map { _ in "?" }.joined(separator: ", ")
                conditions.append("""
                    i.uuid IN (SELECT issue_uuid FROM issue_labels \
                    WHERE label_name IN (\(placeholders)))
                    """)
                arguments.append(contentsOf: query.labels)
            }
            if query.bookmarked {
                conditions.append("i.is_bookmarked = 1")
            }
            if let search = query.search, !search.isEmpty {
                conditions.append("i.title LIKE ?")
                arguments.append("%\(search)%")
            }
            if let from = query.scheduledFrom, let to = query.scheduledTo {
                conditions.append("""
                    ((i.scheduled_start IS NOT NULL \
                    AND DATE(i.scheduled_start, 'localtime') >= ? \
                    AND DATE(i.scheduled_start, 'localtime') <= ?) \
                    OR (i.scheduled_start IS NULL AND i.actual_start IS NOT NULL \
                    AND DATE(i.actual_start, 'localtime') >= ? \
                    AND DATE(i.actual_start, 'localtime') <= ?))
                    """)
                arguments.append(contentsOf: [from, to, from, to])
            } else if let from = query.scheduledFrom {
                conditions.append("""
                    ((i.scheduled_start IS NOT NULL AND DATE(i.scheduled_start, 'localtime') >= ?) \
                    OR (i.scheduled_start IS NULL AND i.actual_start IS NOT NULL \
                    AND DATE(i.actual_start, 'localtime') >= ?))
                    """)
                arguments.append(contentsOf: [from, from])
            } else if let to = query.scheduledTo {
                conditions.append("""
                    ((i.scheduled_start IS NOT NULL AND DATE(i.scheduled_start, 'localtime') <= ?) \
                    OR (i.scheduled_start IS NULL AND i.actual_start IS NOT NULL \
                    AND DATE(i.actual_start, 'localtime') <= ?))
                    """)
                arguments.append(contentsOf: [to, to])
            }

            let whereClause = conditions.joined(separator: " AND ")

            let total = try Int.fetchOne(
                db,
                sql: "SELECT COUNT(*) FROM issues i WHERE \(whereClause)",
                arguments: StatementArguments(arguments)
            ) ?? 0

            var sql = Self.rowSelect + """
                 WHERE \(whereClause)
                ORDER BY i.updated_at DESC
                """
            if let limit = query.limit {
                sql += " LIMIT ? OFFSET ?"
                arguments.append(limit)
                arguments.append(query.offset)
            }

            let rows = try Row.fetchAll(db, sql: sql, arguments: StatementArguments(arguments))
            let tasks = try rows.map { try Self.taskItem(from: $0, db: db) }
            return TaskListResponse(
                data: tasks,
                total: total,
                limit: query.limit ?? total,
                offset: query.offset
            )
        }
    }

    // MARK: - Row helpers

    private static let rowSelect = """
        SELECT i.rowid AS local_rowid, i.*,
          (SELECT COUNT(*) FROM comments c
           WHERE c.issue_uuid = i.uuid AND c.is_deleted = 0) AS comment_count
        FROM issues i
        """

    /// Resolves the protocol's integer id: positive = server_id,
    /// negative = -rowid (local-only row).
    private static func fetchRow(_ db: Database, id: Int) throws -> Row? {
        if id > 0 {
            return try Row.fetchOne(
                db,
                sql: rowSelect + " WHERE i.server_id = ? AND i.type = 'task' AND i.is_deleted = 0",
                arguments: [id]
            )
        }
        return try Row.fetchOne(
            db,
            sql: rowSelect + " WHERE i.rowid = ? AND i.type = 'task' AND i.is_deleted = 0",
            arguments: [-id]
        )
    }

    private static func taskItem(from row: Row, db: Database) throws -> TaskItem {
        let uuid: String = row["uuid"]
        let serverId: Int? = row["server_id"]
        let rowid: Int64 = row["local_rowid"]
        // Server orders task labels by name (taskRepository.listTaskLabels).
        let labels = try String.fetchAll(
            db,
            sql: """
                SELECT label_name FROM issue_labels
                WHERE issue_uuid = ?
                ORDER BY label_name
                """,
            arguments: [uuid]
        )
        // preview / projectIds / linkIds are server-computed extras with no
        // full local mirror; nil is the "not provided" shape the UI already
        // handles.
        return TaskItem(
            id: serverId ?? -Int(rowid),
            type: row["type"],
            title: row["title"] ?? "",
            bodyMd: row["body_md"],
            status: row["status"] ?? "open",
            taskKind: row["task_kind"] ?? "action",
            scheduledStart: row["scheduled_start"],
            scheduledEnd: row["scheduled_end"],
            isAllDay: row["is_all_day"],
            actualStart: row["actual_start"],
            actualEnd: row["actual_end"],
            scheduledOn: row["scheduled_on"],
            startTime: row["start_time"],
            endDate: row["end_date"],
            endTime: row["end_time"],
            duration: row["duration"],
            isBookmarked: row["is_bookmarked"],
            isDeleted: row["is_deleted"],
            createdAt: row["created_at"],
            updatedAt: row["updated_at"],
            labels: labels,
            commentCount: row["comment_count"],
            preview: nil,
            projectIds: nil,
            linkIds: nil
        )
    }
}

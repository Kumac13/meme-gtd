import Foundation
import GRDB

/// Errors surfaced by the local task store (English, user-facing).
nonisolated enum LocalTaskError: Error, LocalizedError {
    case taskNotFound
    case commentNotFound

    var errorDescription: String? {
        switch self {
        case .taskNotFound:
            return "Task not found in the local database."
        case .commentNotFound:
            return "Comment not found in the local database."
        }
    }
}

/// Local (GRDB) reads and writes for tasks, shared by
/// `OfflineFirstTaskDataSource` (read-only fallback while Offline Sync is on)
/// and `LocalTaskDataSource` (Standalone mode) — offline support plan Phase 9
/// extracted the read side out of the offline-first source unchanged.
///
/// This type knows NOTHING about the outbox or the network: every function
/// operates on a `Database` handle inside the caller's transaction.
///
/// Identity follows the app-wide convention: rows are keyed by
/// client-generated UUIDv7, synced rows surface `id == server_id` (positive),
/// local-only rows surface `id == -rowid` (negative).
nonisolated enum LocalTaskStore {
    // MARK: - List query

    /// Query items understood by GET /api/tasks, as built by
    /// TaskListViewModel.buildListQueryItems (plus the bare `search` the
    /// link-picker uses).
    struct ListQuery {
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

        /// The empty page a caller answers when the project filter cannot be
        /// served (project membership has no full local mirror).
        var emptyPage: TaskListResponse {
            TaskListResponse(data: [], total: 0, limit: limit ?? 100, offset: offset)
        }
    }

    // MARK: - List

    static func listTasks(_ db: Database, query: ListQuery) throws -> TaskListResponse {
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

        var sql = rowSelect + """
             WHERE \(whereClause)
            ORDER BY i.updated_at DESC
            """
        if let limit = query.limit {
            sql += " LIMIT ? OFFSET ?"
            arguments.append(limit)
            arguments.append(query.offset)
        }

        let rows = try Row.fetchAll(db, sql: sql, arguments: StatementArguments(arguments))
        let tasks = try rows.map { try taskItem(from: $0, db: db) }
        return TaskListResponse(
            data: tasks,
            total: total,
            limit: query.limit ?? total,
            offset: query.offset
        )
    }

    // MARK: - Task rows

    private static let rowSelect = """
        SELECT i.rowid AS local_rowid, i.*,
          (SELECT COUNT(*) FROM comments c
           WHERE c.issue_uuid = i.uuid AND c.is_deleted = 0) AS comment_count
        FROM issues i
        """

    /// Resolves the protocol's integer id: positive = server_id,
    /// negative = -rowid (local-only row).
    static func fetchTaskRow(_ db: Database, id: Int) throws -> Row? {
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

    static func fetchTaskRow(_ db: Database, uuid: String) throws -> Row? {
        try Row.fetchOne(db, sql: rowSelect + " WHERE i.uuid = ?", arguments: [uuid])
    }

    static func taskItem(from row: Row, db: Database) throws -> TaskItem {
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

    // MARK: - Writes (Standalone only; semantics mirror taskRepository.ts)

    /// Current local wall-clock time in the "YYYY-MM-DDTHH:mm:00" shape the
    /// server writes into actual_start / actual_end (taskRepository
    /// getLocalDateTime: local timezone, seconds zeroed).
    static func localDateTimeString(from date: Date = Date()) -> String {
        let formatter = DateFormatter()
        formatter.dateFormat = "yyyy-MM-dd'T'HH:mm:00"
        formatter.locale = Locale(identifier: "en_US_POSIX")
        return formatter.string(from: date)
    }

    /// Inserts a new task row applying the server's create defaults
    /// (taskRepository.createTask): status defaults to 'inbox', task_kind to
    /// 'action', bodyMd to '' (createTaskHandler), meta to '{}', and a task
    /// created directly in status 'next' gets actual_start stamped with the
    /// current local datetime.
    static func insertTask(_ db: Database, uuid: String, request: CreateTaskRequest, now: String) throws {
        let status = request.status ?? "inbox"
        var record = IssueRecord(
            uuid: uuid,
            serverId: nil,
            type: "task",
            title: request.title,
            bodyMd: request.bodyMd ?? "",
            createdAt: now,
            updatedAt: now
        )
        record.status = status
        record.taskKind = request.taskKind ?? "action"
        record.scheduledStart = request.scheduledStart
        record.scheduledEnd = request.scheduledEnd
        record.isAllDay = request.isAllDay ?? false
        record.meta = "{}"
        if status == "next" {
            record.actualStart = localDateTimeString()
        }
        try record.insert(db)
    }

    /// Applies the partial update semantics of taskRepository.updateTask for
    /// the fields the iOS UpdateTaskRequest carries (title / bodyMd /
    /// status). Status transitions auto-stamp the execution fields exactly
    /// like the server:
    /// - changing to 'done' sets actual_end to the current local datetime
    /// - changing to 'next' sets actual_start and clears actual_end
    /// A no-change status (same value) does not restamp, and an empty request
    /// leaves the row (including updated_at) untouched.
    static func updateTaskFields(
        _ db: Database,
        uuid: String,
        currentStatus: String?,
        title: String?,
        bodyMd: String?,
        status: String?,
        now: String
    ) throws {
        if title == nil && bodyMd == nil && status == nil {
            return
        }

        var sets: [String] = ["updated_at = ?"]
        var arguments: [DatabaseValueConvertible] = [now]
        if let title {
            sets.append("title = ?")
            arguments.append(title)
        }
        if let bodyMd {
            sets.append("body_md = ?")
            arguments.append(bodyMd)
        }
        if let status {
            sets.append("status = ?")
            arguments.append(status)
            if status != currentStatus {
                let localNow = localDateTimeString()
                if status == "done" {
                    sets.append("actual_end = ?")
                    arguments.append(localNow)
                } else if status == "next" {
                    sets.append("actual_start = ?")
                    arguments.append(localNow)
                    sets.append("actual_end = NULL")
                }
            }
        }
        arguments.append(uuid)
        try db.execute(
            sql: "UPDATE issues SET \(sets.joined(separator: ", ")) WHERE uuid = ?",
            arguments: StatementArguments(arguments)
        )
    }

    /// Bookmark flip mirroring taskRepository.setBookmark (bumps updated_at).
    static func setBookmark(_ db: Database, uuid: String, isBookmarked: Bool, now: String) throws {
        try db.execute(
            sql: "UPDATE issues SET is_bookmarked = ?, updated_at = ? WHERE uuid = ?",
            arguments: [isBookmarked, now, uuid]
        )
    }

    /// Hard delete for rows that never need to reach a server: drops the task
    /// row plus everything hanging off it (comments, label assignments, and
    /// links / URL links — the server's FK ON DELETE CASCADE set).
    static func hardDeleteTaskWithRelated(_ db: Database, uuid: String) throws {
        try db.execute(sql: "DELETE FROM comments WHERE issue_uuid = ?", arguments: [uuid])
        try db.execute(sql: "DELETE FROM issue_labels WHERE issue_uuid = ?", arguments: [uuid])
        try db.execute(
            sql: "DELETE FROM links WHERE source_issue_uuid = ? OR target_issue_uuid = ?",
            arguments: [uuid, uuid]
        )
        try db.execute(sql: "DELETE FROM url_links WHERE issue_uuid = ?", arguments: [uuid])
        try db.execute(sql: "DELETE FROM issues WHERE uuid = ?", arguments: [uuid])
    }
}

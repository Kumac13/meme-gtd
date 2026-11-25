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

    // MARK: - Writes

    func createTask(_ request: CreateTaskRequest) async throws -> TaskItem {
        try await createTask(request, labels: [], projectIDs: [], links: [], urls: [])
    }

    func createTask(_ request: CreateTaskRequest, labels: [String], projectIDs: [Int],
                    links: [PendingLink], urls: [PendingUrlLink]) async throws -> TaskItem {
        let task = try await database.dbWriter.write { db in
            let uuid = UUIDv7.generate()
            let now = ISO8601Millis.now()
            try LocalTaskStore.insertTask(db, uuid: uuid, request: request, now: now)
            for label in Set(labels).sorted() {
                try db.execute(sql: "INSERT INTO issue_labels(issue_uuid, label_name) VALUES (?, ?)", arguments: [uuid, label])
            }
            let pendingLinks = try links.map { link in
                if link.targetIssueId > 0 {
                    return SyncPushTaskLink(targetId: link.targetIssueId, linkType: link.linkType.rawValue,
                        targetTitle: link.title, targetType: link.targetType)
                }
                guard let target = try String.fetchOne(db, sql: "SELECT uuid FROM issues WHERE rowid = ? AND is_deleted = 0", arguments: [-link.targetIssueId]) else {
                    throw OfflineThreadStore.PendingIdentity.awaitingSync
                }
                return SyncPushTaskLink(targetUuid: target, linkType: link.linkType.rawValue)
            }
            guard let row = try LocalTaskStore.fetchTaskRow(db, uuid: uuid) else { throw LocalTaskError.taskNotFound }
            try OfflineThreadStore.enqueue(db, entity: .task, uuid: uuid,
                payload: SyncPushPayload(bodyMd: request.bodyMd, createdAt: now, updatedAt: now,
                    title: request.title, status: request.status, taskKind: request.taskKind,
                    scheduledStart: request.scheduledStart, scheduledEnd: request.scheduledEnd, isAllDay: request.isAllDay,
                    actualStart: row["actual_start"], labels: labels, projectIds: projectIDs,
                    links: pendingLinks, urlLinks: urls.map { SyncPushTaskURL(url: $0.url, title: $0.title) }), now: now)
            return try LocalTaskStore.taskItem(from: row, db: db)
        }
        onLocalWrite()
        return task
    }

    func createOnlineTask(_ request: CreateTaskRequest) async throws -> TaskItem {
        try await onlineOnly { try await self.remote.createTask(request) }
    }

    func updateTask(id: Int, _ request: UpdateTaskRequest) async throws -> TaskItem {
        guard let status = request.status, request.title == nil, request.bodyMd == nil else {
            let resolved = try await threads.serverIssueID(id)
            return try await onlineOnly { try await self.remote.updateTask(id: resolved, request) }
        }

        let task = try await database.dbWriter.write { db -> TaskItem? in
            if try LocalTaskStore.fetchTaskRow(db, id: id) == nil, id > 0,
               let cached = try self.threads.cachedValue(db, kind: "task", id: id, as: TaskItem.self),
               try Int.fetchOne(db, sql: "SELECT 1 FROM issues WHERE server_id = ?", arguments: [id]) == nil {
                try LocalTaskStore.insertCachedTask(db, task: cached, uuid: "server-id:\(id)")
            }
            guard let row = try LocalTaskStore.fetchTaskRow(db, id: id) else { return nil }
            let uuid: String = row["uuid"]
            let now = ISO8601Millis.now()
            try LocalTaskStore.updateTaskFields(db, uuid: uuid, currentStatus: row["status"],
                                                title: nil, bodyMd: nil, status: status, now: now)
            guard let updated = try LocalTaskStore.fetchTaskRow(db, uuid: uuid) else { throw LocalTaskError.taskNotFound }
            let previousStatus: String? = row["status"]
            let changed = previousStatus != status
            try OfflineThreadStore.enqueue(db, entity: .task, type: .update, uuid: uuid,
                payload: SyncPushPayload(status: status,
                    actualStart: changed && status == "next" ? updated["actual_start"] : nil,
                    actualEnd: changed && status == "done" ? updated["actual_end"] : nil),
                baseUpdatedAt: row["server_updated_at"], now: now)
            return try LocalTaskStore.taskItem(from: updated, db: db)
        }
        if let task {
            onLocalWrite()
            return task
        }
        return try await onlineOnly { try await self.remote.updateTask(id: id, request) }
    }

    func archiveToArticle(id: Int) async throws -> Int {
        let resolved = try await threads.serverIssueID(id)
        return try await onlineOnly { try await self.remote.archiveToArticle(id: resolved) }
    }

    func transferToMemo(id: Int) async throws -> Int {
        let resolved = try await threads.serverIssueID(id)
        return try await onlineOnly { try await self.remote.transferToMemo(id: resolved) }
    }

    func deleteTask(id: Int) async throws {
        let resolved = try await threads.serverIssueID(id)
        return try await onlineOnly { try await self.remote.deleteTask(id: resolved) }
    }

    func bookmarkTask(id: Int) async throws -> TaskItem {
        let resolved = try await threads.serverIssueID(id)
        return try await onlineOnly { try await self.remote.bookmarkTask(id: resolved) }
    }

    func unbookmarkTask(id: Int) async throws -> TaskItem {
        let resolved = try await threads.serverIssueID(id)
        return try await onlineOnly { try await self.remote.unbookmarkTask(id: resolved) }
    }

    func createComment(taskId: Int, _ request: CreateCommentRequest) async throws -> Comment {
        try await threads.add(id: taskId, body: request.bodyMd)
    }

    func updateComment(taskId: Int, commentId: Int, _ request: UpdateCommentRequest) async throws -> Comment {
        try await threads.edit(id: taskId, commentID: commentId, body: request.bodyMd)
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
        return try await database.dbWriter.read { db in
            try LocalTaskStore.listTasks(db, query: query)
        }
    }
}

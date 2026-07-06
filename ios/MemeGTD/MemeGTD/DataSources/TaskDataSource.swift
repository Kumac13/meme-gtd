import Foundation

/// Data access seam for tasks and their comments.
protocol TaskDataSource {
    func listTasks(queryItems: [URLQueryItem]) async throws -> TaskListResponse
    /// Same `/api/tasks` endpoint as `listTasks`, but decoded into the slim
    /// shape the link-picker search uses.
    func searchTasks(queryItems: [URLQueryItem]) async throws -> SearchTasksResponse
    func getTask(id: Int) async throws -> TaskItem
    func createTask(_ request: CreateTaskRequest) async throws -> TaskItem
    func updateTask(id: Int, _ request: UpdateTaskRequest) async throws -> TaskItem
    func deleteTask(id: Int) async throws
    func bookmarkTask(id: Int) async throws -> TaskItem
    func unbookmarkTask(id: Int) async throws -> TaskItem

    // Comments
    func listComments(taskId: Int) async throws -> [Comment]
    func createComment(taskId: Int, _ request: CreateCommentRequest) async throws -> Comment
    func updateComment(taskId: Int, commentId: Int, _ request: UpdateCommentRequest) async throws -> Comment
    func deleteComment(taskId: Int, commentId: Int) async throws
}

/// Server-backed implementation: a thin wrapper around `APIClient`.
struct RemoteTaskDataSource: TaskDataSource {
    func listTasks(queryItems: [URLQueryItem]) async throws -> TaskListResponse {
        try await APIClient.shared.get(path: "/api/tasks", queryItems: queryItems)
    }

    func searchTasks(queryItems: [URLQueryItem]) async throws -> SearchTasksResponse {
        try await APIClient.shared.get(path: "/api/tasks", queryItems: queryItems)
    }

    func getTask(id: Int) async throws -> TaskItem {
        try await APIClient.shared.get(path: "/api/tasks/\(id)")
    }

    func createTask(_ request: CreateTaskRequest) async throws -> TaskItem {
        try await APIClient.shared.post(path: "/api/tasks", body: request)
    }

    func updateTask(id: Int, _ request: UpdateTaskRequest) async throws -> TaskItem {
        try await APIClient.shared.patch(path: "/api/tasks/\(id)", body: request)
    }

    func deleteTask(id: Int) async throws {
        try await APIClient.shared.delete(path: "/api/tasks/\(id)")
    }

    func bookmarkTask(id: Int) async throws -> TaskItem {
        try await APIClient.shared.postReturning(path: "/api/tasks/\(id)/bookmark")
    }

    func unbookmarkTask(id: Int) async throws -> TaskItem {
        try await APIClient.shared.postReturning(path: "/api/tasks/\(id)/unbookmark")
    }

    // MARK: - Comments

    func listComments(taskId: Int) async throws -> [Comment] {
        try await APIClient.shared.get(path: "/api/tasks/\(taskId)/comments")
    }

    func createComment(taskId: Int, _ request: CreateCommentRequest) async throws -> Comment {
        try await APIClient.shared.post(path: "/api/tasks/\(taskId)/comments", body: request)
    }

    func updateComment(taskId: Int, commentId: Int, _ request: UpdateCommentRequest) async throws -> Comment {
        try await APIClient.shared.patch(path: "/api/tasks/\(taskId)/comments/\(commentId)", body: request)
    }

    func deleteComment(taskId: Int, commentId: Int) async throws {
        try await APIClient.shared.delete(path: "/api/tasks/\(taskId)/comments/\(commentId)")
    }
}

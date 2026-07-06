import Foundation

/// Data access seam for projects and project membership of issues.
protocol ProjectDataSource {
    func listProjects() async throws -> [Project]
    /// Projects the given issue belongs to.
    func listIssueProjects(issueId: Int) async throws -> [Project]
    func addProjectItem(projectId: Int, _ request: AddProjectItemRequest) async throws -> ProjectItem
    func removeProjectItem(projectId: Int, issueId: Int) async throws
}

/// Server-backed implementation: a thin wrapper around `APIClient`.
struct RemoteProjectDataSource: ProjectDataSource {
    func listProjects() async throws -> [Project] {
        try await APIClient.shared.get(path: "/api/projects")
    }

    func listIssueProjects(issueId: Int) async throws -> [Project] {
        try await APIClient.shared.get(path: "/api/issues/\(issueId)/projects")
    }

    func addProjectItem(projectId: Int, _ request: AddProjectItemRequest) async throws -> ProjectItem {
        try await APIClient.shared.post(path: "/api/projects/\(projectId)/items", body: request)
    }

    func removeProjectItem(projectId: Int, issueId: Int) async throws {
        try await APIClient.shared.delete(path: "/api/projects/\(projectId)/items/\(issueId)")
    }
}

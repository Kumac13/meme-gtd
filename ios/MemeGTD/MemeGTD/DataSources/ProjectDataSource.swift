import Foundation
import GRDB

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
    var client = APIClient.shared

    func refreshMembershipSnapshot(_ database: AppDatabase) async throws {
        struct Detail: Decodable { let items: [ProjectItem] }
        let projects = try await listProjects()
        var memberships: [ProjectItemRecord] = []
        for project in projects {
            let detail: Detail = try await client.get(path: "/api/projects/\(project.id)")
            memberships += detail.items.map { ProjectItemRecord(projectId: Int64(project.id), issueId: Int64($0.issueId)) }
        }
        let snapshot = memberships
        let changed = try await database.dbWriter.write { db in
            for project in projects {
                try ProjectRecord(id: Int64(project.id), name: project.name, description: project.description,
                    status: project.status, startDate: project.startDate, endDate: project.endDate,
                    createdAt: project.createdAt).upsert(db)
            }
            let old = try ProjectItemRecord.fetchAll(db, sql: "SELECT * FROM project_items ORDER BY project_id, issue_id")
            let sorted = snapshot.sorted { ($0.projectId, $0.issueId) < ($1.projectId, $1.issueId) }
            if old != sorted {
                try db.execute(sql: "DELETE FROM project_items")
                for row in sorted { try row.insert(db) }
            }
            try db.execute(sql: "UPDATE issues SET memberships_known = 1 WHERE memberships_known = 0")
            return db.changesCount > 0 || old != sorted
        }
        if changed { NotificationCenter.default.post(name: .syncEngineDidChangeData, object: nil) }
    }

    func listProjects() async throws -> [Project] {
        try await client.get(path: "/api/projects")
    }

    func listIssueProjects(issueId: Int) async throws -> [Project] {
        try await client.get(path: "/api/issues/\(issueId)/projects")
    }

    func addProjectItem(projectId: Int, _ request: AddProjectItemRequest) async throws -> ProjectItem {
        try await client.post(path: "/api/projects/\(projectId)/items", body: request)
    }

    func removeProjectItem(projectId: Int, issueId: Int) async throws {
        try await client.delete(path: "/api/projects/\(projectId)/items/\(issueId)")
    }
}

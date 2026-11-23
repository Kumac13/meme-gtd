import Foundation
import GRDB

/// Offline-first `ProjectDataSource` (offline support plan Phase 7), active
/// only while the "Offline Sync (Beta)" setting is on.
///
/// Projects are hard-deleted on the server and are NOT part of the sync
/// change feed, so — unlike issues — they need an explicit response cache:
/// - `listProjects`: every successful fetch replaces the whole local
///   `projects` snapshot (DELETE then INSERT); offline reads serve the last
///   snapshot.
/// - `listIssueProjects`: memberships are cached per issue (rows for that
///   issue are replaced on each successful fetch), and the returned projects
///   are upserted into the snapshot so the join resolves offline.
/// - Writes delegate to the server and throw `OfflineReadOnlyError` when it
///   is unreachable; successful writes update the membership cache in place.
nonisolated final class OfflineFirstProjectDataSource: ProjectDataSource {
    private let database: AppDatabase
    private let remote: ProjectDataSource

    init(database: AppDatabase, remote: ProjectDataSource) {
        self.database = database
        self.remote = remote
    }

    // MARK: - Reads (remote first + cache write, local fallback)

    func listProjects() async throws -> [Project] {
        do {
            let projects = try await remote.listProjects()
            try await database.dbWriter.write { db in
                // Full snapshot replace: server projects hard-delete, so a
                // merge would leave ghosts behind.
                try db.execute(sql: "DELETE FROM projects")
                for project in projects {
                    try Self.record(from: project).insert(db)
                }
            }
            return projects
        } catch where OfflineFirstSupport.isNetworkError(error) {
            return try await database.dbWriter.read { db in
                // Same order the server uses (projectRepository.listProjects).
                let records = try ProjectRecord.fetchAll(
                    db,
                    sql: "SELECT * FROM projects ORDER BY created_at DESC"
                )
                return records.map(Self.project(from:))
            }
        }
    }

    func listIssueProjects(issueId: Int) async throws -> [Project] {
        let pending = try await database.dbWriter.read { db in
            let column = issueId < 0 ? "rowid" : "server_id"
            let rows = try ProjectRecord.fetchAll(db, sql: """
                SELECT p.* FROM projects p JOIN pending_memberships m ON m.project_id = p.id
                JOIN issues i ON i.uuid = m.issue_uuid WHERE i.\(column) = ? AND m.needs_review = 0
                ORDER BY p.created_at DESC
                """, arguments: [abs(issueId)])
            return rows.map(Self.project(from:))
        }
        guard issueId > 0 else { return pending }
        do {
            let projects = try await remote.listIssueProjects(issueId: issueId)
            try await database.dbWriter.write { db in
                // Per-issue replace, and upsert the projects themselves so
                // the offline join below can resolve names.
                try db.execute(
                    sql: "DELETE FROM project_items WHERE issue_id = ?",
                    arguments: [issueId]
                )
                try db.execute(sql: "UPDATE issues SET memberships_known = 1 WHERE server_id = ?", arguments: [issueId])
                for project in projects {
                    try ProjectItemRecord(
                        projectId: Int64(project.id),
                        issueId: Int64(issueId)
                    ).insert(db)
                    try Self.record(from: project).upsert(db)
                }
            }
            return projects + pending.filter { project in !projects.contains { $0.id == project.id } }
        } catch where OfflineFirstSupport.isNetworkError(error) {
            return try await database.dbWriter.read { db in
                let records = try ProjectRecord.fetchAll(
                    db,
                    sql: """
                        SELECT p.* FROM projects p
                        JOIN project_items pi ON pi.project_id = p.id
                        WHERE pi.issue_id = ?
                        ORDER BY p.created_at DESC
                        """,
                    arguments: [issueId]
                )
                let cached = records.map(Self.project(from:))
                return cached + pending.filter { project in !cached.contains { $0.id == project.id } }
            }
        }
    }

    static func flushMemberships(database: AppDatabase, remote: ProjectDataSource = RemoteProjectDataSource()) async throws {
        let memberships = try await database.dbWriter.read { db in
            try Row.fetchAll(db, sql: """
                SELECT m.issue_uuid, m.project_id, i.server_id FROM pending_memberships m
                JOIN issues i ON i.uuid = m.issue_uuid
                WHERE i.server_id IS NOT NULL AND i.is_deleted = 0 AND m.needs_review = 0
                """).map { ($0["issue_uuid"] as String, $0["project_id"] as Int, $0["server_id"] as Int) }
        }
        for (uuid, project, issue) in memberships {
            do {
                _ = try await remote.addProjectItem(projectId: project, AddProjectItemRequest(issueId: issue))
            } catch APIError.serverError(409, _) {
                let confirmed = try await remote.listIssueProjects(issueId: issue)
                guard confirmed.contains(where: { $0.id == project }) else { throw APIError.serverError(409, nil) }
            } catch APIError.serverError(404, _) {
                try await database.dbWriter.write { db in
                    try db.execute(sql: "UPDATE pending_memberships SET needs_review = 1 WHERE issue_uuid = ? AND project_id = ?", arguments: [uuid, project])
                }
                continue
            }
            try await database.dbWriter.write { db in
                try ProjectItemRecord(projectId: Int64(project), issueId: Int64(issue)).upsert(db)
                try db.execute(sql: "DELETE FROM pending_memberships WHERE issue_uuid = ? AND project_id = ?", arguments: [uuid, project])
            }
        }
    }

    // MARK: - Writes (online only, cache kept in step)

    func addProjectItem(projectId: Int, _ request: AddProjectItemRequest) async throws -> ProjectItem {
        do {
            let item = try await remote.addProjectItem(projectId: projectId, request)
            try await database.dbWriter.write { db in
                try ProjectItemRecord(
                    projectId: Int64(item.projectId),
                    issueId: Int64(item.issueId)
                ).upsert(db)
            }
            return item
        } catch where OfflineFirstSupport.isNetworkError(error) {
            throw OfflineReadOnlyError()
        }
    }

    func removeProjectItem(projectId: Int, issueId: Int) async throws {
        do {
            try await remote.removeProjectItem(projectId: projectId, issueId: issueId)
            try await database.dbWriter.write { db in
                try db.execute(
                    sql: "DELETE FROM project_items WHERE project_id = ? AND issue_id = ?",
                    arguments: [projectId, issueId]
                )
            }
        } catch where OfflineFirstSupport.isNetworkError(error) {
            throw OfflineReadOnlyError()
        }
    }

    // MARK: - Mapping

    private static func record(from project: Project) -> ProjectRecord {
        ProjectRecord(
            id: Int64(project.id),
            name: project.name,
            description: project.description,
            status: project.status,
            startDate: project.startDate,
            endDate: project.endDate,
            createdAt: project.createdAt
        )
    }

    private static func project(from record: ProjectRecord) -> Project {
        Project(
            id: Int(record.id),
            name: record.name,
            description: record.description,
            status: record.status,
            startDate: record.startDate,
            endDate: record.endDate,
            createdAt: record.createdAt
        )
    }
}

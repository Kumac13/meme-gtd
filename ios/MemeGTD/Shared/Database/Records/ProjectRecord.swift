import Foundation
import GRDB

/// Row of the local `projects` table: a snapshot of GET /api/projects for
/// offline reads (offline support plan Phase 7). Keyed by the SERVER id —
/// projects are never created locally, so no client uuid is needed.
nonisolated struct ProjectRecord: Codable, Equatable, FetchableRecord, PersistableRecord {
    static let databaseTableName = "projects"

    var id: Int64
    var name: String
    var description: String?
    var status: String
    var startDate: String?
    var endDate: String?
    var createdAt: String

    enum CodingKeys: String, CodingKey {
        case id
        case name
        case description
        case status
        case startDate = "start_date"
        case endDate = "end_date"
        case createdAt = "created_at"
    }
}

/// Row of the local `project_items` join table: which projects an issue
/// belongs to, cached per issue from GET /api/issues/{id}/projects. Both keys
/// are SERVER ids.
nonisolated struct ProjectItemRecord: Codable, Equatable, FetchableRecord, PersistableRecord {
    static let databaseTableName = "project_items"

    var projectId: Int64
    var issueId: Int64

    enum CodingKeys: String, CodingKey {
        case projectId = "project_id"
        case issueId = "issue_id"
    }
}

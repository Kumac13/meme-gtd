import Foundation
import GRDB

/// Row of the local `comments` table. `issueUuid` references the parent
/// issue by its client-generated UUID (never by server id).
nonisolated struct CommentRecord: Codable, Equatable, FetchableRecord, PersistableRecord {
    static let databaseTableName = "comments"

    var uuid: String
    var serverId: Int64?
    var issueUuid: String
    var bodyMd: String
    var createdAt: String
    var updatedAt: String
    var serverUpdatedAt: String?
    var isDeleted: Bool = false

    enum CodingKeys: String, CodingKey {
        case uuid
        case serverId = "server_id"
        case issueUuid = "issue_uuid"
        case bodyMd = "body_md"
        case createdAt = "created_at"
        case updatedAt = "updated_at"
        case serverUpdatedAt = "server_updated_at"
        case isDeleted = "is_deleted"
    }
}

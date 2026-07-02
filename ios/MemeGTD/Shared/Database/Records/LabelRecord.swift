import Foundation
import GRDB

/// Row of the local `labels` table. Labels use their natural key: `name` is
/// UNIQUE on the server, so it doubles as the local primary key.
nonisolated struct LabelRecord: Codable, Equatable, FetchableRecord, PersistableRecord {
    static let databaseTableName = "labels"

    var name: String
    var serverId: Int64?
    var description: String?
    var createdAt: String

    enum CodingKeys: String, CodingKey {
        case name
        case serverId = "server_id"
        case description
        case createdAt = "created_at"
    }
}

/// Row of the local `issue_labels` join table.
nonisolated struct IssueLabelRecord: Codable, Equatable, FetchableRecord, PersistableRecord {
    static let databaseTableName = "issue_labels"

    var issueUuid: String
    var labelName: String

    enum CodingKeys: String, CodingKey {
        case issueUuid = "issue_uuid"
        case labelName = "label_name"
    }
}

import Foundation
import GRDB

/// Row of the local `pending_operations` Outbox table (offline support plan
/// S2). `id` is the SQLite auto-increment rowid and preserves FIFO order;
/// it is nil until the record has been inserted.
nonisolated struct PendingOperationRecord: Codable, Equatable, FetchableRecord, MutablePersistableRecord {
    static let databaseTableName = "pending_operations"

    var id: Int64?
    var opId: String
    var entity: String
    var opType: String
    var targetUuid: String
    var issueUuid: String?
    var payload: String?
    var baseUpdatedAt: String?
    var state: String = "queued"
    var retryCount: Int = 0
    var createdAt: String

    enum CodingKeys: String, CodingKey {
        case id
        case opId = "op_id"
        case entity
        case opType = "op_type"
        case targetUuid = "target_uuid"
        case issueUuid = "issue_uuid"
        case payload
        case baseUpdatedAt = "base_updated_at"
        case state
        case retryCount = "retry_count"
        case createdAt = "created_at"
    }

    mutating func didInsert(_ inserted: InsertionSuccess) {
        id = inserted.rowID
    }
}

import Foundation
import GRDB

/// Row of the local `issues` table (single-table inheritance mirror of the
/// server: memo / task / article). Timestamps and dates are stored as ISO
/// strings, exactly as the server returns them.
nonisolated struct IssueRecord: Codable, Equatable, FetchableRecord, PersistableRecord {
    static let databaseTableName = "issues"

    var uuid: String
    var serverId: Int64?
    var type: String
    var title: String?
    var bodyMd: String
    var status: String?
    var scheduledOn: String?
    var scheduledStart: String?
    var scheduledEnd: String?
    var isAllDay: Bool = false
    var actualStart: String?
    var actualEnd: String?
    var startTime: String?
    var endTime: String?
    var endDate: String?
    var duration: Int?
    var taskKind: String?
    var meta: String?
    var isBookmarked: Bool = false
    var isDeleted: Bool = false
    var createdAt: String
    var updatedAt: String
    var serverUpdatedAt: String?
    var serverSeq: Int64?

    enum CodingKeys: String, CodingKey {
        case uuid
        case serverId = "server_id"
        case type
        case title
        case bodyMd = "body_md"
        case status
        case scheduledOn = "scheduled_on"
        case scheduledStart = "scheduled_start"
        case scheduledEnd = "scheduled_end"
        case isAllDay = "is_all_day"
        case actualStart = "actual_start"
        case actualEnd = "actual_end"
        case startTime = "start_time"
        case endTime = "end_time"
        case endDate = "end_date"
        case duration
        case taskKind = "task_kind"
        case meta
        case isBookmarked = "is_bookmarked"
        case isDeleted = "is_deleted"
        case createdAt = "created_at"
        case updatedAt = "updated_at"
        case serverUpdatedAt = "server_updated_at"
        case serverSeq = "server_seq"
    }
}

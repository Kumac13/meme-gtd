import Foundation

enum TaskStatus: String, Codable, CaseIterable {
    case inbox
    case open
    case next
    case waiting
    case scheduled
    case someday
    case done
    case canceled

    var displayLabel: String {
        switch self {
        case .inbox: return "Inbox"
        case .open: return "Open"
        case .next: return "Next"
        case .waiting: return "Waiting"
        case .scheduled: return "Scheduled"
        case .someday: return "Someday"
        case .done: return "Done"
        case .canceled: return "Canceled"
        }
    }
}

struct TaskItem: Codable, Identifiable {
    let id: Int
    let type: String
    let title: String
    let bodyMd: String
    let status: TaskStatus
    let taskKind: String
    let scheduledStart: String?
    let scheduledEnd: String?
    let isAllDay: Bool
    let actualStart: String?
    let actualEnd: String?
    let scheduledOn: String?
    let startTime: String?
    let endDate: String?
    let endTime: String?
    let duration: Int?
    let isBookmarked: Bool
    let isDeleted: Bool
    let createdAt: String
    let updatedAt: String
    let labels: [String]
    let commentCount: Int?
    let preview: String?
    let projectIds: [Int]?
    let linkIds: [Int]?

    var resolvedCommentCount: Int { commentCount ?? 0 }

    // Exclude meta from decoding (not needed for list display)
    private enum CodingKeys: String, CodingKey {
        case id, type, title, bodyMd, status, taskKind
        case scheduledStart, scheduledEnd, isAllDay
        case actualStart, actualEnd
        case scheduledOn, startTime, endDate, endTime, duration
        case isBookmarked, isDeleted, createdAt, updatedAt
        case labels, commentCount, preview, projectIds, linkIds
    }
}

struct TaskListResponse: Codable {
    let data: [TaskItem]
    let total: Int
    let limit: Int
    let offset: Int
}

struct CreateTaskRequest: Codable {
    let title: String
}

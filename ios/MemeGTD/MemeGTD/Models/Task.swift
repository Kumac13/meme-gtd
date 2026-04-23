import Foundation

/// Filter option for task status. Includes `.all` for showing all statuses.
/// The API-compatible raw values are used for query building; `.all` is UI-only.
enum TaskStatusFilter: String, CaseIterable {
    case all
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
        case .all: return "All"
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

    /// The API query value. Returns nil for `.all` (omit status param).
    var apiValue: String? {
        self == .all ? nil : rawValue
    }
}

struct TaskItem: Codable, Identifiable {
    let id: Int
    let type: String
    let title: String
    let bodyMd: String
    let status: String
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

struct UpdateTaskRequest: Codable {
    let title: String?
    let bodyMd: String?
    let status: String?

    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encodeIfPresent(title, forKey: .title)
        try container.encodeIfPresent(bodyMd, forKey: .bodyMd)
        try container.encodeIfPresent(status, forKey: .status)
    }

    enum CodingKeys: String, CodingKey {
        case title, bodyMd, status
    }
}

struct TaskListResponse: Codable {
    let data: [TaskItem]
    let total: Int
    let limit: Int
    let offset: Int
}

// MARK: - Create Task

struct CreateTaskRequest: Codable {
    let title: String
    let bodyMd: String?
    let status: String?
    let taskKind: String?
    let scheduledStart: String?
    let scheduledEnd: String?
    let isAllDay: Bool?
}

struct PromoteMemoRequest: Codable {
    let title: String
    let status: String?
}

struct UpdateTaskRequest: Codable {
    let bodyMd: String?
    let taskKind: String?
    let scheduledStart: String?
    let scheduledEnd: String?
    let isAllDay: Bool?
}

enum TaskStatus: String, CaseIterable {
    case inbox, open, next, waiting, scheduled, someday, done, canceled

    var displayLabel: String {
        rawValue.capitalized
    }
}

enum TaskKind: String, CaseIterable {
    case action, event

    var displayLabel: String {
        rawValue.capitalized
    }
}

struct CreateTaskMode: Identifiable {
    let id = UUID()
    let kind: CreateTaskModeKind
}

enum CreateTaskModeKind {
    /// Full form, default fields
    case standard
    /// Full form, pre-populate a relates link to the source task
    case linkedTo(sourceTaskId: Int)
    /// Full form, inherit parent's projects/labels/status, auto-create child link
    case quickChild(parentTask: TaskItem, parentProjects: [Project], parentLabels: [String])
    /// Promote an existing memo to a task (pre-fill body, submit via /api/memos/:id/promote)
    case promoteFromMemo(memoId: Int, memoBody: String)
}

struct PendingLink: Identifiable {
    let id = UUID()
    let targetIssueId: Int
    let linkType: LinkType
    let title: String
}

struct PendingUrlLink: Identifiable {
    let id = UUID()
    let url: String
    let title: String?
}

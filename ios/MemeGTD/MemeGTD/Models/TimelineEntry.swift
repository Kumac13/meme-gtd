import Foundation

enum TimelineEntry: Identifiable {
    case comment(Comment)
    case activity(ActivityLogEntry)

    var id: String {
        switch self {
        case .comment(let c): return "comment-\(c.id)"
        case .activity(let a): return "activity-\(a.id)"
        }
    }

    var timestamp: String {
        switch self {
        case .comment(let c): return c.createdAt
        case .activity(let a): return a.occurredAt
        }
    }
}

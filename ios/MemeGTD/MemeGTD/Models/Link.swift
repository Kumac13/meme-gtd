import Foundation

// MARK: - Link Type

enum LinkType: String, CaseIterable, Codable {
    case parent
    case child
    case relates
    case derivedFrom = "derived_from"

    var displayLabel: String {
        switch self {
        case .parent: return "Parent of"
        case .child: return "Child of"
        case .relates: return "Related to"
        case .derivedFrom: return "Derived from"
        }
    }

    var iconName: String {
        switch self {
        case .parent: return "arrow.up"
        case .child: return "arrow.down"
        case .relates: return "arrow.left.arrow.right"
        case .derivedFrom: return "arrow.turn.up.left"
        }
    }
}

// MARK: - Link Direction

enum LinkDirection: String, Codable {
    case outgoing
    case incoming
}

// MARK: - Target Issue (embedded in link response)

struct TargetIssue: Codable {
    let id: Int
    let type: String
    let title: String
    let status: String?
}

// MARK: - Issue Link (GET /api/issues/:id/links response item)

struct IssueLink: Identifiable, Codable {
    let id: Int
    let sourceIssueId: Int
    let targetIssueId: Int
    let linkType: LinkType
    let createdAt: String
    let direction: LinkDirection
    let targetIssue: TargetIssue
}

// MARK: - Create Link Request (POST /api/links)

struct CreateLinkRequest: Codable {
    let sourceIssueId: Int
    let targetIssueId: Int
    let linkType: LinkType
}

// MARK: - Create Link Response (POST /api/links returns LinkSchema without direction/targetIssue)

struct CreateLinkResponse: Codable {
    let id: Int
    let sourceIssueId: Int
    let targetIssueId: Int
    let linkType: LinkType
    let createdAt: String
}

// MARK: - Issue Picker Item (unified search result)

struct IssuePickerItem: Identifiable {
    let id: Int
    let type: String
    let title: String
    let status: String?
    let updatedAt: String
}

// MARK: - Search response models (lightweight, for issue search)

struct SearchTaskItem: Codable {
    let id: Int
    let type: String
    let title: String
    let status: String
    let updatedAt: String
}

struct SearchTasksResponse: Codable {
    let data: [SearchTaskItem]
    let total: Int
    let limit: Int
    let offset: Int
}

struct SearchArticleItem: Codable {
    let id: Int
    let type: String
    let title: String
    let updatedAt: String
}

struct SearchArticlesResponse: Codable {
    let data: [SearchArticleItem]
    let total: Int
    let limit: Int
    let offset: Int
}

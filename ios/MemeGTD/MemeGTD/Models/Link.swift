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
    static func memoPreview(_ body: String) -> String {
        let text = body.split(whereSeparator: { $0.isWhitespace }).joined(separator: " ")
        return text.count > 30 ? String(text.prefix(30)) + "…" : text
    }

    var displayTitle: String { type == "memo" ? Self.memoPreview(title) : title }

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

struct IssueReferenceTitles {
    private struct Key: Hashable {
        let id: Int
        let type: String
    }

    private let titles: [Key: String]

    init(links: [IssueLink] = []) {
        var titles: [Key: String] = [:]
        for link in links {
            let target = link.targetIssue
            let otherID = link.direction == .incoming ? link.sourceIssueId : link.targetIssueId
            let title = target.displayTitle
            guard target.id == otherID,
                  !title.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty,
                  !target.title.contains("(deleted)"),
                  !(target.status == nil && target.title == "Issue #\(otherID)") else { continue }
            titles[Key(id: otherID, type: target.type)] = title
        }
        self.titles = titles
    }

    var isEmpty: Bool { titles.isEmpty }

    subscript(id: Int, type: String) -> String? {
        titles[Key(id: id, type: type)]
    }
}

// MARK: - Create Link Request (POST /api/links)

struct CreateLinkRequest: Codable {
    let sourceIssueId: Int
    let targetIssueId: Int
    let linkType: LinkType
    /// Set to true only by the memo→task promotion flow so the server records a
    /// `memo.promoted` activity event. Omitted (nil) for manual link creation.
    var isPromotion: Bool?
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

// MARK: - URL Link (GET /api/issues/:id/url-links response item)

struct UrlLink: Identifiable, Codable {
    let id: Int
    let issueId: Int
    let url: String
    let title: String?
    let createdAt: String
}

extension UrlLink {
    var displayLabel: String {
        if let title = title, !title.isEmpty { return title }
        guard let host = URL(string: url)?.host else {
            return String(url.prefix(30))
        }
        return host.hasPrefix("www.") ? String(host.dropFirst(4)) : host
    }

    var truncatedUrl: String {
        url.count <= 60 ? url : String(url.prefix(57)) + "..."
    }
}

// MARK: - Create URL Link Request (POST /api/issues/:id/url-links)

struct CreateUrlLinkRequest: Codable {
    let url: String
    let title: String?
}

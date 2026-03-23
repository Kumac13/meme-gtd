import Foundation

struct KeywordMatch: Codable {
    let field: String // "issue" or "comment"
    let commentId: Int?
    let text: String
}

struct SearchMatchInfo {
    let label: String // "Issue" or "Comment"
    let snippet: String? // Only present for comment matches
}

extension KeywordSearchResultItem {
    func firstMatchInfo() -> SearchMatchInfo? {
        guard let match = matches.first else { return nil }
        if match.field == "comment" {
            return SearchMatchInfo(label: "Comment match", snippet: match.text)
        }
        return SearchMatchInfo(label: "Issue match", snippet: nil)
    }
}


struct KeywordSearchResultItem: Codable {
    let id: Int
    let type: String
    let title: String?
    let bodyMd: String
    let status: String?
    let isBookmarked: Bool
    let labels: [String]
    let commentCount: Int
    let createdAt: String
    let updatedAt: String
    let matches: [KeywordMatch]
}

struct KeywordSearchResponse: Codable {
    let results: [KeywordSearchResultItem]
    let total: Int
    let limit: Int
    let offset: Int
}

// MARK: - Conversion to existing types

extension KeywordSearchResultItem {
    func toTaskItem() -> TaskItem {
        TaskItem(
            id: id,
            type: type,
            title: title ?? "",
            bodyMd: bodyMd,
            status: status ?? "open",
            taskKind: "action",
            scheduledStart: nil,
            scheduledEnd: nil,
            isAllDay: false,
            actualStart: nil,
            actualEnd: nil,
            scheduledOn: nil,
            startTime: nil,
            endDate: nil,
            endTime: nil,
            duration: nil,
            isBookmarked: isBookmarked,
            isDeleted: false,
            createdAt: createdAt,
            updatedAt: updatedAt,
            labels: labels,
            commentCount: commentCount,
            preview: nil,
            projectIds: nil,
            linkIds: nil
        )
    }

    func toMemo() -> Memo {
        Memo(
            id: id,
            type: type,
            bodyMd: bodyMd,
            isBookmarked: isBookmarked,
            isDeleted: false,
            createdAt: createdAt,
            updatedAt: updatedAt,
            labels: labels,
            commentCount: commentCount
        )
    }

    func toArticle() -> Article {
        Article(
            id: id,
            type: type,
            title: title ?? "",
            bodyMd: bodyMd,
            meta: nil,
            createdAt: createdAt,
            updatedAt: updatedAt,
            isBookmarked: isBookmarked,
            isDeleted: false,
            labels: labels,
            commentCount: commentCount
        )
    }
}

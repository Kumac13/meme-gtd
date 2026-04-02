import Foundation
import SwiftUI

// MARK: - API Response Types

struct SemanticSearchIssue: Codable {
    let id: Int
    let type: String
    let title: String?
    let bodyMd: String
    let createdAt: String
    let updatedAt: String
}

struct SemanticSearchResultItem: Codable {
    let issue: SemanticSearchIssue
    let score: Double
    let vectorScore: Double
    let matchReason: [String]
}

struct SemanticSearchMeta: Codable {
    let query: String
    let totalResults: Int
    let searchTimeMs: Double
}

struct SemanticSearchResponse: Codable {
    let results: [SemanticSearchResultItem]
    let meta: SemanticSearchMeta
}

// MARK: - Conversion to existing types

extension SemanticSearchResultItem {
    func toTaskItem() -> TaskItem {
        TaskItem(
            id: issue.id,
            type: issue.type,
            title: issue.title ?? "",
            bodyMd: issue.bodyMd,
            status: "open",
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
            isBookmarked: false,
            isDeleted: false,
            createdAt: issue.createdAt,
            updatedAt: issue.updatedAt,
            labels: [],
            commentCount: 0,
            preview: nil,
            projectIds: nil,
            linkIds: nil
        )
    }

    func toMemo() -> Memo {
        Memo(
            id: issue.id,
            type: issue.type,
            bodyMd: issue.bodyMd,
            isBookmarked: false,
            isDeleted: false,
            createdAt: issue.createdAt,
            updatedAt: issue.updatedAt,
            labels: [],
            commentCount: 0
        )
    }

    func toArticle() -> Article {
        Article(
            id: issue.id,
            type: issue.type,
            title: issue.title ?? "",
            bodyMd: issue.bodyMd,
            meta: nil,
            createdAt: issue.createdAt,
            updatedAt: issue.updatedAt,
            isBookmarked: false,
            isDeleted: false,
            labels: [],
            commentCount: 0
        )
    }
}

// MARK: - Relevance Display Helpers

/// Returns a color representing the relevance tier.
func relevanceTierColor(score: Double) -> Color {
    if score >= 0.70 { return .accent }
    if score >= 0.45 { return Color(hex: "#f59e0b") } // amber-500
    return .textSecondary
}

/// Returns the relevance score as a percentage string.
func relevancePercentage(score: Double) -> String {
    "\(Int(round(score * 100)))%"
}

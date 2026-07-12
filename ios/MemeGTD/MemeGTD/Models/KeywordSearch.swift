import Foundation
import SwiftUI

/// Build an AttributedString with keyword occurrences highlighted in GitHub Green.
func highlightKeyword(in text: String, query: String, fontSize: CGFloat = 11, baseColor: Color = .textSecondary) -> AttributedString {
    var result = AttributedString(text)
    result.font = .system(size: fontSize)
    result.foregroundColor = baseColor
    let lower = text.lowercased()
    let queryLower = query.lowercased()
    var searchStart = lower.startIndex
    while let range = lower.range(of: queryLower, range: searchStart..<lower.endIndex) {
        let attrStart = AttributedString.Index(range.lowerBound, within: result)!
        let attrEnd = AttributedString.Index(range.upperBound, within: result)!
        result[attrStart..<attrEnd].foregroundColor = Color.accentDarker
        result[attrStart..<attrEnd].font = .system(size: fontSize, weight: .semibold)
        searchStart = range.upperBound
    }
    return result
}

struct KeywordMatch: Codable {
    let field: String // "issue" or "comment"
    let commentId: Int?
    let text: String
}

/// Extract a snippet of text centered around the keyword, ±contextChars characters.
/// Newlines are replaced with spaces for clean single-line display.
func extractSnippet(_ text: String, query: String, contextChars: Int = 20) -> String {
    let cleaned = text.replacingOccurrences(of: "\n", with: " ").replacingOccurrences(of: "\r", with: " ")
    let lower = cleaned.lowercased()
    let queryLower = query.lowercased()
    guard let range = lower.range(of: queryLower) else {
        return String(cleaned.prefix(contextChars * 2))
    }
    let idx = lower.distance(from: lower.startIndex, to: range.lowerBound)
    let start = max(0, idx - contextChars)
    let end = min(cleaned.count, idx + query.count + contextChars)
    let startIdx = cleaned.index(cleaned.startIndex, offsetBy: start)
    let endIdx = cleaned.index(cleaned.startIndex, offsetBy: end)
    var snippet = ""
    if start > 0 { snippet += "..." }
    snippet += String(cleaned[startIdx..<endIdx])
    if end < cleaned.count { snippet += "..." }
    return snippet
}

extension KeywordSearchResultItem {
    /// Returns a snippet for display, or nil if no snippet is needed.
    /// - `isBodyVisible`: true for memos (body rendered in list), false for tasks/articles
    func matchSnippet(searchQuery: String, isBodyVisible: Bool = false) -> String? {
        guard let match = matches.first else { return nil }
        if match.field == "comment" {
            return extractSnippet(match.text, query: searchQuery)
        }
        // Issue match
        if isBodyVisible { return nil }
        let isTitleMatch = title != nil && match.text == title
        if isTitleMatch { return nil }
        return extractSnippet(match.text, query: searchQuery)
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
            origin: .web,
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

import Foundation
import SwiftUI

/// Build an AttributedString with keyword occurrences highlighted in GitHub Green.
func highlightKeyword(in text: String, query: String) -> AttributedString {
    var result = AttributedString(text)
    let lower = text.lowercased()
    let queryLower = query.lowercased()
    var searchStart = lower.startIndex
    while let range = lower.range(of: queryLower, range: searchStart..<lower.endIndex) {
        let attrStart = AttributedString.Index(range.lowerBound, within: result)!
        let attrEnd = AttributedString.Index(range.upperBound, within: result)!
        result[attrStart..<attrEnd].foregroundColor = Color.accentDarker
        result[attrStart..<attrEnd].font = .system(size: 11, weight: .semibold)
        searchStart = range.upperBound
    }
    return result
}

struct KeywordMatch: Codable {
    let field: String // "issue" or "comment"
    let commentId: Int?
    let text: String
}

struct SearchMatchInfo {
    let label: String // "Issue match" or "Comment match"
    let snippet: String? // Snippet with keyword context (nil when content already visible)
}

/// Extract a snippet of text centered around the keyword, ±contextChars characters.
private func extractSnippet(_ text: String, query: String, contextChars: Int = 20) -> String {
    let lower = text.lowercased()
    let queryLower = query.lowercased()
    guard let range = lower.range(of: queryLower) else {
        return String(text.prefix(contextChars * 2))
    }
    let idx = lower.distance(from: lower.startIndex, to: range.lowerBound)
    let start = max(0, idx - contextChars)
    let end = min(text.count, idx + query.count + contextChars)
    let startIdx = text.index(text.startIndex, offsetBy: start)
    let endIdx = text.index(text.startIndex, offsetBy: end)
    var snippet = ""
    if start > 0 { snippet += "..." }
    snippet += String(text[startIdx..<endIdx])
    if end < text.count { snippet += "..." }
    return snippet
}

extension KeywordSearchResultItem {
    func firstMatchInfo(searchQuery: String) -> SearchMatchInfo? {
        guard let match = matches.first else { return nil }
        if match.field == "comment" {
            return SearchMatchInfo(label: "Comment match", snippet: extractSnippet(match.text, query: searchQuery))
        }
        // Issue match: title match → no snippet (title visible), body match → snippet
        let isTitleMatch = title != nil && match.text == title
        if isTitleMatch {
            return SearchMatchInfo(label: "Issue match", snippet: nil)
        }
        return SearchMatchInfo(label: "Issue match", snippet: extractSnippet(match.text, query: searchQuery))
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

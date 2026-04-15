import Foundation

/// Payload for `POST /api/search/export`.
/// The server logs a `search.exported` activity_log entry and returns the
/// items for the given IDs together with the filter context.
struct SearchExportRequest: Encodable {
    let type: String
    let filters: SearchExportFilters
    let itemIds: [Int]
    let matchedComments: [String: String]?
    let matchedScores: [String: Double]?
    let includeComments: Bool
}

struct SearchExportFilters: Encodable {
    var query: String?
    var searchMode: String?
    var labels: [String]?
    var dateFrom: String?
    var dateTo: String?
    var bookmarked: Bool?
    var projectIds: [Int]?
    var includeNoProject: Bool?
    var status: String?
}

/// Minimal response decoding — we serialize the JSON back to a string and copy
/// it as-is, so we use AnyCodable-style loose typing for payload fields.
struct SearchExportRawResponse: Decodable {
    let type: String
    let total: Int
}

import Foundation

/// Data access seam for cross-type keyword search and search result export.
protocol SearchDataSource {
    func keywordSearch(queryItems: [URLQueryItem]) async throws -> KeywordSearchResponse
    /// Returns the server's export response as a pretty-printed JSON string
    /// destined for the pasteboard (see `APIClient.postReturningJSONString`).
    func exportSearchResults(_ request: SearchExportRequest) async throws -> String
}

/// Server-backed implementation: a thin wrapper around `APIClient`.
struct RemoteSearchDataSource: SearchDataSource {
    func keywordSearch(queryItems: [URLQueryItem]) async throws -> KeywordSearchResponse {
        try await APIClient.shared.get(path: "/api/search/keyword", queryItems: queryItems)
    }

    func exportSearchResults(_ request: SearchExportRequest) async throws -> String {
        try await APIClient.shared.postReturningJSONString(path: "/api/search/export", body: request)
    }
}

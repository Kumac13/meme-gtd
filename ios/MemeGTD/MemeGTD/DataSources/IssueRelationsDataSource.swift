import Foundation

/// Data access seam for the cross-issue relations shown on detail screens:
/// issue-to-issue links, URL links, and the activity log timeline.
protocol IssueRelationsDataSource {
    // Issue links
    func listLinks(issueId: Int) async throws -> [IssueLink]
    func createLink(_ request: CreateLinkRequest) async throws -> CreateLinkResponse
    func deleteLink(linkId: Int) async throws

    // URL links
    func listUrlLinks(issueId: Int) async throws -> [UrlLink]
    func createUrlLink(issueId: Int, _ request: CreateUrlLinkRequest) async throws -> UrlLink
    func deleteUrlLink(urlLinkId: Int) async throws

    // Activity log (always fetched oldest-first for the timeline)
    func listActivityLog(issueId: Int) async throws -> [ActivityLogEntry]
}

/// Server-backed implementation: a thin wrapper around `APIClient`.
struct RemoteIssueRelationsDataSource: IssueRelationsDataSource {
    // MARK: - Issue links

    func listLinks(issueId: Int) async throws -> [IssueLink] {
        try await APIClient.shared.get(path: "/api/issues/\(issueId)/links")
    }

    func createLink(_ request: CreateLinkRequest) async throws -> CreateLinkResponse {
        try await APIClient.shared.post(path: "/api/links", body: request)
    }

    func deleteLink(linkId: Int) async throws {
        try await APIClient.shared.delete(path: "/api/links/\(linkId)")
    }

    // MARK: - URL links

    func listUrlLinks(issueId: Int) async throws -> [UrlLink] {
        try await APIClient.shared.get(path: "/api/issues/\(issueId)/url-links")
    }

    func createUrlLink(issueId: Int, _ request: CreateUrlLinkRequest) async throws -> UrlLink {
        try await APIClient.shared.post(path: "/api/issues/\(issueId)/url-links", body: request)
    }

    func deleteUrlLink(urlLinkId: Int) async throws {
        try await APIClient.shared.delete(path: "/api/url-links/\(urlLinkId)")
    }

    // MARK: - Activity log

    func listActivityLog(issueId: Int) async throws -> [ActivityLogEntry] {
        try await APIClient.shared.get(
            path: "/api/activity-log/issues/\(issueId)",
            queryItems: [URLQueryItem(name: "order", value: "asc")]
        )
    }
}

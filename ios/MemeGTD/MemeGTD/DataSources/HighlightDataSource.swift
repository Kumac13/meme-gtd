import Foundation

/// Data access seam for article highlights and their comments.
///
/// Highlights are a Server-mode online feature: `RemoteHighlightDataSource`
/// talks straight to `/api/articles/{id}/highlights…`. Offline sync and
/// Standalone local storage for highlights are a planned follow-up; until then
/// Standalone uses `EmptyHighlightDataSource` (reads empty, writes error), the
/// same "safe stand-in" convention as `EmptyProjectDataSource`.
protocol HighlightDataSource {
    func listHighlights(articleId: Int) async throws -> [Highlight]
    func createHighlight(articleId: Int, _ request: CreateHighlightRequest) async throws -> Highlight
    func deleteHighlight(articleId: Int, highlightId: Int) async throws

    func listHighlightComments(articleId: Int, highlightId: Int) async throws -> [Comment]
    func createHighlightComment(articleId: Int, highlightId: Int, _ request: CreateCommentRequest) async throws -> Comment
    func updateHighlightComment(articleId: Int, highlightId: Int, commentId: Int, _ request: UpdateCommentRequest) async throws -> Comment
    func deleteHighlightComment(articleId: Int, highlightId: Int, commentId: Int) async throws
}

/// Raised when highlights are used in a mode that has no server (Standalone).
struct HighlightUnavailableError: LocalizedError {
    var errorDescription: String? {
        "Highlights are only available in Server mode."
    }
}

/// Server-backed implementation: a thin wrapper around `APIClient`.
struct RemoteHighlightDataSource: HighlightDataSource {
    func listHighlights(articleId: Int) async throws -> [Highlight] {
        try await APIClient.shared.get(path: "/api/articles/\(articleId)/highlights")
    }

    func createHighlight(articleId: Int, _ request: CreateHighlightRequest) async throws -> Highlight {
        try await APIClient.shared.post(path: "/api/articles/\(articleId)/highlights", body: request)
    }

    func deleteHighlight(articleId: Int, highlightId: Int) async throws {
        try await APIClient.shared.delete(path: "/api/articles/\(articleId)/highlights/\(highlightId)")
    }

    func listHighlightComments(articleId: Int, highlightId: Int) async throws -> [Comment] {
        try await APIClient.shared.get(path: "/api/articles/\(articleId)/highlights/\(highlightId)/comments")
    }

    func createHighlightComment(articleId: Int, highlightId: Int, _ request: CreateCommentRequest) async throws -> Comment {
        try await APIClient.shared.post(path: "/api/articles/\(articleId)/highlights/\(highlightId)/comments", body: request)
    }

    func updateHighlightComment(articleId: Int, highlightId: Int, commentId: Int, _ request: UpdateCommentRequest) async throws -> Comment {
        try await APIClient.shared.patch(path: "/api/articles/\(articleId)/highlights/\(highlightId)/comments/\(commentId)", body: request)
    }

    func deleteHighlightComment(articleId: Int, highlightId: Int, commentId: Int) async throws {
        try await APIClient.shared.delete(path: "/api/articles/\(articleId)/highlights/\(highlightId)/comments/\(commentId)")
    }
}

/// Standalone stand-in: no server, so reads are empty and writes error clearly.
struct EmptyHighlightDataSource: HighlightDataSource {
    func listHighlights(articleId: Int) async throws -> [Highlight] { [] }
    func createHighlight(articleId: Int, _ request: CreateHighlightRequest) async throws -> Highlight {
        throw HighlightUnavailableError()
    }
    func deleteHighlight(articleId: Int, highlightId: Int) async throws {
        throw HighlightUnavailableError()
    }
    func listHighlightComments(articleId: Int, highlightId: Int) async throws -> [Comment] { [] }
    func createHighlightComment(articleId: Int, highlightId: Int, _ request: CreateCommentRequest) async throws -> Comment {
        throw HighlightUnavailableError()
    }
    func updateHighlightComment(articleId: Int, highlightId: Int, commentId: Int, _ request: UpdateCommentRequest) async throws -> Comment {
        throw HighlightUnavailableError()
    }
    func deleteHighlightComment(articleId: Int, highlightId: Int, commentId: Int) async throws {
        throw HighlightUnavailableError()
    }
}

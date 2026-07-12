import Foundation

/// Data access seam for articles.
protocol ArticleDataSource {
    func listArticles(queryItems: [URLQueryItem]) async throws -> ArticleListResponse
    /// Same `/api/articles` endpoint as `listArticles`, but decoded into the
    /// slim shape the link-picker search uses.
    func searchArticles(queryItems: [URLQueryItem]) async throws -> SearchArticlesResponse
    func getArticle(id: Int) async throws -> Article
    func createArticle(_ request: CreateManualArticleRequest) async throws -> Article
    func updateArticle(id: Int, _ request: UpdateArticleRequest) async throws -> Article
    func bookmarkArticle(id: Int) async throws -> Article
    func unbookmarkArticle(id: Int) async throws -> Article
    func listComments(articleId: Int) async throws -> [Comment]
    func createComment(articleId: Int, _ request: CreateCommentRequest) async throws -> Comment
    func updateComment(articleId: Int, commentId: Int, _ request: UpdateCommentRequest) async throws -> Comment
    func deleteComment(articleId: Int, commentId: Int) async throws
    func deleteArticle(id: Int) async throws
}

extension ArticleDataSource {
    func createArticle(_ request: CreateManualArticleRequest) async throws -> Article { throw OfflineReadOnlyError() }
    func updateArticle(id: Int, _ request: UpdateArticleRequest) async throws -> Article { throw OfflineReadOnlyError() }
    func bookmarkArticle(id: Int) async throws -> Article { throw OfflineReadOnlyError() }
    func unbookmarkArticle(id: Int) async throws -> Article { throw OfflineReadOnlyError() }
    func listComments(articleId: Int) async throws -> [Comment] { throw OfflineReadOnlyError() }
    func createComment(articleId: Int, _ request: CreateCommentRequest) async throws -> Comment { throw OfflineReadOnlyError() }
    func updateComment(articleId: Int, commentId: Int, _ request: UpdateCommentRequest) async throws -> Comment { throw OfflineReadOnlyError() }
    func deleteComment(articleId: Int, commentId: Int) async throws { throw OfflineReadOnlyError() }
}

/// Server-backed implementation: a thin wrapper around `APIClient`.
struct RemoteArticleDataSource: ArticleDataSource {
    func listArticles(queryItems: [URLQueryItem]) async throws -> ArticleListResponse {
        try await APIClient.shared.get(path: "/api/articles", queryItems: queryItems)
    }

    func searchArticles(queryItems: [URLQueryItem]) async throws -> SearchArticlesResponse {
        try await APIClient.shared.get(path: "/api/articles", queryItems: queryItems)
    }

    func getArticle(id: Int) async throws -> Article {
        try await APIClient.shared.get(path: "/api/articles/\(id)")
    }

    func createArticle(_ request: CreateManualArticleRequest) async throws -> Article {
        try await APIClient.shared.post(path: "/api/articles", body: request)
    }

    func updateArticle(id: Int, _ request: UpdateArticleRequest) async throws -> Article {
        try await APIClient.shared.patch(path: "/api/articles/\(id)", body: request)
    }

    func bookmarkArticle(id: Int) async throws -> Article {
        try await APIClient.shared.postReturning(path: "/api/articles/\(id)/bookmark")
    }

    func unbookmarkArticle(id: Int) async throws -> Article {
        try await APIClient.shared.postReturning(path: "/api/articles/\(id)/unbookmark")
    }

    func listComments(articleId: Int) async throws -> [Comment] {
        try await APIClient.shared.get(path: "/api/articles/\(articleId)/comments")
    }

    func createComment(articleId: Int, _ request: CreateCommentRequest) async throws -> Comment {
        try await APIClient.shared.post(path: "/api/articles/\(articleId)/comments", body: request)
    }

    func updateComment(articleId: Int, commentId: Int, _ request: UpdateCommentRequest) async throws -> Comment {
        try await APIClient.shared.patch(path: "/api/articles/\(articleId)/comments/\(commentId)", body: request)
    }

    func deleteComment(articleId: Int, commentId: Int) async throws {
        try await APIClient.shared.delete(path: "/api/articles/\(articleId)/comments/\(commentId)")
    }

    func deleteArticle(id: Int) async throws {
        try await APIClient.shared.delete(path: "/api/articles/\(id)")
    }
}

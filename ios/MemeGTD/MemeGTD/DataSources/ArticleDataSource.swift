import Foundation

/// Data access seam for articles.
protocol ArticleDataSource {
    func listArticles(queryItems: [URLQueryItem]) async throws -> ArticleListResponse
    /// Same `/api/articles` endpoint as `listArticles`, but decoded into the
    /// slim shape the link-picker search uses.
    func searchArticles(queryItems: [URLQueryItem]) async throws -> SearchArticlesResponse
    func getArticle(id: Int) async throws -> Article
    func deleteArticle(id: Int) async throws
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

    func deleteArticle(id: Int) async throws {
        try await APIClient.shared.delete(path: "/api/articles/\(id)")
    }
}

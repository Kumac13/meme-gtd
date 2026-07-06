import Foundation

// Request model for creating an article
struct CreateArticleRequest: Codable {
    let title: String
    let bodyMd: String
    let originalUrl: String
    let siteName: String?
}

// Response model for article creation
struct ArticleResponse: Codable {
    let id: Int
    let type: String
    let title: String
    let bodyMd: String
    let meta: ArticleMeta
    let createdAt: String
    let updatedAt: String
    let isBookmarked: Bool
    let isDeleted: Bool
    let labels: [String]?
    let commentCount: Int?
}

// nonisolated: decoded inside the nonisolated offline read cache
// (OfflineFirstArticleDataSource) as well as on the MainActor.
nonisolated struct ArticleMeta: Codable {
    let originalUrl: String
    let siteName: String?
    let archivedAt: String
}

// Extracted article from JavaScript
struct ExtractedArticle: Codable {
    let title: String
    let content: String  // Markdown
    let siteName: String?
    let originalUrl: String
    let error: String?
}

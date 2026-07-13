import Foundation

enum ArticleOrigin: String, Codable {
    case web
    case manual
}

struct Article: Codable, Identifiable {
    let id: Int
    let type: String
    let title: String
    let bodyMd: String
    let origin: ArticleOrigin
    let meta: ArticleMeta?
    let createdAt: String
    let updatedAt: String
    let isBookmarked: Bool
    let isDeleted: Bool
    let labels: [String]?
    let commentCount: Int?
}

struct CreateManualArticleRequest: Codable {
    let title: String
    let bodyMd: String
    let labels: [String]?
}

struct UpdateArticleRequest: Codable {
    let title: String?
    let bodyMd: String?
}

struct ArticleListResponse: Codable {
    let data: [Article]
    let total: Int
    let limit: Int
    let offset: Int
}

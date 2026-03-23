import Foundation

struct Article: Codable, Identifiable {
    let id: Int
    let type: String
    let title: String
    let bodyMd: String
    let meta: ArticleMeta?
    let createdAt: String
    let updatedAt: String
    let isBookmarked: Bool
    let isDeleted: Bool
    let labels: [String]?
    let commentCount: Int?
}

struct ArticleListResponse: Codable {
    let data: [Article]
    let total: Int
    let limit: Int
    let offset: Int
}

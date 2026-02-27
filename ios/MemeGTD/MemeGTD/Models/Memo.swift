import Foundation

struct Memo: Codable, Identifiable {
    let id: Int
    let type: String
    let bodyMd: String
    let isBookmarked: Bool
    let isDeleted: Bool
    let createdAt: String
    let updatedAt: String
    let labels: [String]?
    let commentCount: Int?
}

struct MemoListResponse: Codable {
    let data: [Memo]
    let total: Int
    let limit: Int
    let offset: Int
}

struct CreateMemoRequest: Codable {
    let bodyMd: String
}

struct UpdateMemoRequest: Codable {
    let bodyMd: String?
    let isBookmarked: Bool?

    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encodeIfPresent(bodyMd, forKey: .bodyMd)
        try container.encodeIfPresent(isBookmarked, forKey: .isBookmarked)
    }

    enum CodingKeys: String, CodingKey {
        case bodyMd, isBookmarked
    }
}

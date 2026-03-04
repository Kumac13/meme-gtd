import Foundation

struct IssueLabel: Codable, Identifiable {
    let id: Int
    let name: String
    let description: String?
    let createdAt: String
    let memoCount: Int
    let taskCount: Int
    let articleCount: Int

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        id = try container.decode(Int.self, forKey: .id)
        name = try container.decode(String.self, forKey: .name)
        description = try container.decodeIfPresent(String.self, forKey: .description)
        createdAt = try container.decode(String.self, forKey: .createdAt)
        memoCount = try container.decodeIfPresent(Int.self, forKey: .memoCount) ?? 0
        taskCount = try container.decodeIfPresent(Int.self, forKey: .taskCount) ?? 0
        articleCount = try container.decodeIfPresent(Int.self, forKey: .articleCount) ?? 0
    }
}

struct AssignLabelRequest: Codable {
    let labelId: Int
}

struct AssignLabelResponse: Codable {
    let success: Bool
}

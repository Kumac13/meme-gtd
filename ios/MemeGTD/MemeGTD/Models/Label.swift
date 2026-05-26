import Foundation

struct IssueLabel: Codable, Identifiable {
    let id: Int
    let name: String
    let description: String?
    let createdAt: String
    let memoCount: Int
    let taskCount: Int
    let articleCount: Int
}

struct AssignLabelRequest: Codable {
    let labelId: Int
}

struct AssignLabelResponse: Codable {
    let success: Bool
}

struct CreateLabelRequest: Codable {
    let name: String
    let description: String?
}

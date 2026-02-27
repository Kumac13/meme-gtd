import Foundation

struct IssueLabel: Codable, Identifiable {
    let id: Int
    let name: String
    let description: String?
    let createdAt: String
}

struct AssignLabelRequest: Codable {
    let labelId: Int
}

struct AssignLabelResponse: Codable {
    let success: Bool
}

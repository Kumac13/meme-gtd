import Foundation

struct Comment: Codable, Identifiable {
    let id: Int
    let issueId: Int
    let bodyMd: String
    let createdAt: String
    let updatedAt: String
}

struct CreateCommentRequest: Codable {
    let bodyMd: String
}

struct UpdateCommentRequest: Codable {
    let bodyMd: String
}

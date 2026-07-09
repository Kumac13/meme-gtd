import Foundation

struct Comment: Codable, Identifiable {
    let id: Int
    let issueId: Int
    /// Set when this comment annotates an article highlight; nil for memo/task comments.
    let highlightId: Int?
    let bodyMd: String
    let createdAt: String
    let updatedAt: String

    init(
        id: Int,
        issueId: Int,
        highlightId: Int? = nil,
        bodyMd: String,
        createdAt: String,
        updatedAt: String
    ) {
        self.id = id
        self.issueId = issueId
        self.highlightId = highlightId
        self.bodyMd = bodyMd
        self.createdAt = createdAt
        self.updatedAt = updatedAt
    }
}

struct CreateCommentRequest: Codable {
    let bodyMd: String
}

struct UpdateCommentRequest: Codable {
    let bodyMd: String
}

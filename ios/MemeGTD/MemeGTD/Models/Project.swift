import Foundation

struct Project: Codable, Identifiable {
    let id: Int
    let name: String
    let description: String?
    let status: String
    let startDate: String?
    let endDate: String?
    let createdAt: String
}

struct ProjectItem: Codable {
    let id: Int
    let projectId: Int
    let issueId: Int
    let position: Int
    let createdAt: String
    let updatedAt: String
}

struct AddProjectItemRequest: Codable {
    let issueId: Int
}

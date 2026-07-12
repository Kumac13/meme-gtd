import Foundation

/// Mirror of packages/api/src/schemas/templateSchemas.ts (TemplateSchema).
/// `templateTarget` raw values ("task" / "article") must match the backend.
struct Template: Codable, Identifiable {
    let id: Int
    let type: String
    let templateTarget: String
    let title: String?
    let bodyMd: String
    let createdAt: String
    let updatedAt: String
    let isBookmarked: Bool
    let isDeleted: Bool
    let labels: [String]?
    let projectIds: [Int]?
}

struct TemplateListResponse: Codable {
    let data: [Template]
    let total: Int
    let limit: Int
    let offset: Int
}

/// Mirror of CreateTemplateRequestSchema.
struct CreateTemplateRequest: Encodable {
    let title: String
    let bodyMd: String
    let templateTarget: String
    let labels: [String]?
    let projectIds: [Int]?
}

/// Mirror of UpdateTemplateRequestSchema (partial).
struct UpdateTemplateRequest: Encodable {
    var title: String?
    var bodyMd: String?
    var templateTarget: String?
    var labels: [String]?
    var projectIds: [Int]?
}

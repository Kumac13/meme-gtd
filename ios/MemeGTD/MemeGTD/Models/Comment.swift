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
    let clientUuid: String?

    init(bodyMd: String, clientUuid: String? = nil) {
        self.bodyMd = bodyMd
        self.clientUuid = clientUuid
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encode(bodyMd, forKey: .bodyMd)
        try container.encodeIfPresent(clientUuid, forKey: .clientUuid)
    }

    enum CodingKeys: String, CodingKey {
        case bodyMd, clientUuid
    }
}

struct UpdateCommentRequest: Codable {
    let bodyMd: String
}

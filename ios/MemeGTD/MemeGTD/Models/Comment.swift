import Foundation

struct Comment: Codable, Identifiable {
    let id: Int
    let issueId: Int
    let bodyMd: String
    let createdAt: String
    let updatedAt: String
    /// Local-only field. See `Memo.syncState` for rationale.
    var syncState: String?

    init(
        id: Int,
        issueId: Int,
        bodyMd: String,
        createdAt: String,
        updatedAt: String,
        syncState: String? = nil
    ) {
        self.id = id
        self.issueId = issueId
        self.bodyMd = bodyMd
        self.createdAt = createdAt
        self.updatedAt = updatedAt
        self.syncState = syncState
    }

    enum CodingKeys: String, CodingKey {
        case id, issueId, bodyMd, createdAt, updatedAt
        // syncState excluded — local-only.
    }
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

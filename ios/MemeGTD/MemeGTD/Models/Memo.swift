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
    /// Local-only field. Set when the DTO is produced from a LocalMemo with
    /// a non-`.synced` state; `nil` for memos that come straight from the
    /// API. The View uses this to draw the pending / conflict indicator.
    var syncState: String?

    init(
        id: Int,
        type: String,
        bodyMd: String,
        isBookmarked: Bool,
        isDeleted: Bool,
        createdAt: String,
        updatedAt: String,
        labels: [String]? = nil,
        commentCount: Int? = nil,
        syncState: String? = nil
    ) {
        self.id = id
        self.type = type
        self.bodyMd = bodyMd
        self.isBookmarked = isBookmarked
        self.isDeleted = isDeleted
        self.createdAt = createdAt
        self.updatedAt = updatedAt
        self.labels = labels
        self.commentCount = commentCount
        self.syncState = syncState
    }

    enum CodingKeys: String, CodingKey {
        case id, type, bodyMd, isBookmarked, isDeleted, createdAt, updatedAt, labels, commentCount
        // syncState is intentionally excluded: it is local-only and must
        // not be sent to or expected from the API.
    }
}

struct MemoListResponse: Codable {
    let data: [Memo]
    let total: Int
    let limit: Int
    let offset: Int
}

struct CreateMemoRequest: Codable {
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

struct PromotePreviewLinkTarget: Codable {
    let id: Int
    let type: String
    let title: String
}

struct PromotePreviewLink: Codable {
    let direction: String
    let linkType: String
    let targetIssue: PromotePreviewLinkTarget
}

struct PromotePreviewResponse: Codable {
    let bodyMd: String
    let labels: [String]
    let projectIds: [Int]
    let linkedIssues: [PromotePreviewLink]
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

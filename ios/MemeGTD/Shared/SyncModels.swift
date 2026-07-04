import Foundation

// Mirrors packages/api/src/schemas/syncSchemas.ts (sync endpoints, Phase 2).
// Not referenced by the UI yet — the SyncEngine (Phase 5) will consume these.
// Raw values must match the backend strings exactly.

nonisolated enum SyncEntity: String, Codable {
    case issue
    case comment
    case label
    case issueLabel = "issue_label"
}

nonisolated enum SyncChangeOp: String, Codable {
    case upsert
    case delete
}

/// Loose JSON value for `SyncChange.data`, whose shape depends on entity/op.
/// Self-contained (no dependency on app-target types) so both the app and the
/// Share Extension can compile this file.
nonisolated enum SyncJSONValue: Codable {
    case string(String)
    case number(Double)
    case bool(Bool)
    case null
    case array([SyncJSONValue])
    case object([String: SyncJSONValue])

    init(from decoder: Decoder) throws {
        let container = try decoder.singleValueContainer()
        if container.decodeNil() {
            self = .null
        } else if let value = try? container.decode(Bool.self) {
            self = .bool(value)
        } else if let value = try? container.decode(Double.self) {
            self = .number(value)
        } else if let value = try? container.decode(String.self) {
            self = .string(value)
        } else if let value = try? container.decode([SyncJSONValue].self) {
            self = .array(value)
        } else if let value = try? container.decode([String: SyncJSONValue].self) {
            self = .object(value)
        } else {
            throw DecodingError.dataCorruptedError(
                in: container,
                debugDescription: "Unsupported JSON value in SyncChange.data"
            )
        }
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.singleValueContainer()
        switch self {
        case .string(let value): try container.encode(value)
        case .number(let value): try container.encode(value)
        case .bool(let value): try container.encode(value)
        case .null: try container.encodeNil()
        case .array(let value): try container.encode(value)
        case .object(let value): try container.encode(value)
        }
    }
}

/// One entry of GET /api/sync/changes.
/// data shape by entity (op = upsert):
/// - issue: full issue row incl. isDeleted (soft-deleted rows included)
/// - comment: { id, uuid, issueId, issueUuid, bodyMd, createdAt, updatedAt, isDeleted }
/// - label: { id, name, description, createdAt }
/// - issue_label: { issueId, labelId, issueUuid, labelName, assignedAt }
/// op = delete (labels / issue_labels only): integer ids plus labelName /
/// issueUuid when resolvable at delete time, and deletedAt.
nonisolated struct SyncChange: Codable {
    let serverSeq: Int
    let entity: SyncEntity
    let op: SyncChangeOp
    let data: [String: SyncJSONValue]
}

nonisolated struct SyncChangesResponse: Codable {
    let changes: [SyncChange]
    let latestSeq: Int
    let hasMore: Bool
}

/// memo / comment support create/update/delete; the bulk-migration entities
/// (task / article / label / issueLabel / link) support create only
/// (iOS Standalone -> Server one-way migration, Phase 12).
nonisolated enum SyncPushEntity: String, Codable {
    case memo
    case comment
    case task
    case article
    case label
    case issueLabel = "issue_label"
    case link
}

nonisolated enum SyncPushOpType: String, Codable {
    case create
    case update
    case delete
}

/// Article metadata carried by article create operations.
nonisolated struct SyncPushArticleMeta: Codable {
    var originalUrl: String?
    var siteName: String?
    var archivedAt: String?
}

/// Union of the per-entity payload shapes; which fields apply depends on
/// the operation's entity (see syncSchemas.ts for the required sets).
nonisolated struct SyncPushPayload: Codable {
    // memo / comment / task / article
    var bodyMd: String?
    var isBookmarked: Bool?
    var createdAt: String?
    var updatedAt: String?
    // task / article
    var title: String?
    // task (raw values match backend TaskStatus / TaskKind strings)
    var status: String?
    var taskKind: String?
    var scheduledStart: String?
    var scheduledEnd: String?
    var isAllDay: Bool?
    var scheduledOn: String?
    var actualStart: String?
    var actualEnd: String?
    // article
    var meta: SyncPushArticleMeta?
    // label (name is the natural key)
    var name: String?
    var description: String?
    // issue_label
    var issueUuid: String?
    var labelName: String?
    // link (linkType raw values: parent / child / relates / derived_from)
    var sourceIssueUuid: String?
    var targetIssueUuid: String?
    var linkType: String?
}

nonisolated struct SyncPushOperation: Codable {
    let opId: String
    let entity: SyncPushEntity
    let type: SyncPushOpType
    let uuid: String
    var issueUuid: String?
    var baseUpdatedAt: String?
    var payload: SyncPushPayload?
}

nonisolated struct SyncPushRequest: Codable {
    let deviceId: String
    let operations: [SyncPushOperation]
}

nonisolated enum SyncPushStatus: String, Codable {
    case applied
    case alreadyApplied
    case conflictCopied
    case skipped
}

nonisolated struct SyncPushOperationResult: Codable {
    let opId: String
    let status: SyncPushStatus
    let uuid: String
    let serverId: Int?
    let updatedAt: String?
    let conflictCopyUuid: String?
    /// Explanation for skipped bulk-migration operations
    /// (e.g. unresolved issue/label reference).
    let reason: String?

    init(
        opId: String,
        status: SyncPushStatus,
        uuid: String,
        serverId: Int?,
        updatedAt: String?,
        conflictCopyUuid: String?,
        reason: String? = nil
    ) {
        self.opId = opId
        self.status = status
        self.uuid = uuid
        self.serverId = serverId
        self.updatedAt = updatedAt
        self.conflictCopyUuid = conflictCopyUuid
        self.reason = reason
    }
}

nonisolated struct SyncPushResponse: Codable {
    let results: [SyncPushOperationResult]
    let latestSeq: Int
}

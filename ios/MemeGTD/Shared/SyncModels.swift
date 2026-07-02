import Foundation

// Mirrors packages/api/src/schemas/syncSchemas.ts (sync endpoints, Phase 2).
// Not referenced by the UI yet — the SyncEngine (Phase 5) will consume these.
// Raw values must match the backend strings exactly.

enum SyncEntity: String, Codable {
    case issue
    case comment
    case label
    case issueLabel = "issue_label"
}

enum SyncChangeOp: String, Codable {
    case upsert
    case delete
}

/// Loose JSON value for `SyncChange.data`, whose shape depends on entity/op.
/// Self-contained (no dependency on app-target types) so both the app and the
/// Share Extension can compile this file.
enum SyncJSONValue: Codable {
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
struct SyncChange: Codable {
    let serverSeq: Int
    let entity: SyncEntity
    let op: SyncChangeOp
    let data: [String: SyncJSONValue]
}

struct SyncChangesResponse: Codable {
    let changes: [SyncChange]
    let latestSeq: Int
    let hasMore: Bool
}

enum SyncPushEntity: String, Codable {
    case memo
    case comment
}

enum SyncPushOpType: String, Codable {
    case create
    case update
    case delete
}

struct SyncPushPayload: Codable {
    var bodyMd: String?
    var isBookmarked: Bool?
    var createdAt: String?
    var updatedAt: String?
}

struct SyncPushOperation: Codable {
    let opId: String
    let entity: SyncPushEntity
    let type: SyncPushOpType
    let uuid: String
    var issueUuid: String?
    var baseUpdatedAt: String?
    var payload: SyncPushPayload?
}

struct SyncPushRequest: Codable {
    let deviceId: String
    let operations: [SyncPushOperation]
}

enum SyncPushStatus: String, Codable {
    case applied
    case alreadyApplied
    case conflictCopied
    case skipped
}

struct SyncPushOperationResult: Codable {
    let opId: String
    let status: SyncPushStatus
    let uuid: String
    let serverId: Int?
    let updatedAt: String?
    let conflictCopyUuid: String?
}

struct SyncPushResponse: Codable {
    let results: [SyncPushOperationResult]
    let latestSeq: Int
}

import Foundation
import SwiftData

/// Persistent queue entry representing a pending write the server has not yet
/// confirmed. Survives app restart, crash, and prolonged offline periods.
///
/// Order is determined by `enqueuedAt` (ascending). Within a single
/// `memoLocalId`, operations must execute in enqueue order: a
/// `createComment` referencing a memo cannot run before the memo's own
/// `createMemo` has succeeded and obtained a `remoteId`.
@Model
final class OutboxOperation {
    @Attribute(.unique) var id: UUID
    var kindRaw: String

    /// "memo" or "comment". Used so we can scope queries cheaply.
    var targetType: String

    /// LocalMemo this op belongs to (always set, even for comment ops).
    var memoLocalId: UUID

    /// LocalComment when the op targets a comment; otherwise nil.
    var commentLocalId: UUID?

    /// JSON payload — operation-specific (e.g. `{"bodyMd":"..."}` for update).
    var payloadJson: String

    /// Idempotency key for the API call. Reused across retries.
    var clientUuid: String

    var retryCount: Int
    var lastError: String?
    var lastTriedAt: Date?
    var enqueuedAt: Date

    init(
        id: UUID = UUID(),
        kind: OutboxKindRaw,
        targetType: String,
        memoLocalId: UUID,
        commentLocalId: UUID? = nil,
        payloadJson: String = "{}",
        clientUuid: String,
        retryCount: Int = 0,
        lastError: String? = nil,
        lastTriedAt: Date? = nil,
        enqueuedAt: Date
    ) {
        self.id = id
        self.kindRaw = kind.rawValue
        self.targetType = targetType
        self.memoLocalId = memoLocalId
        self.commentLocalId = commentLocalId
        self.payloadJson = payloadJson
        self.clientUuid = clientUuid
        self.retryCount = retryCount
        self.lastError = lastError
        self.lastTriedAt = lastTriedAt
        self.enqueuedAt = enqueuedAt
    }

    var kind: OutboxKindRaw {
        get { OutboxKindRaw(rawValue: kindRaw) ?? .createMemo }
        set { kindRaw = newValue.rawValue }
    }
}

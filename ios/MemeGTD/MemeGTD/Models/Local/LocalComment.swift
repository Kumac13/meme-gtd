import Foundation
import SwiftData

/// SwiftData persistent record for a memo comment.
@Model
final class LocalComment {
    @Attribute(.unique) var localId: UUID

    /// Server-assigned integer ID. `nil` while a `createComment` is pending.
    var remoteId: Int?

    /// Idempotency key sent to POST /api/memos/:id/comments.
    var clientUuid: String

    var bodyMd: String

    var createdAt: Date
    var updatedAt: Date
    var serverCreatedAt: Date?
    var serverUpdatedAt: Date?

    var isDeleted: Bool
    var syncStateRaw: String
    var lastSyncError: String?

    /// Parent memo. The inverse relationship is declared on LocalMemo.comments.
    var memo: LocalMemo?

    init(
        localId: UUID = UUID(),
        remoteId: Int? = nil,
        clientUuid: String,
        bodyMd: String,
        createdAt: Date,
        updatedAt: Date,
        serverCreatedAt: Date? = nil,
        serverUpdatedAt: Date? = nil,
        isDeleted: Bool = false,
        syncState: SyncStateRaw,
        lastSyncError: String? = nil,
        memo: LocalMemo? = nil
    ) {
        self.localId = localId
        self.remoteId = remoteId
        self.clientUuid = clientUuid
        self.bodyMd = bodyMd
        self.createdAt = createdAt
        self.updatedAt = updatedAt
        self.serverCreatedAt = serverCreatedAt
        self.serverUpdatedAt = serverUpdatedAt
        self.isDeleted = isDeleted
        self.syncStateRaw = syncState.rawValue
        self.lastSyncError = lastSyncError
        self.memo = memo
    }

    var syncState: SyncStateRaw {
        get { SyncStateRaw(rawValue: syncStateRaw) ?? .synced }
        set { syncStateRaw = newValue.rawValue }
    }
}

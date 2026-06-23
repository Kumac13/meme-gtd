import Foundation
import SwiftData

/// SwiftData persistent record for a memo. The local row is the source of
/// truth for UI rendering; `remoteId` is filled in once the server confirms
/// the create. `clientUuid` is the idempotency key sent to the API.
@Model
final class LocalMemo {
    /// Stable local identifier. Generated client-side once and never changes.
    @Attribute(.unique) var localId: UUID

    /// Server-assigned integer ID. `nil` while a `createMemo` is pending.
    var remoteId: Int?

    /// Idempotency key sent to POST /api/memos. Stable for the life of the row.
    var clientUuid: String

    var bodyMd: String
    var isBookmarked: Bool

    /// Soft-deletion flag. `true` means the row should be hidden from UI and
    /// (eventually) sent as DELETE to the server.
    var isDeleted: Bool

    /// Local creation time, used for display until the server timestamp arrives.
    var createdAt: Date

    /// Local last-edit time, refreshed on every local edit.
    var updatedAt: Date

    /// Server timestamps, populated after pull/push. May be older than the
    /// local timestamps if there are pending edits.
    var serverCreatedAt: Date?
    var serverUpdatedAt: Date?

    /// JSON array of label names (matches API shape).
    var labelsJson: String

    /// Cached comment count from the API. Authoritative once `syncState ==
    /// .synced`; advisory while edits are pending.
    var commentCount: Int

    /// Current sync state. Drives Outbox processing and UI badges.
    var syncStateRaw: String

    /// Last server / network error message, if any. Cleared on success.
    var lastSyncError: String?

    /// Comments attached to this memo. Cascaded delete: removing the memo
    /// also removes its local comments.
    @Relationship(deleteRule: .cascade, inverse: \LocalComment.memo)
    var comments: [LocalComment]

    init(
        localId: UUID = UUID(),
        remoteId: Int? = nil,
        clientUuid: String,
        bodyMd: String,
        isBookmarked: Bool = false,
        isDeleted: Bool = false,
        createdAt: Date,
        updatedAt: Date,
        serverCreatedAt: Date? = nil,
        serverUpdatedAt: Date? = nil,
        labelsJson: String = "[]",
        commentCount: Int = 0,
        syncState: SyncStateRaw,
        lastSyncError: String? = nil
    ) {
        self.localId = localId
        self.remoteId = remoteId
        self.clientUuid = clientUuid
        self.bodyMd = bodyMd
        self.isBookmarked = isBookmarked
        self.isDeleted = isDeleted
        self.createdAt = createdAt
        self.updatedAt = updatedAt
        self.serverCreatedAt = serverCreatedAt
        self.serverUpdatedAt = serverUpdatedAt
        self.labelsJson = labelsJson
        self.commentCount = commentCount
        self.syncStateRaw = syncState.rawValue
        self.lastSyncError = lastSyncError
        self.comments = []
    }

    var syncState: SyncStateRaw {
        get { SyncStateRaw(rawValue: syncStateRaw) ?? .synced }
        set { syncStateRaw = newValue.rawValue }
    }

    /// Decoded label array. Returns `[]` if `labelsJson` is malformed.
    var labels: [String] {
        get {
            guard let data = labelsJson.data(using: .utf8),
                  let decoded = try? JSONDecoder().decode([String].self, from: data) else {
                return []
            }
            return decoded
        }
        set {
            let data = (try? JSONEncoder().encode(newValue)) ?? Data("[]".utf8)
            labelsJson = String(data: data, encoding: .utf8) ?? "[]"
        }
    }
}

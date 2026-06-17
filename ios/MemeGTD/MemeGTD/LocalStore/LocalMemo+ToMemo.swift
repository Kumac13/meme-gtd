import Foundation

extension String {
    /// Stable, run-independent hash (djb2). Swift's built-in `hashValue` is
    /// salted with a per-process seed so it would produce different synthetic
    /// memo ids after each app restart — useless for UI continuity across
    /// background sync.
    var stableHash: Int {
        var hash: UInt64 = 5381
        for byte in self.utf8 {
            hash = ((hash &* 33) &+ UInt64(byte))
        }
        return Int(bitPattern: UInt(truncatingIfNeeded: hash))
    }
}

extension LocalMemo {
    /// Synthetic negative integer id derived purely from a local ULID.
    /// Exposed so other layers (MemoStore, SyncEngine) can locate the same
    /// pending row in the in-memory list without having to retain a full
    /// `LocalMemo` value.
    static func syntheticDisplayId(forLocalId id: String) -> Int {
        let raw = id.stableHash
        if raw == Int.min { return Int.min + 1 }   // -Int.min would overflow
        return -abs(raw)
    }

    /// Integer id the SwiftUI list should use for this memo. Falls back to a
    /// negative ULID-derived synthetic id while the row is still pending sync,
    /// so the list row has a stable identity through the optimistic-display
    /// window. Once `serverId` is populated, the real server id takes over.
    var displayId: Int {
        if let serverId = serverId { return Int(serverId) }
        return Self.syntheticDisplayId(forLocalId: id)
    }

    /// Bridges a `LocalMemo` row into the existing wire-shape `Memo` struct
    /// so we can hand pending rows to MemoStore without inventing a separate
    /// rendering path. Fields the local row doesn't carry yet (labels,
    /// commentCount) default to empty so the row renders cleanly.
    func toMemo(iso: ISO8601DateFormatter) -> Memo {
        Memo(
            id: displayId,
            type: "memo",
            bodyMd: bodyMd,
            isBookmarked: isBookmarked,
            isDeleted: isDeleted,
            createdAt: iso.string(from: createdAt),
            updatedAt: iso.string(from: updatedAt),
            labels: [],
            commentCount: 0
        )
    }
}

import Foundation

extension String {
    /// Stable, run-independent FNV-1a 64-bit hash. Swift's built-in `hashValue`
    /// is salted with a per-process seed so it would produce different
    /// synthetic memo ids after each app restart — useless for UI continuity
    /// across background sync. Upgraded from djb2 (32-bit effective output)
    /// to make collision probability across a user's full pending queue
    /// astronomically small.
    var stableHash: UInt64 {
        var hash: UInt64 = 0xcbf29ce484222325 // FNV offset basis
        let prime: UInt64 = 0x100000001b3     // FNV prime
        for byte in self.utf8 {
            hash = (hash ^ UInt64(byte)) &* prime
        }
        return hash
    }
}

extension LocalMemo {
    /// Synthetic negative integer id derived purely from a local ULID.
    /// Exposed so other layers (MemoStore, SyncEngine) can locate the same
    /// pending row in the in-memory list without having to retain a full
    /// `LocalMemo` value. Masking off the top bit keeps the value in the
    /// representable range of `Int` on 64-bit platforms so negation never
    /// overflows.
    static func syntheticDisplayId(forLocalId id: String) -> Int {
        let lower63 = id.stableHash & 0x7FFF_FFFF_FFFF_FFFF
        return -Int(lower63)
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

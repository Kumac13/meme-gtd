import Foundation

/// Converters between the SwiftData `LocalMemo` / `LocalComment` and the
/// `Memo` / `Comment` DTOs the view layer consumes today. The DTOs are kept
/// for compatibility with existing Views — once the View layer reads
/// `LocalMemo` directly via `@Query`, these helpers can be removed.
extension LocalMemo {
    /// Build a DTO for use in the existing view layer. Rows that have not
    /// yet been confirmed by the server (no `remoteId`) get a stable
    /// negative ID derived from the row's `localId` so SwiftUI's
    /// Identifiable conformance still works. Positive IDs are reserved for
    /// server-assigned PKs.
    func toMemo() -> Memo {
        Memo(
            id: remoteId ?? localId.stableLocalId,
            type: "memo",
            bodyMd: bodyMd,
            isBookmarked: isBookmarked,
            isDeleted: isDeleted,
            createdAt: LocalMemoMappings.isoString(from: createdAt),
            updatedAt: LocalMemoMappings.isoString(from: updatedAt),
            labels: labels,
            commentCount: commentCount,
            syncState: syncState == .synced ? nil : syncState.rawValue
        )
    }
}

extension LocalComment {
    func toComment() -> Comment {
        Comment(
            id: remoteId ?? localId.stableLocalId,
            issueId: memo?.remoteId ?? (memo?.localId.stableLocalId ?? 0),
            bodyMd: bodyMd,
            createdAt: LocalMemoMappings.isoString(from: createdAt),
            updatedAt: LocalMemoMappings.isoString(from: updatedAt),
            syncState: syncState == .synced ? nil : syncState.rawValue
        )
    }
}

enum LocalMemoMappings {
    static let formatter: ISO8601DateFormatter = {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return f
    }()

    static func isoString(from date: Date) -> String {
        formatter.string(from: date)
    }
}

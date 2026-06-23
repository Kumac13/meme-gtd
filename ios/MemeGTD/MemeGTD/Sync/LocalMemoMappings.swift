import Foundation

/// Converters between the SwiftData `LocalMemo` / `LocalComment` and the
/// `Memo` / `Comment` DTOs the view layer consumes today. The DTOs are kept
/// for compatibility with existing Views — once the View layer reads
/// `LocalMemo` directly via `@Query`, these helpers can be removed.
extension LocalMemo {
    /// Build a DTO for use in the existing view layer. Memos that have not
    /// yet been confirmed by the server (no `remoteId`) are returned with
    /// `id == 0`; callers that present pending memos should pair the DTO
    /// with `localId` for identity. List-view code skips zero-id memos
    /// today (PR 4 cache is read-only against the server).
    func toMemo() -> Memo {
        Memo(
            id: remoteId ?? 0,
            type: "memo",
            bodyMd: bodyMd,
            isBookmarked: isBookmarked,
            isDeleted: isDeleted,
            createdAt: LocalMemoMappings.isoString(from: createdAt),
            updatedAt: LocalMemoMappings.isoString(from: updatedAt),
            labels: labels,
            commentCount: commentCount
        )
    }
}

extension LocalComment {
    func toComment() -> Comment {
        Comment(
            id: remoteId ?? 0,
            issueId: memo?.remoteId ?? 0,
            bodyMd: bodyMd,
            createdAt: LocalMemoMappings.isoString(from: createdAt),
            updatedAt: LocalMemoMappings.isoString(from: updatedAt)
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

import Foundation

/// Data access seam for memos and their comments. Mirrors the API surface the
/// ViewModels use today so future phases can swap in offline/local
/// implementations without touching the ViewModels.
protocol MemoDataSource {
    func listMemos(queryItems: [URLQueryItem]) async throws -> MemoListResponse
    func getMemo(id: Int) async throws -> Memo
    func createMemo(_ request: CreateMemoRequest) async throws -> Memo
    func updateMemo(id: Int, _ request: UpdateMemoRequest) async throws -> Memo
    func deleteMemo(id: Int) async throws
    func bookmarkMemo(id: Int) async throws -> Memo
    func unbookmarkMemo(id: Int) async throws -> Memo
    func promotePreview(memoId: Int) async throws -> PromotePreviewResponse

    // Comments
    func listComments(memoId: Int) async throws -> [Comment]
    func createComment(memoId: Int, _ request: CreateCommentRequest) async throws -> Comment
    func updateComment(memoId: Int, commentId: Int, _ request: UpdateCommentRequest) async throws -> Comment
    func deleteComment(memoId: Int, commentId: Int) async throws
}

/// Server-backed implementation: a thin wrapper around `APIClient`.
struct RemoteMemoDataSource: MemoDataSource {
    func listMemos(queryItems: [URLQueryItem]) async throws -> MemoListResponse {
        try await APIClient.shared.get(path: "/api/memos", queryItems: queryItems)
    }

    func getMemo(id: Int) async throws -> Memo {
        try await APIClient.shared.get(path: "/api/memos/\(id)")
    }

    func createMemo(_ request: CreateMemoRequest) async throws -> Memo {
        try await APIClient.shared.post(path: "/api/memos", body: request)
    }

    func updateMemo(id: Int, _ request: UpdateMemoRequest) async throws -> Memo {
        try await APIClient.shared.patch(path: "/api/memos/\(id)", body: request)
    }

    func deleteMemo(id: Int) async throws {
        try await APIClient.shared.delete(path: "/api/memos/\(id)")
    }

    func bookmarkMemo(id: Int) async throws -> Memo {
        try await APIClient.shared.postReturning(path: "/api/memos/\(id)/bookmark")
    }

    func unbookmarkMemo(id: Int) async throws -> Memo {
        try await APIClient.shared.postReturning(path: "/api/memos/\(id)/unbookmark")
    }

    func promotePreview(memoId: Int) async throws -> PromotePreviewResponse {
        try await APIClient.shared.get(path: "/api/memos/\(memoId)/promote-preview")
    }

    // MARK: - Comments

    func listComments(memoId: Int) async throws -> [Comment] {
        try await APIClient.shared.get(path: "/api/memos/\(memoId)/comments")
    }

    func createComment(memoId: Int, _ request: CreateCommentRequest) async throws -> Comment {
        try await APIClient.shared.post(path: "/api/memos/\(memoId)/comments", body: request)
    }

    func updateComment(memoId: Int, commentId: Int, _ request: UpdateCommentRequest) async throws -> Comment {
        try await APIClient.shared.patch(path: "/api/memos/\(memoId)/comments/\(commentId)", body: request)
    }

    func deleteComment(memoId: Int, commentId: Int) async throws {
        try await APIClient.shared.delete(path: "/api/memos/\(memoId)/comments/\(commentId)")
    }
}

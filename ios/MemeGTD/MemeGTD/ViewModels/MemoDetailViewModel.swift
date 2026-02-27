import Foundation

@MainActor
class MemoDetailViewModel: ObservableObject {
    @Published var memo: Memo?
    @Published var comments: [Comment] = []
    @Published var isLoading: Bool = false
    @Published var error: String?
    @Published var replyBody: String = ""
    @Published var isSubmittingReply: Bool = false
    @Published var isBookmarking: Bool = false

    let memoId: Int

    init(memoId: Int) {
        self.memoId = memoId
    }

    func loadMemo() async {
        isLoading = true
        error = nil

        do {
            memo = try await APIClient.shared.get(path: "/api/memos/\(memoId)")
            let commentList: [Comment] = try await APIClient.shared.get(
                path: "/api/memos/\(memoId)/comments"
            )
            comments = commentList
        } catch {
            self.error = error.localizedDescription
        }

        isLoading = false
    }

    func toggleBookmark() async {
        guard let currentMemo = memo else { return }
        isBookmarking = true

        do {
            let path = currentMemo.isBookmarked
                ? "/api/memos/\(memoId)/unbookmark"
                : "/api/memos/\(memoId)/bookmark"
            let updated: Memo = try await APIClient.shared.postReturning(path: path)
            memo = updated
            HapticManager.impact(.light)
        } catch {
            self.error = error.localizedDescription
            HapticManager.notification(.error)
        }

        isBookmarking = false
    }

    func addComment() async {
        let body = replyBody.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !body.isEmpty else { return }

        isSubmittingReply = true

        do {
            let request = CreateCommentRequest(bodyMd: body)
            let comment: Comment = try await APIClient.shared.post(
                path: "/api/memos/\(memoId)/comments",
                body: request
            )
            comments.append(comment)
            replyBody = ""
            HapticManager.notification(.success)
        } catch {
            self.error = error.localizedDescription
            HapticManager.notification(.error)
        }

        isSubmittingReply = false
    }

    func updateComment(_ commentId: Int, bodyMd: String) async {
        do {
            let request = UpdateCommentRequest(bodyMd: bodyMd)
            let updated: Comment = try await APIClient.shared.patch(
                path: "/api/memos/\(memoId)/comments/\(commentId)",
                body: request
            )
            if let index = comments.firstIndex(where: { $0.id == commentId }) {
                comments[index] = updated
            }
        } catch {
            self.error = error.localizedDescription
        }
    }

    func deleteComment(_ commentId: Int) async {
        do {
            try await APIClient.shared.delete(
                path: "/api/memos/\(memoId)/comments/\(commentId)"
            )
            comments.removeAll { $0.id == commentId }
        } catch {
            self.error = error.localizedDescription
        }
    }

    func deleteMemo() async -> Bool {
        do {
            try await APIClient.shared.delete(path: "/api/memos/\(memoId)")
            return true
        } catch {
            self.error = error.localizedDescription
            return false
        }
    }
}

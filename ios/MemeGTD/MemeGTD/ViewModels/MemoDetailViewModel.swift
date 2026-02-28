import Combine
import SwiftUI

@MainActor
class MemoDetailViewModel: ObservableObject {
    @Published var memo: Memo?
    @Published var comments: [Comment] = []
    @Published var isLoading: Bool = false
    @Published var error: String?
    @Published var replyBody: String = ""
    @Published var isSubmittingReply: Bool = false
    @Published var isBookmarking: Bool = false

    // Projects & Labels
    @Published var associatedProjects: [Project] = []
    @Published var allProjects: [Project] = []
    @Published var allLabels: [IssueLabel] = []

    let memoId: Int

    init(memoId: Int) {
        self.memoId = memoId
    }

    // MARK: - Load

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

        // Load projects & labels in parallel
        async let projectsResult: () = loadProjects()
        async let labelsResult: () = loadAllLabels()
        _ = await (projectsResult, labelsResult)

        isLoading = false
    }

    // MARK: - Fetch without UI update (for pull-to-refresh)

    func fetchMemo() async -> (Memo, [Comment])? {
        do {
            let memo: Memo = try await APIClient.shared.get(path: "/api/memos/\(memoId)")
            let commentList: [Comment] = try await APIClient.shared.get(
                path: "/api/memos/\(memoId)/comments"
            )
            return (memo, commentList)
        } catch {
            self.error = error.localizedDescription
            return nil
        }
    }

    func applyMemo(_ memo: Memo, comments: [Comment]) {
        self.memo = memo
        self.comments = comments
    }

    private func loadProjects() async {
        do {
            associatedProjects = try await APIClient.shared.get(path: "/api/issues/\(memoId)/projects")
            allProjects = try await APIClient.shared.get(path: "/api/projects")
        } catch {
            // Non-critical, just log
        }
    }

    private func loadAllLabels() async {
        do {
            allLabels = try await APIClient.shared.get(path: "/api/labels")
        } catch {
            // Non-critical
        }
    }

    // MARK: - Bookmark

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

    // MARK: - Comments

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

    // MARK: - Update Memo

    func updateMemo(bodyMd: String) async {
        do {
            let request = UpdateMemoRequest(bodyMd: bodyMd, isBookmarked: nil)
            let updated: Memo = try await APIClient.shared.patch(
                path: "/api/memos/\(memoId)",
                body: request
            )
            memo = updated
            HapticManager.notification(.success)
        } catch {
            self.error = error.localizedDescription
            HapticManager.notification(.error)
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

    // MARK: - Projects (confirm-based: apply diff on confirm)

    func confirmProjects(_ selectedIds: Set<Int>) {
        let currentIds = Set(associatedProjects.map(\.id))
        let toAdd = selectedIds.subtracting(currentIds)
        let toRemove = currentIds.subtracting(selectedIds)

        Task {
            for projectId in toAdd {
                do {
                    let _: ProjectItem = try await APIClient.shared.post(
                        path: "/api/projects/\(projectId)/items",
                        body: AddProjectItemRequest(issueId: memoId)
                    )
                } catch {
                    self.error = error.localizedDescription
                }
            }
            for projectId in toRemove {
                do {
                    try await APIClient.shared.delete(
                        path: "/api/projects/\(projectId)/items/\(memoId)"
                    )
                } catch {
                    self.error = error.localizedDescription
                }
            }
            // Reload
            await loadProjects()
        }
    }

    // MARK: - Labels (confirm-based: apply diff on confirm)

    func confirmLabels(_ selectedNames: Set<String>) {
        let currentNames = Set(memo?.labels ?? [])
        let toAdd = selectedNames.subtracting(currentNames)
        let toRemove = currentNames.subtracting(selectedNames)

        Task {
            for name in toAdd {
                if let label = allLabels.first(where: { $0.name == name }) {
                    do {
                        let _: AssignLabelResponse = try await APIClient.shared.post(
                            path: "/api/issues/\(memoId)/labels",
                            body: AssignLabelRequest(labelId: label.id)
                        )
                    } catch {
                        self.error = error.localizedDescription
                    }
                }
            }
            for name in toRemove {
                if let label = allLabels.first(where: { $0.name == name }) {
                    do {
                        try await APIClient.shared.delete(
                            path: "/api/issues/\(memoId)/labels/\(label.id)"
                        )
                    } catch {
                        self.error = error.localizedDescription
                    }
                }
            }
            // Reload memo to get updated labels
            do {
                let updated: Memo = try await APIClient.shared.get(path: "/api/memos/\(memoId)")
                memo = updated
            } catch {
                self.error = error.localizedDescription
            }
        }
    }

    // MARK: - Copy All Contents

    func copyAllContents() {
        guard let memo = memo else { return }

        var text = memo.bodyMd

        if !comments.isEmpty {
            text += "\n\n## Comments\n"
            for comment in comments {
                text += "\n---\n\n\(comment.bodyMd)"
            }
        }

        UIPasteboard.general.string = text
        HapticManager.notification(.success)
    }
}

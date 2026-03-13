import Combine
import SwiftUI

@MainActor
class MemoDetailViewModel: ObservableObject, IssueDetailProvider {
    var issueId: Int { memoId }
    var issueTypeLabel: String { "memo" }
    var isBookmarked: Bool { memo?.isBookmarked ?? false }
    var issueLabels: [String] { memo?.labels ?? [] }
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

    // Links
    @Published var issueLinks: [IssueLink] = []

    var linkedPickerItems: [IssuePickerItem] {
        issueLinks.map {
            IssuePickerItem(
                id: $0.targetIssue.id,
                type: $0.targetIssue.type,
                title: $0.targetIssue.title,
                status: $0.targetIssue.status,
                updatedAt: $0.createdAt
            )
        }
    }

    let memoId: Int
    var memoStore: MemoStore?

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

        // Load projects, labels & links in parallel
        async let projectsResult: () = loadProjects()
        async let labelsResult: () = loadAllLabels()
        async let linksResult: () = loadLinks()
        _ = await (projectsResult, labelsResult, linksResult)

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

    // MARK: - Links

    private func loadLinks() async {
        do {
            issueLinks = try await APIClient.shared.get(path: "/api/issues/\(memoId)/links")
        } catch {
            // Non-critical
        }
    }

    func createIssueLink(targetIssueId: Int, linkType: LinkType) async {
        do {
            let request = CreateLinkRequest(
                sourceIssueId: memoId,
                targetIssueId: targetIssueId,
                linkType: linkType
            )
            let _: CreateLinkResponse = try await APIClient.shared.post(
                path: "/api/links",
                body: request
            )
            await loadLinks()
            HapticManager.notification(.success)
        } catch {
            self.error = error.localizedDescription
            HapticManager.notification(.error)
        }
    }

    func deleteIssueLink(_ linkId: Int) async {
        do {
            try await APIClient.shared.delete(path: "/api/links/\(linkId)")
            issueLinks.removeAll { $0.id == linkId }
        } catch {
            self.error = error.localizedDescription
        }
    }

    func searchIssues(query: String) async -> [IssuePickerItem] {
        let trimmed = query.trimmingCharacters(in: .whitespacesAndNewlines)

        var results: [IssuePickerItem] = []

        await withTaskGroup(of: [IssuePickerItem].self) { group in
            // Build query items: include search param only when non-empty
            let searchQuery: [URLQueryItem] = trimmed.isEmpty ? [] : [
                URLQueryItem(name: "search", value: trimmed),
            ]

            // Search tasks
            group.addTask {
                do {
                    let response: SearchTasksResponse = try await APIClient.shared.get(
                        path: "/api/tasks",
                        queryItems: searchQuery
                    )
                    return response.data.map {
                        IssuePickerItem(id: $0.id, type: "task", title: $0.title, status: $0.status, updatedAt: $0.updatedAt)
                    }
                } catch {
                    return []
                }
            }

            // Search memos
            group.addTask {
                do {
                    let response: MemoListResponse = try await APIClient.shared.get(
                        path: "/api/memos",
                        queryItems: searchQuery
                    )
                    return response.data.map {
                        let firstLine = $0.bodyMd.components(separatedBy: "\n")
                            .first(where: { !$0.trimmingCharacters(in: .whitespaces).isEmpty }) ?? $0.bodyMd
                        let title = String(firstLine.prefix(50))
                        return IssuePickerItem(id: $0.id, type: "memo", title: title, status: nil, updatedAt: $0.updatedAt)
                    }
                } catch {
                    return []
                }
            }

            // Search articles
            group.addTask {
                do {
                    let response: SearchArticlesResponse = try await APIClient.shared.get(
                        path: "/api/articles",
                        queryItems: searchQuery
                    )
                    return response.data.map {
                        let title = $0.title.count > 50 ? String($0.title.prefix(50)) + "..." : $0.title
                        return IssuePickerItem(id: $0.id, type: "article", title: title, status: nil, updatedAt: $0.updatedAt)
                    }
                } catch {
                    return []
                }
            }

            for await items in group {
                results.append(contentsOf: items)
            }
        }

        // Exclude self, sort by updatedAt desc, limit to 10
        return results
            .filter { $0.id != memoId }
            .sorted { $0.updatedAt > $1.updatedAt }
            .prefix(10)
            .map { $0 }
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
            memoStore?.updateItem(updated)
            memoStore?.needsReload = true
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
            memoStore?.updateItem(updated)
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
            memoStore?.removeItem(memoId)
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
                memoStore?.updateItem(updated)
                memoStore?.needsReload = true
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

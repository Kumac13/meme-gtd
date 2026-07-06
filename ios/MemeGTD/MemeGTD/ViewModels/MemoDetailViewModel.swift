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
    @Published var urlLinks: [UrlLink] = []

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

    /// Data source seam. Views overwrite this with the app-wide provider from
    /// the environment (same wiring point as `memoStore`).
    var dataSources = DataSourceProvider()

    init(memoId: Int) {
        self.memoId = memoId
    }

    // MARK: - Load

    func loadMemo() async {
        isLoading = true
        error = nil

        do {
            memo = try await dataSources.memos.getMemo(id: memoId)
            let commentList: [Comment] = try await dataSources.memos.listComments(memoId: memoId)
            comments = commentList
        } catch {
            self.error = error.localizedDescription
        }

        // Load projects, labels & links in parallel
        async let projectsResult: () = loadProjects()
        async let labelsResult: () = loadAllLabels()
        async let linksResult: () = loadLinks()
        async let urlLinksResult: () = loadUrlLinks()
        _ = await (projectsResult, labelsResult, linksResult, urlLinksResult)

        isLoading = false
    }

    // MARK: - Fetch without UI update (for pull-to-refresh)

    func fetchMemo() async -> (Memo, [Comment])? {
        do {
            let memo: Memo = try await dataSources.memos.getMemo(id: memoId)
            let commentList: [Comment] = try await dataSources.memos.listComments(memoId: memoId)
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
            associatedProjects = try await dataSources.projects.listIssueProjects(issueId: memoId)
            allProjects = try await dataSources.projects.listProjects()
        } catch {
            // Non-critical, just log
        }
    }

    private func loadAllLabels() async {
        do {
            allLabels = try await dataSources.labels.listLabels()
        } catch {
            // Non-critical
        }
    }

    // MARK: - URL Links

    private func loadUrlLinks() async {
        do {
            urlLinks = try await dataSources.issueRelations.listUrlLinks(issueId: memoId)
        } catch {
            // Non-critical
        }
    }

    func createUrlLink(url: String, title: String?) async {
        do {
            let request = CreateUrlLinkRequest(url: url, title: title)
            let _: UrlLink = try await dataSources.issueRelations.createUrlLink(
                issueId: memoId,
                request
            )
            await loadUrlLinks()
            HapticManager.notification(.success)
        } catch {
            self.error = error.localizedDescription
            HapticManager.notification(.error)
        }
    }

    func deleteUrlLink(_ urlLinkId: Int) async {
        do {
            try await dataSources.issueRelations.deleteUrlLink(urlLinkId: urlLinkId)
            urlLinks.removeAll { $0.id == urlLinkId }
        } catch {
            self.error = error.localizedDescription
        }
    }

    // MARK: - Links

    private func loadLinks() async {
        do {
            issueLinks = try await dataSources.issueRelations.listLinks(issueId: memoId)
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
            let _: CreateLinkResponse = try await dataSources.issueRelations.createLink(request)
            await loadLinks()
            HapticManager.notification(.success)
        } catch {
            self.error = error.localizedDescription
            HapticManager.notification(.error)
        }
    }

    func deleteIssueLink(_ linkId: Int) async {
        do {
            try await dataSources.issueRelations.deleteLink(linkId: linkId)
            issueLinks.removeAll { $0.id == linkId }
        } catch {
            self.error = error.localizedDescription
        }
    }

    func searchIssues(query: String) async -> [IssuePickerItem] {
        let trimmed = query.trimmingCharacters(in: .whitespacesAndNewlines)

        var results: [IssuePickerItem] = []

        let dataSources = dataSources
        await withTaskGroup(of: [IssuePickerItem].self) { group in
            // Build query items: include search param only when non-empty
            let searchQuery: [URLQueryItem] = trimmed.isEmpty ? [] : [
                URLQueryItem(name: "search", value: trimmed),
            ]

            // Search tasks
            group.addTask {
                do {
                    let response: SearchTasksResponse = try await dataSources.tasks.searchTasks(
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
                    let response: MemoListResponse = try await dataSources.memos.listMemos(
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
                    let response: SearchArticlesResponse = try await dataSources.articles.searchArticles(
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

    // MARK: - Promote

    /// Server-computed preview of promoting this memo to a task (resolved
    /// body, labels, projects, and carried-over links).
    func promotePreview() async throws -> PromotePreviewResponse {
        try await dataSources.memos.promotePreview(memoId: memoId)
    }

    // MARK: - Bookmark

    func toggleBookmark() async {
        guard let currentMemo = memo else { return }
        isBookmarking = true

        do {
            let updated: Memo = currentMemo.isBookmarked
                ? try await dataSources.memos.unbookmarkMemo(id: memoId)
                : try await dataSources.memos.bookmarkMemo(id: memoId)
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
            let comment: Comment = try await dataSources.memos.createComment(
                memoId: memoId,
                request
            )
            comments.append(comment)
            replyBody = ""
            HapticManager.notification(.success)
            // Server may have created relates links from `#id` mentions.
            await loadLinks()
        } catch {
            self.error = error.localizedDescription
            HapticManager.notification(.error)
        }

        isSubmittingReply = false
    }

    func updateComment(_ commentId: Int, bodyMd: String) async {
        do {
            let request = UpdateCommentRequest(bodyMd: bodyMd)
            let updated: Comment = try await dataSources.memos.updateComment(
                memoId: memoId,
                commentId: commentId,
                request
            )
            if let index = comments.firstIndex(where: { $0.id == commentId }) {
                comments[index] = updated
            }
            await loadLinks()
        } catch {
            self.error = error.localizedDescription
        }
    }

    // MARK: - Update Memo

    func updateMemo(bodyMd: String) async {
        do {
            let request = UpdateMemoRequest(bodyMd: bodyMd, isBookmarked: nil)
            let updated: Memo = try await dataSources.memos.updateMemo(
                id: memoId,
                request
            )
            memo = updated
            memoStore?.updateItem(updated)
            HapticManager.notification(.success)
            await loadLinks()
        } catch {
            self.error = error.localizedDescription
            HapticManager.notification(.error)
        }
    }

    func deleteComment(_ commentId: Int) async {
        do {
            try await dataSources.memos.deleteComment(
                memoId: memoId,
                commentId: commentId
            )
            comments.removeAll { $0.id == commentId }
        } catch {
            self.error = error.localizedDescription
        }
    }

    func deleteMemo() async -> Bool {
        do {
            try await dataSources.memos.deleteMemo(id: memoId)
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
                    let _: ProjectItem = try await dataSources.projects.addProjectItem(
                        projectId: projectId,
                        AddProjectItemRequest(issueId: memoId)
                    )
                } catch {
                    self.error = error.localizedDescription
                }
            }
            for projectId in toRemove {
                do {
                    try await dataSources.projects.removeProjectItem(
                        projectId: projectId,
                        issueId: memoId
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

    func addNewLabel(_ label: IssueLabel) {
        if !allLabels.contains(where: { $0.id == label.id }) {
            allLabels.append(label)
        }
    }

    func confirmLabels(_ selectedNames: Set<String>) {
        let currentNames = Set(memo?.labels ?? [])
        let toAdd = selectedNames.subtracting(currentNames)
        let toRemove = currentNames.subtracting(selectedNames)

        Task {
            for name in toAdd {
                if let label = allLabels.first(where: { $0.name == name }) {
                    do {
                        let _: AssignLabelResponse = try await dataSources.labels.assignLabel(
                            issueId: memoId,
                            AssignLabelRequest(labelId: label.id)
                        )
                    } catch {
                        self.error = error.localizedDescription
                    }
                }
            }
            for name in toRemove {
                if let label = allLabels.first(where: { $0.name == name }) {
                    do {
                        try await dataSources.labels.removeLabel(
                            issueId: memoId,
                            labelId: label.id
                        )
                    } catch {
                        self.error = error.localizedDescription
                    }
                }
            }
            // Reload memo to get updated labels
            do {
                let updated: Memo = try await dataSources.memos.getMemo(id: memoId)
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

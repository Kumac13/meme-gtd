import Combine
import SwiftUI

@MainActor
class MemoDetailViewModel: ObservableObject, IssueMetadataProvider, IssueLinkProvider, IssueBookmarkProvider, IssueCopyProvider {
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
        IssueRelationService.pickerItems(from: issueLinks)
    }

    let memoId: Int
    var memoStore: MemoStore?

    /// Data source seam. Views overwrite this with the app-wide provider from
    /// the environment (same wiring point as `memoStore`).
    var dataSources = DataSourceProvider()

    private var issueRelationService: IssueRelationService {
        IssueRelationService(issueId: memoId, dataSource: dataSources.issueRelations)
    }

    private var issueMetadataService: IssueMetadataService {
        IssueMetadataService(issueId: memoId, dataSources: dataSources)
    }

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

        // Load metadata & links in parallel
        async let metadataResult: () = loadMetadataOptions()
        async let linksResult: () = loadLinks()
        async let urlLinksResult: () = loadUrlLinks()
        _ = await (metadataResult, linksResult, urlLinksResult)

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

    private func loadMetadataOptions() async {
        let options = await issueMetadataService.loadOptions()
        if let labels = options.labels { allLabels = labels }
        if let associated = options.associatedProjects { associatedProjects = associated }
        if let projects = options.allProjects { allProjects = projects }
    }

    private func reloadProjectOptions() async {
        let options = await issueMetadataService.loadProjectOptions()
        if let associated = options.associated { associatedProjects = associated }
        if let projects = options.all { allProjects = projects }
    }

    // MARK: - URL Links

    private func loadUrlLinks() async {
        do {
            urlLinks = try await issueRelationService.loadUrlLinks()
        } catch {
            // Non-critical
        }
    }

    func createUrlLink(url: String, title: String?) async {
        do {
            urlLinks = try await issueRelationService.createUrlLink(url: url, title: title)
            HapticManager.notification(.success)
        } catch {
            self.error = error.localizedDescription
            HapticManager.notification(.error)
        }
    }

    func deleteUrlLink(_ urlLinkId: Int) async {
        do {
            urlLinks = try await issueRelationService.deleteUrlLink(urlLinkId, from: urlLinks)
        } catch {
            self.error = error.localizedDescription
        }
    }

    // MARK: - Links

    private func loadLinks() async {
        do {
            issueLinks = try await issueRelationService.loadIssueLinks()
        } catch {
            // Non-critical
        }
    }

    func createIssueLink(targetIssueId: Int, linkType: LinkType) async {
        do {
            issueLinks = try await issueRelationService.createIssueLink(
                targetIssueId: targetIssueId,
                linkType: linkType
            )
            HapticManager.notification(.success)
        } catch {
            self.error = error.localizedDescription
            HapticManager.notification(.error)
        }
    }

    func deleteIssueLink(_ linkId: Int) async {
        do {
            issueLinks = try await issueRelationService.deleteIssueLink(linkId, from: issueLinks)
        } catch {
            self.error = error.localizedDescription
        }
    }

    func searchIssues(query: String) async -> [IssuePickerItem] {
        await IssuePickerSearchService(dataSources: dataSources).search(
            query: query,
            excludingIDs: [memoId]
        )
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

    func addComment() async -> Bool {
        let body = replyBody.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !body.isEmpty else { return false }

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
            isSubmittingReply = false
            return true
        } catch {
            self.error = error.localizedDescription
            HapticManager.notification(.error)
            isSubmittingReply = false
            return false
        }
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

        Task {
            do {
                try await issueMetadataService.applyProjects(
                    selectedIds: selectedIds,
                    currentIds: currentIds
                )
            } catch {
                self.error = error.localizedDescription
            }
            await reloadProjectOptions()
        }
    }

    // MARK: - Labels (confirm-based: apply diff on confirm)

    func addNewLabel(_ label: IssueLabel) {
        allLabels = issueMetadataService.reconciling(allLabels, with: label)
    }

    func confirmLabels(_ selectedNames: Set<String>) {
        let currentNames = Set(memo?.labels ?? [])

        Task {
            do {
                try await issueMetadataService.applyLabels(
                    selectedNames: selectedNames,
                    currentNames: currentNames,
                    allLabels: allLabels
                )
            } catch {
                self.error = error.localizedDescription
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

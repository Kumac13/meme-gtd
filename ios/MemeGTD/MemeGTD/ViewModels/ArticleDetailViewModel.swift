import Combine
import SwiftUI

@MainActor
class ArticleDetailViewModel: ObservableObject, IssueMetadataProvider, IssueLinkProvider, IssueBookmarkProvider, IssueCopyProvider {
    @Published var article: Article?
    @Published var isLoading: Bool = false
    @Published var error: String?
    @Published var isBookmarking: Bool = false
    @Published var activityLogs: [ActivityLogEntry] = []
    @Published var comments: [Comment] = []
    @Published var replyBody: String = ""
    @Published var isSubmittingReply: Bool = false

    // Activity event types to display in timeline
    private static let displayedEventTypes: Set<String> = [
        "label.assigned", "label.removed",
        "link.created", "link.deleted",
        "project.item_added", "project.item_removed",
    ]

    var timelineEntries: [TimelineEntry] {
        let activities = activityLogs
            .filter { Self.displayedEventTypes.contains($0.eventType) }
            .map { TimelineEntry.activity($0) }
        return (activities + comments.map { TimelineEntry.comment($0) })
            .sorted { $0.timestamp < $1.timestamp }
    }

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

    // Shared detail capabilities
    var issueTypeLabel: String { "article" }
    var isBookmarked: Bool { article?.isBookmarked ?? false }
    var issueLabels: [String] { article?.labels ?? [] }

    let articleId: Int
    var articleStore: ArticleStore?

    /// Data source seam. Views overwrite this with the app-wide provider from
    /// the environment (same wiring point as `articleStore`).
    var dataSources = DataSourceProvider()

    private var issueRelationService: IssueRelationService {
        IssueRelationService(issueId: articleId, dataSource: dataSources.issueRelations)
    }

    private var issueMetadataService: IssueMetadataService {
        IssueMetadataService(issueId: articleId, dataSources: dataSources)
    }

    init(articleId: Int) {
        self.articleId = articleId
    }

    // MARK: - Load

    func loadArticle() async {
        isLoading = true
        error = nil

        do {
            article = try await dataSources.articles.getArticle(id: articleId)
        } catch {
            self.error = error.localizedDescription
        }

        // Load metadata, links & activity in parallel
        async let metadataResult: () = loadMetadataOptions()
        async let linksResult: () = loadLinks()
        async let urlLinksResult: () = loadUrlLinks()
        async let activityResult: () = loadActivityLog()
        async let commentsResult: () = loadComments()
        _ = await (metadataResult, linksResult, urlLinksResult, activityResult, commentsResult)

        isLoading = false
    }

    // MARK: - Fetch without UI update (for pull-to-refresh)

    func fetchArticle() async -> (Article, [Comment], [ActivityLogEntry])? {
        do {
            let article: Article = try await dataSources.articles.getArticle(id: articleId)
            let activities: [ActivityLogEntry] = try await dataSources.issueRelations.listActivityLog(
                issueId: articleId
            )
            let comments = try await dataSources.articles.listComments(articleId: articleId)
            return (article, comments, activities)
        } catch {
            self.error = error.localizedDescription
            return nil
        }
    }

    func applyArticle(_ article: Article, comments: [Comment], activities: [ActivityLogEntry]) {
        self.article = article
        self.comments = comments
        self.activityLogs = activities
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

    // MARK: - Activity Log

    private func loadActivityLog() async {
        do {
            activityLogs = try await dataSources.issueRelations.listActivityLog(issueId: articleId)
        } catch {
            // Non-critical
        }
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
            await loadActivityLog()
            HapticManager.notification(.success)
        } catch {
            self.error = error.localizedDescription
            HapticManager.notification(.error)
        }
    }

    func deleteIssueLink(_ linkId: Int) async {
        do {
            issueLinks = try await issueRelationService.deleteIssueLink(linkId, from: issueLinks)
            await loadActivityLog()
        } catch {
            self.error = error.localizedDescription
        }
    }

    func searchIssues(query: String) async -> [IssuePickerItem] {
        await IssuePickerSearchService(dataSources: dataSources).search(
            query: query,
            excludingIDs: [articleId]
        )
    }

    // MARK: - Bookmark

    func toggleBookmark() async {
        guard let current = article else { return }
        isBookmarking = true
        defer { isBookmarking = false }
        do {
            let updated = current.isBookmarked
                ? try await dataSources.articles.unbookmarkArticle(id: articleId)
                : try await dataSources.articles.bookmarkArticle(id: articleId)
            article = updated
            articleStore?.needsReload = true
            HapticManager.impact(.light)
        } catch {
            self.error = error.localizedDescription
            HapticManager.notification(.error)
        }
    }

    // MARK: - Article and comments

    func updateArticle(title: String? = nil, bodyMd: String? = nil) async {
        do {
            let updated = try await dataSources.articles.updateArticle(
                id: articleId,
                UpdateArticleRequest(title: title, bodyMd: bodyMd)
            )
            article = updated
            articleStore?.needsReload = true
            HapticManager.notification(.success)
        } catch {
            self.error = error.localizedDescription
            HapticManager.notification(.error)
        }
    }

    private func loadComments() async {
        do {
            comments = try await dataSources.articles.listComments(articleId: articleId)
        } catch {
            // Non-critical in offline read-only mode.
        }
    }

    func addComment() async -> Bool {
        let body = replyBody.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !body.isEmpty else { return false }
        isSubmittingReply = true
        defer { isSubmittingReply = false }
        do {
            let comment = try await dataSources.articles.createComment(
                articleId: articleId,
                CreateCommentRequest(bodyMd: body)
            )
            comments.append(comment)
            replyBody = ""
            HapticManager.notification(.success)
            return true
        } catch {
            self.error = error.localizedDescription
            HapticManager.notification(.error)
            return false
        }
    }

    func updateComment(_ commentId: Int, bodyMd: String) async {
        do {
            let updated = try await dataSources.articles.updateComment(
                articleId: articleId,
                commentId: commentId,
                UpdateCommentRequest(bodyMd: bodyMd)
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
            try await dataSources.articles.deleteComment(articleId: articleId, commentId: commentId)
            comments.removeAll { $0.id == commentId }
        } catch {
            self.error = error.localizedDescription
        }
    }

    // MARK: - Delete

    func deleteArticle() async -> Bool {
        do {
            try await dataSources.articles.deleteArticle(id: articleId)
            articleStore?.removeItem(articleId)
            return true
        } catch {
            self.error = error.localizedDescription
            return false
        }
    }

    // MARK: - Projects

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
            await loadActivityLog()
            articleStore?.needsReload = true
        }
    }

    // MARK: - Labels

    func addNewLabel(_ label: IssueLabel) {
        allLabels = issueMetadataService.reconciling(allLabels, with: label)
    }

    func confirmLabels(_ selectedNames: Set<String>) {
        let currentNames = Set(article?.labels ?? [])

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
            // Reload article to get updated labels
            do {
                let updated: Article = try await dataSources.articles.getArticle(id: articleId)
                article = updated
                articleStore?.updateItem(updated)
                articleStore?.needsReload = true
            } catch {
                self.error = error.localizedDescription
            }
            await loadActivityLog()
        }
    }

    // MARK: - Copy All Contents

    func copyAllContents() {
        guard let article = article else { return }

        var text = "# \(article.title)\n\n"
        text += "Source: \(article.meta?.originalUrl ?? "")\n\n"
        if !article.bodyMd.isEmpty {
            text += article.bodyMd
        }

        UIPasteboard.general.string = text
        HapticManager.notification(.success)
    }
}

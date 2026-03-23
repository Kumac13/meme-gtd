import Combine
import SwiftUI

@MainActor
class ArticleDetailViewModel: ObservableObject, IssueDetailProvider {
    @Published var article: Article?
    @Published var isLoading: Bool = false
    @Published var error: String?
    @Published var isBookmarking: Bool = false
    @Published var activityLogs: [ActivityLogEntry] = []

    // Activity event types to display in timeline
    private static let displayedEventTypes: Set<String> = [
        "label.assigned", "label.removed",
        "link.created", "link.deleted",
        "project.item_added", "project.item_removed",
    ]

    var timelineEntries: [TimelineEntry] {
        activityLogs
            .filter { Self.displayedEventTypes.contains($0.eventType) }
            .map { TimelineEntry.activity($0) }
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

    // IssueDetailProvider
    var issueId: Int { articleId }
    var issueTypeLabel: String { "article" }
    var isBookmarked: Bool { article?.isBookmarked ?? false }
    var issueLabels: [String] { article?.labels ?? [] }

    let articleId: Int
    var articleStore: ArticleStore?

    init(articleId: Int) {
        self.articleId = articleId
    }

    // MARK: - Load

    func loadArticle() async {
        isLoading = true
        error = nil

        do {
            article = try await APIClient.shared.get(path: "/api/articles/\(articleId)")
        } catch {
            self.error = error.localizedDescription
        }

        // Load projects, labels, links & activity in parallel
        async let projectsResult: () = loadProjects()
        async let labelsResult: () = loadAllLabels()
        async let linksResult: () = loadLinks()
        async let urlLinksResult: () = loadUrlLinks()
        async let activityResult: () = loadActivityLog()
        _ = await (projectsResult, labelsResult, linksResult, urlLinksResult, activityResult)

        isLoading = false
    }

    // MARK: - Fetch without UI update (for pull-to-refresh)

    func fetchArticle() async -> (Article, [ActivityLogEntry])? {
        do {
            let article: Article = try await APIClient.shared.get(path: "/api/articles/\(articleId)")
            let activities: [ActivityLogEntry] = try await APIClient.shared.get(
                path: "/api/activity-log/issues/\(articleId)",
                queryItems: [URLQueryItem(name: "order", value: "asc")]
            )
            return (article, activities)
        } catch {
            self.error = error.localizedDescription
            return nil
        }
    }

    func applyArticle(_ article: Article, activities: [ActivityLogEntry]) {
        self.article = article
        self.activityLogs = activities
    }

    private func loadProjects() async {
        do {
            associatedProjects = try await APIClient.shared.get(path: "/api/issues/\(articleId)/projects")
            allProjects = try await APIClient.shared.get(path: "/api/projects")
        } catch {
            // Non-critical
        }
    }

    private func loadAllLabels() async {
        do {
            allLabels = try await APIClient.shared.get(path: "/api/labels")
        } catch {
            // Non-critical
        }
    }

    // MARK: - Activity Log

    private func loadActivityLog() async {
        do {
            activityLogs = try await APIClient.shared.get(
                path: "/api/activity-log/issues/\(articleId)",
                queryItems: [URLQueryItem(name: "order", value: "asc")]
            )
        } catch {
            // Non-critical
        }
    }

    // MARK: - URL Links

    private func loadUrlLinks() async {
        do {
            urlLinks = try await APIClient.shared.get(path: "/api/issues/\(articleId)/url-links")
        } catch {
            // Non-critical
        }
    }

    func createUrlLink(url: String, title: String?) async {
        do {
            let request = CreateUrlLinkRequest(url: url, title: title)
            let _: UrlLink = try await APIClient.shared.post(
                path: "/api/issues/\(articleId)/url-links",
                body: request
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
            try await APIClient.shared.delete(path: "/api/url-links/\(urlLinkId)")
            urlLinks.removeAll { $0.id == urlLinkId }
        } catch {
            self.error = error.localizedDescription
        }
    }

    // MARK: - Links

    private func loadLinks() async {
        do {
            issueLinks = try await APIClient.shared.get(path: "/api/issues/\(articleId)/links")
        } catch {
            // Non-critical
        }
    }

    func createIssueLink(targetIssueId: Int, linkType: LinkType) async {
        do {
            let request = CreateLinkRequest(
                sourceIssueId: articleId,
                targetIssueId: targetIssueId,
                linkType: linkType
            )
            let _: CreateLinkResponse = try await APIClient.shared.post(
                path: "/api/links",
                body: request
            )
            await loadLinks()
            await loadActivityLog()
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
            await loadActivityLog()
        } catch {
            self.error = error.localizedDescription
        }
    }

    func searchIssues(query: String) async -> [IssuePickerItem] {
        let trimmed = query.trimmingCharacters(in: .whitespacesAndNewlines)

        var results: [IssuePickerItem] = []

        await withTaskGroup(of: [IssuePickerItem].self) { group in
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

        return results
            .filter { $0.id != articleId }
            .sorted { $0.updatedAt > $1.updatedAt }
            .prefix(10)
            .map { $0 }
    }

    // MARK: - Bookmark (no-op: API not implemented for articles)

    func toggleBookmark() async {
        // Bookmark API not available for articles
    }

    // MARK: - Delete

    func deleteArticle() async -> Bool {
        do {
            try await APIClient.shared.delete(path: "/api/articles/\(articleId)")
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
        let toAdd = selectedIds.subtracting(currentIds)
        let toRemove = currentIds.subtracting(selectedIds)

        Task {
            for projectId in toAdd {
                do {
                    let _: ProjectItem = try await APIClient.shared.post(
                        path: "/api/projects/\(projectId)/items",
                        body: AddProjectItemRequest(issueId: articleId)
                    )
                } catch {
                    self.error = error.localizedDescription
                }
            }
            for projectId in toRemove {
                do {
                    try await APIClient.shared.delete(
                        path: "/api/projects/\(projectId)/items/\(articleId)"
                    )
                } catch {
                    self.error = error.localizedDescription
                }
            }
            await loadProjects()
            await loadActivityLog()
            articleStore?.needsReload = true
        }
    }

    // MARK: - Labels

    func confirmLabels(_ selectedNames: Set<String>) {
        let currentNames = Set(article?.labels ?? [])
        let toAdd = selectedNames.subtracting(currentNames)
        let toRemove = currentNames.subtracting(selectedNames)

        Task {
            for name in toAdd {
                if let label = allLabels.first(where: { $0.name == name }) {
                    do {
                        let _: AssignLabelResponse = try await APIClient.shared.post(
                            path: "/api/issues/\(articleId)/labels",
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
                            path: "/api/issues/\(articleId)/labels/\(label.id)"
                        )
                    } catch {
                        self.error = error.localizedDescription
                    }
                }
            }
            // Reload article to get updated labels
            do {
                let updated: Article = try await APIClient.shared.get(path: "/api/articles/\(articleId)")
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

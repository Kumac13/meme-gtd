import Combine
import SwiftUI

@MainActor
class TaskDetailViewModel: ObservableObject, IssueDetailProvider {
    @Published var task: TaskItem?
    @Published var comments: [Comment] = []
    @Published var isLoading: Bool = false
    @Published var error: String?
    @Published var replyBody: String = ""
    @Published var isSubmittingReply: Bool = false
    @Published var isBookmarking: Bool = false
    @Published var activityLogs: [ActivityLogEntry] = []

    // Activity event types to display in timeline
    private static let displayedEventTypes: Set<String> = [
        "label.assigned", "label.removed",
        "link.created", "link.deleted",
        "task.status_changed",
        "project.item_added", "project.item_removed",
    ]

    var timelineEntries: [TimelineEntry] {
        let commentEntries = comments.map { TimelineEntry.comment($0) }
        let activityEntries = activityLogs
            .filter { Self.displayedEventTypes.contains($0.eventType) }
            .map { TimelineEntry.activity($0) }
        return (commentEntries + activityEntries)
            .sorted { $0.timestamp < $1.timestamp }
    }

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

    // IssueDetailProvider
    var issueId: Int { taskId }
    var issueTypeLabel: String { "task" }
    var isBookmarked: Bool { task?.isBookmarked ?? false }
    var issueLabels: [String] { task?.labels ?? [] }

    let taskId: Int

    init(taskId: Int) {
        self.taskId = taskId
    }

    // MARK: - Load

    func loadTask() async {
        isLoading = true
        error = nil

        do {
            task = try await APIClient.shared.get(path: "/api/tasks/\(taskId)")
            let commentList: [Comment] = try await APIClient.shared.get(
                path: "/api/tasks/\(taskId)/comments"
            )
            comments = commentList
        } catch {
            self.error = error.localizedDescription
        }

        // Load projects, labels, links & activity in parallel
        async let projectsResult: () = loadProjects()
        async let labelsResult: () = loadAllLabels()
        async let linksResult: () = loadLinks()
        async let activityResult: () = loadActivityLog()
        _ = await (projectsResult, labelsResult, linksResult, activityResult)

        isLoading = false
    }

    // MARK: - Fetch without UI update (for pull-to-refresh)

    func fetchTask() async -> (TaskItem, [Comment], [ActivityLogEntry])? {
        do {
            let task: TaskItem = try await APIClient.shared.get(path: "/api/tasks/\(taskId)")
            let commentList: [Comment] = try await APIClient.shared.get(
                path: "/api/tasks/\(taskId)/comments"
            )
            let activities: [ActivityLogEntry] = try await APIClient.shared.get(
                path: "/api/activity-log/issues/\(taskId)",
                queryItems: [URLQueryItem(name: "order", value: "asc")]
            )
            return (task, commentList, activities)
        } catch {
            self.error = error.localizedDescription
            return nil
        }
    }

    func applyTask(_ task: TaskItem, comments: [Comment], activities: [ActivityLogEntry]) {
        self.task = task
        self.comments = comments
        self.activityLogs = activities
    }

    private func loadProjects() async {
        do {
            associatedProjects = try await APIClient.shared.get(path: "/api/issues/\(taskId)/projects")
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
                path: "/api/activity-log/issues/\(taskId)",
                queryItems: [URLQueryItem(name: "order", value: "asc")]
            )
        } catch {
            // Non-critical
        }
    }

    // MARK: - Links

    private func loadLinks() async {
        do {
            issueLinks = try await APIClient.shared.get(path: "/api/issues/\(taskId)/links")
        } catch {
            // Non-critical
        }
    }

    func createIssueLink(targetIssueId: Int, linkType: LinkType) async {
        do {
            let request = CreateLinkRequest(
                sourceIssueId: taskId,
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
            .filter { $0.id != taskId }
            .sorted { $0.updatedAt > $1.updatedAt }
            .prefix(10)
            .map { $0 }
    }

    // MARK: - Bookmark

    func toggleBookmark() async {
        guard let currentTask = task else { return }
        isBookmarking = true

        do {
            let path = currentTask.isBookmarked
                ? "/api/tasks/\(taskId)/unbookmark"
                : "/api/tasks/\(taskId)/bookmark"
            let updated: TaskItem = try await APIClient.shared.postReturning(path: path)
            task = updated
            HapticManager.impact(.light)
        } catch {
            self.error = error.localizedDescription
            HapticManager.notification(.error)
        }

        isBookmarking = false
    }

    // MARK: - Update Task

    func updateTask(title: String? = nil, bodyMd: String? = nil, status: String? = nil) async {
        do {
            let request = UpdateTaskRequest(title: title, bodyMd: bodyMd, status: status)
            let updated: TaskItem = try await APIClient.shared.patch(
                path: "/api/tasks/\(taskId)",
                body: request
            )
            task = updated
            HapticManager.notification(.success)
        } catch {
            self.error = error.localizedDescription
            HapticManager.notification(.error)
        }
    }

    // MARK: - Comments

    func addComment() async {
        let body = replyBody.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !body.isEmpty else { return }

        isSubmittingReply = true

        do {
            let request = CreateCommentRequest(bodyMd: body)
            let comment: Comment = try await APIClient.shared.post(
                path: "/api/tasks/\(taskId)/comments",
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
                path: "/api/tasks/\(taskId)/comments/\(commentId)",
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
                path: "/api/tasks/\(taskId)/comments/\(commentId)"
            )
            comments.removeAll { $0.id == commentId }
        } catch {
            self.error = error.localizedDescription
        }
    }

    func deleteTask() async -> Bool {
        do {
            try await APIClient.shared.delete(path: "/api/tasks/\(taskId)")
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
                        body: AddProjectItemRequest(issueId: taskId)
                    )
                } catch {
                    self.error = error.localizedDescription
                }
            }
            for projectId in toRemove {
                do {
                    try await APIClient.shared.delete(
                        path: "/api/projects/\(projectId)/items/\(taskId)"
                    )
                } catch {
                    self.error = error.localizedDescription
                }
            }
            await loadProjects()
        }
    }

    // MARK: - Labels

    func confirmLabels(_ selectedNames: Set<String>) {
        let currentNames = Set(task?.labels ?? [])
        let toAdd = selectedNames.subtracting(currentNames)
        let toRemove = currentNames.subtracting(selectedNames)

        Task {
            for name in toAdd {
                if let label = allLabels.first(where: { $0.name == name }) {
                    do {
                        let _: AssignLabelResponse = try await APIClient.shared.post(
                            path: "/api/issues/\(taskId)/labels",
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
                            path: "/api/issues/\(taskId)/labels/\(label.id)"
                        )
                    } catch {
                        self.error = error.localizedDescription
                    }
                }
            }
            // Reload task to get updated labels
            do {
                let updated: TaskItem = try await APIClient.shared.get(path: "/api/tasks/\(taskId)")
                task = updated
            } catch {
                self.error = error.localizedDescription
            }
        }
    }

    // MARK: - Copy All Contents

    func copyAllContents() {
        guard let task = task else { return }

        var text = "# \(task.title)\n\n"
        if !task.bodyMd.isEmpty {
            text += task.bodyMd
        }

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

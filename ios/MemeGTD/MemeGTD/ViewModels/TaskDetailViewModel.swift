import Combine
import SwiftUI

@MainActor
class TaskDetailViewModel: ObservableObject, IssueMetadataManaging, IssueRelationManaging, IssueBookmarkProvider, IssueCopyProvider {
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
    @Published var urlLinks: [UrlLink] = []

    // Shared detail capabilities
    var issueTypeLabel: String { "task" }
    var isBookmarked: Bool { task?.isBookmarked ?? false }
    var issueLabels: [String] { task?.labels ?? [] }

    let taskId: Int
    var metadataIssueId: Int { taskId }
    var relationIssueId: Int { taskId }
    var taskStore: TaskStore?

    /// Data source seam. Views overwrite this with the app-wide provider from
    /// the environment (same wiring point as `taskStore`).
    var dataSources = DataSourceProvider()

    init(taskId: Int) {
        self.taskId = taskId
    }

    // MARK: - Load

    func loadTask() async {
        isLoading = true
        error = nil

        do {
            task = try await dataSources.tasks.getTask(id: taskId)
            let commentList: [Comment] = try await dataSources.tasks.listComments(taskId: taskId)
            comments = commentList
        } catch {
            self.error = error.localizedDescription
        }

        // Load metadata, links & activity in parallel
        async let metadataResult: () = loadMetadataOptions()
        async let linksResult: () = loadIssueLinks()
        async let urlLinksResult: () = loadUrlLinks()
        async let activityResult: () = loadActivityLog()
        _ = await (metadataResult, linksResult, urlLinksResult, activityResult)

        isLoading = false
    }

    // MARK: - Fetch without UI update (for pull-to-refresh)

    func fetchTask() async -> (TaskItem, [Comment], [ActivityLogEntry])? {
        do {
            let task: TaskItem = try await dataSources.tasks.getTask(id: taskId)
            let commentList: [Comment] = try await dataSources.tasks.listComments(taskId: taskId)
            let activities: [ActivityLogEntry] = try await dataSources.issueRelations.listActivityLog(
                issueId: taskId
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

    // MARK: - Activity Log

    private func loadActivityLog() async {
        do {
            activityLogs = try await dataSources.issueRelations.listActivityLog(issueId: taskId)
        } catch {
            // Non-critical
        }
    }

    func relationDidChange() async { await loadActivityLog() }

    // MARK: - Bookmark

    func toggleBookmark() async {
        guard let currentTask = task else { return }
        isBookmarking = true

        do {
            let updated: TaskItem = currentTask.isBookmarked
                ? try await dataSources.tasks.unbookmarkTask(id: taskId)
                : try await dataSources.tasks.bookmarkTask(id: taskId)
            task = updated
            taskStore?.updateItem(updated)
            taskStore?.needsReload = true
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
            let updated: TaskItem = try await dataSources.tasks.updateTask(
                id: taskId,
                request
            )
            task = updated
            if status != nil {
                taskStore?.removeItem(taskId)
                taskStore?.needsReload = true
            } else {
                taskStore?.updateItem(updated)
            }
            await loadActivityLog()
            if bodyMd != nil {
                await loadIssueLinks()
            }
            HapticManager.notification(.success)
        } catch {
            self.error = error.localizedDescription
            HapticManager.notification(.error)
        }
    }

    // MARK: - Comments

    func addComment() async -> Bool {
        let body = replyBody.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !body.isEmpty else { return false }

        isSubmittingReply = true
        defer { isSubmittingReply = false }

        do {
            let request = CreateCommentRequest(bodyMd: body)
            let comment: Comment = try await dataSources.tasks.createComment(
                taskId: taskId,
                request
            )
            comments.append(comment)
            replyBody = ""
            HapticManager.notification(.success)
            await loadIssueLinks()
            return true
        } catch {
            self.error = error.localizedDescription
            HapticManager.notification(.error)
            return false
        }
    }

    func updateComment(_ commentId: Int, bodyMd: String) async {
        do {
            let request = UpdateCommentRequest(bodyMd: bodyMd)
            let updated: Comment = try await dataSources.tasks.updateComment(
                taskId: taskId,
                commentId: commentId,
                request
            )
            if let index = comments.firstIndex(where: { $0.id == commentId }) {
                comments[index] = updated
            }
            await loadIssueLinks()
        } catch {
            self.error = error.localizedDescription
        }
    }

    // MARK: - Interactive todo toggle

    /// Toggle the N-th `- [ ]` / `- [x]` in the task body, persisting via PATCH.
    /// Optimistically updates `task` and rolls back on error.
    func toggleBodyTodo(at todoIndex: Int) async {
        guard let current = task else { return }
        guard let next = TodoMarkdown.toggleTodo(current.bodyMd, at: todoIndex) else { return }
        guard next != current.bodyMd else { return }

        // Optimistic update
        let previousBody = current.bodyMd
        task = current.withBody(next)

        do {
            let request = UpdateTaskRequest(title: nil, bodyMd: next, status: nil)
            let updated: TaskItem = try await dataSources.tasks.updateTask(
                id: taskId,
                request
            )
            task = updated
            taskStore?.updateItem(updated)
            await loadActivityLog()
        } catch {
            // Rollback
            task = current.withBody(previousBody)
            self.error = error.localizedDescription
            HapticManager.notification(.error)
        }
    }

    /// Toggle the N-th `- [ ]` / `- [x]` in a comment body.
    func toggleCommentTodo(commentId: Int, todoIndex: Int) async {
        guard let index = comments.firstIndex(where: { $0.id == commentId }) else { return }
        let original = comments[index]
        guard let next = TodoMarkdown.toggleTodo(original.bodyMd, at: todoIndex) else { return }
        guard next != original.bodyMd else { return }

        // Optimistic update
        comments[index] = original.withBody(next)

        do {
            let request = UpdateCommentRequest(bodyMd: next)
            let updated: Comment = try await dataSources.tasks.updateComment(
                taskId: taskId,
                commentId: commentId,
                request
            )
            if let idx = comments.firstIndex(where: { $0.id == commentId }) {
                comments[idx] = updated
            }
        } catch {
            comments[index] = original
            self.error = error.localizedDescription
            HapticManager.notification(.error)
        }
    }

    func deleteComment(_ commentId: Int) async {
        do {
            try await dataSources.tasks.deleteComment(
                taskId: taskId,
                commentId: commentId
            )
            comments.removeAll { $0.id == commentId }
        } catch {
            self.error = error.localizedDescription
        }
    }

    func deleteTask() async -> Bool {
        do {
            try await dataSources.tasks.deleteTask(id: taskId)
            taskStore?.removeItem(taskId)
            return true
        } catch {
            self.error = error.localizedDescription
            return false
        }
    }

    func reloadMetadataIssue() async {
        do {
            let updated: TaskItem = try await dataSources.tasks.getTask(id: taskId)
            task = updated
            taskStore?.updateItem(updated)
        } catch { self.error = error.localizedDescription }
    }

    func metadataDidChange() async {
        await loadActivityLog()
        taskStore?.needsReload = true
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

import Combine
import SwiftUI

@MainActor
class CreateTaskViewModel: ObservableObject {
    let mode: CreateTaskModeKind

    @Published var title: String = ""
    @Published var bodyMd: String = ""
    @Published var status: TaskStatus = .inbox
    @Published var taskKind: TaskKind = .action
    @Published var isAllDay: Bool = false
    @Published var scheduledStart: Date? = nil
    @Published var scheduledEnd: Date? = nil
    @Published var selectedLabelNames: Set<String> = []
    @Published var selectedProjectIds: Set<Int> = []
    @Published var pendingLinks: [PendingLink] = []
    @Published var pendingUrlLinks: [PendingUrlLink] = []

    @Published var allLabels: [IssueLabel] = []
    @Published var allProjects: [Project] = []

    @Published var isSubmitting: Bool = false
    @Published var error: String?
    @Published var createdTask: TaskItem?

    private static let isoFormatter: DateFormatter = {
        let f = DateFormatter()
        f.dateFormat = "yyyy-MM-dd'T'HH:mm:ss"
        f.locale = Locale(identifier: "en_US_POSIX")
        return f
    }()

    init(mode: CreateTaskModeKind) {
        self.mode = mode
        switch mode {
        case .standard:
            break
        case .linkedTo:
            break
        case .quickChild(let parent, let parentProjects, let parentLabels):
            if let parentStatus = TaskStatus(rawValue: parent.status) {
                self.status = parentStatus
            }
            self.selectedLabelNames = Set(parentLabels)
            self.selectedProjectIds = Set(parentProjects.map(\.id))
            self.allProjects = parentProjects
        case .promoteFromMemo(_, let body, let labelNames, let projectIds, let links):
            self.bodyMd = body
            self.selectedLabelNames = Set(labelNames)
            self.selectedProjectIds = Set(projectIds)
            self.pendingLinks = links
        }
    }

    // MARK: - Load Data

    func loadData() async {
        do {
            async let labelsResult: [IssueLabel] = APIClient.shared.get(path: "/api/labels")
            async let projectsResult: [Project] = APIClient.shared.get(path: "/api/projects")
            let (labels, projects) = try await (labelsResult, projectsResult)
            allLabels = labels
            allProjects = projects
        } catch {
            // Non-critical
        }

        // Set up initial pending link for linkedTo mode (needs title from search)
        if case .linkedTo(let sourceTaskId) = mode {
            do {
                let task: TaskItem = try await APIClient.shared.get(path: "/api/tasks/\(sourceTaskId)")
                pendingLinks.append(PendingLink(
                    targetIssueId: sourceTaskId,
                    linkType: .relates,
                    title: task.title
                ))
            } catch {
                // Still add with placeholder title
                pendingLinks.append(PendingLink(
                    targetIssueId: sourceTaskId,
                    linkType: .relates,
                    title: "#\(sourceTaskId)"
                ))
            }
        }

        // Set up child link for quickChild mode
        if case .quickChild(let parent, _, _) = mode {
            pendingLinks.append(PendingLink(
                targetIssueId: parent.id,
                linkType: .child,
                title: parent.title
            ))
        }
    }

    // MARK: - Create Task

    func createTask() async -> TaskItem? {
        let trimmedTitle = title.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmedTitle.isEmpty else { return nil }

        isSubmitting = true
        error = nil

        do {
            // Standard create flow for all modes.
            let request = CreateTaskRequest(
                title: trimmedTitle,
                bodyMd: bodyMd.isEmpty ? nil : bodyMd,
                status: status.rawValue,
                taskKind: taskKind.rawValue,
                scheduledStart: scheduledStart.map { Self.isoFormatter.string(from: $0) },
                scheduledEnd: scheduledEnd.map { Self.isoFormatter.string(from: $0) },
                isAllDay: isAllDay ? true : nil
            )
            let task: TaskItem = try await APIClient.shared.post(
                path: "/api/tasks", body: request
            )

            await withTaskGroup(of: Void.self) { group in
                for name in selectedLabelNames {
                    if let label = allLabels.first(where: { $0.name == name }) {
                        group.addTask {
                            let _: AssignLabelResponse? = try? await APIClient.shared.post(
                                path: "/api/issues/\(task.id)/labels",
                                body: AssignLabelRequest(labelId: label.id)
                            )
                        }
                    }
                }

                for projectId in selectedProjectIds {
                    group.addTask {
                        let _: ProjectItem? = try? await APIClient.shared.post(
                            path: "/api/projects/\(projectId)/items",
                            body: AddProjectItemRequest(issueId: task.id)
                        )
                    }
                }

                for link in pendingLinks {
                    group.addTask {
                        let _: CreateLinkResponse? = try? await APIClient.shared.post(
                            path: "/api/links",
                            body: CreateLinkRequest(
                                sourceIssueId: task.id,
                                targetIssueId: link.targetIssueId,
                                linkType: link.linkType
                            )
                        )
                    }
                }

                for urlLink in pendingUrlLinks {
                    group.addTask {
                        let _: UrlLink? = try? await APIClient.shared.post(
                            path: "/api/issues/\(task.id)/url-links",
                            body: CreateUrlLinkRequest(url: urlLink.url, title: urlLink.title)
                        )
                    }
                }
            }

            createdTask = task
            HapticManager.notification(.success)
            isSubmitting = false
            return task
        } catch {
            self.error = error.localizedDescription
            HapticManager.notification(.error)
            isSubmitting = false
            return nil
        }
    }

    // MARK: - Pending Links

    func removePendingLink(_ link: PendingLink) {
        pendingLinks.removeAll { $0.id == link.id }
    }

    func addPendingLink(targetIssueId: Int, linkType: LinkType, title: String) {
        // Avoid duplicates
        guard !pendingLinks.contains(where: { $0.targetIssueId == targetIssueId }) else { return }
        pendingLinks.append(PendingLink(
            targetIssueId: targetIssueId,
            linkType: linkType,
            title: title
        ))
    }

    // MARK: - Pending URL Links

    func addPendingUrlLink(url: String, title: String?) {
        guard !pendingUrlLinks.contains(where: { $0.url == url }) else { return }
        pendingUrlLinks.append(PendingUrlLink(url: url, title: title))
    }

    func removePendingUrlLink(_ link: PendingUrlLink) {
        pendingUrlLinks.removeAll { $0.id == link.id }
    }

    // MARK: - Search Issues (for link picker)

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

        let linkedIds = Set(pendingLinks.map(\.targetIssueId))
        return results
            .filter { !linkedIds.contains($0.id) }
            .sorted { $0.updatedAt > $1.updatedAt }
            .prefix(10)
            .map { $0 }
    }
}

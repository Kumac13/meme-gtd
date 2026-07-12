import Combine
import SwiftUI

/// Detail VM for a template. Conforms to IssueDetailProvider so the shared
/// IssueInfoSheet drives Labels/Projects exactly like TaskDetailViewModel.
/// Templates have no links/bookmark, so those members are inert (the sheet is
/// shown with showLinks/showBookmark = false).
@MainActor
class TemplateDetailViewModel: ObservableObject, IssueDetailProvider {
    let templateId: Int

    @Published var template: Template?
    @Published var isLoading: Bool = false
    @Published var error: String?
    @Published var replyBody: String = ""
    @Published var isSubmittingReply: Bool = false

    @Published var allLabels: [IssueLabel] = []
    @Published var associatedProjects: [Project] = []
    @Published var allProjects: [Project] = []

    var templateStore: TemplateStore?
    var dataSources = DataSourceProvider()

    init(templateId: Int) {
        self.templateId = templateId
    }

    // MARK: - IssueDetailProvider

    var issueId: Int { templateId }
    var issueTypeLabel: String { "template" }

    var issueLinks: [IssueLink] { [] }
    var linkedPickerItems: [IssuePickerItem] { [] }
    func searchIssues(query _: String) async -> [IssuePickerItem] { [] }
    func createIssueLink(targetIssueId _: Int, linkType _: LinkType) async {}
    func deleteIssueLink(_ linkId: Int) async {}

    var urlLinks: [UrlLink] { [] }
    func createUrlLink(url _: String, title _: String?) async {}
    func deleteUrlLink(_ urlLinkId: Int) async {}

    var isBookmarking: Bool { false }
    var isBookmarked: Bool { false }
    func toggleBookmark() async {}

    var issueLabels: [String] { template?.labels ?? [] }

    func addNewLabel(_ label: IssueLabel) {
        if !allLabels.contains(where: { $0.id == label.id }) {
            allLabels.append(label)
        }
    }

    func confirmLabels(_ selectedNames: Set<String>) {
        let currentNames = Set(template?.labels ?? [])
        let toAdd = selectedNames.subtracting(currentNames)
        let toRemove = currentNames.subtracting(selectedNames)

        Task {
            for name in toAdd {
                if let label = allLabels.first(where: { $0.name == name }) {
                    do {
                        let _: AssignLabelResponse = try await dataSources.labels.assignLabel(
                            issueId: templateId,
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
                            issueId: templateId,
                            labelId: label.id
                        )
                    } catch {
                        self.error = error.localizedDescription
                    }
                }
            }
            do {
                let updated: Template = try await dataSources.templates.getTemplate(id: templateId)
                template = updated
                templateStore?.updateItem(updated)
                templateStore?.needsReload = true
            } catch {
                self.error = error.localizedDescription
            }
        }
    }

    func confirmProjects(_ selectedIds: Set<Int>) {
        let currentIds = Set(associatedProjects.map(\.id))
        let toAdd = selectedIds.subtracting(currentIds)
        let toRemove = currentIds.subtracting(selectedIds)

        Task {
            for projectId in toAdd {
                do {
                    let _: ProjectItem = try await dataSources.projects.addProjectItem(
                        projectId: projectId,
                        AddProjectItemRequest(issueId: templateId)
                    )
                } catch {
                    self.error = error.localizedDescription
                }
            }
            for projectId in toRemove {
                do {
                    try await dataSources.projects.removeProjectItem(
                        projectId: projectId,
                        issueId: templateId
                    )
                } catch {
                    self.error = error.localizedDescription
                }
            }
            await loadProjects()
            templateStore?.needsReload = true
        }
    }

    func copyAllContents() {
        guard let template else { return }
        var text = "# \(template.title ?? "Template #\(template.id)")\n\n"
        if !template.bodyMd.isEmpty {
            text += template.bodyMd
        }
        UIPasteboard.general.string = text
        HapticManager.notification(.success)
    }

    // MARK: - Load

    func loadTemplate() async {
        isLoading = true
        error = nil
        do {
            let fetched: Template = try await dataSources.templates.getTemplate(id: templateId)
            template = fetched
        } catch {
            self.error = error.localizedDescription
        }
        isLoading = false

        async let labelsTask: Void = loadLabels()
        async let projectsTask: Void = loadProjects()
        _ = await (labelsTask, projectsTask)
    }

    func fetchTemplate() async -> Template? {
        do {
            return try await dataSources.templates.getTemplate(id: templateId)
        } catch {
            self.error = error.localizedDescription
            return nil
        }
    }

    func applyTemplate(_ fetched: Template) {
        template = fetched
        templateStore?.updateItem(fetched)
    }

    private func loadLabels() async {
        do {
            allLabels = try await dataSources.labels.listLabels()
        } catch {
            // Non-critical
        }
    }

    private func loadProjects() async {
        do {
            async let associated: [Project] = dataSources.projects.listIssueProjects(issueId: templateId)
            async let all: [Project] = dataSources.projects.listProjects()
            let (a, b) = try await (associated, all)
            associatedProjects = a
            allProjects = b
        } catch {
            // Non-critical
        }
    }

    // MARK: - Update / Delete

    func updateTemplate(title: String? = nil, bodyMd: String? = nil, templateTarget: String? = nil) async {
        isSubmittingReply = true
        defer { isSubmittingReply = false }
        do {
            var request = UpdateTemplateRequest()
            request.title = title
            request.bodyMd = bodyMd
            request.templateTarget = templateTarget
            let updated: Template = try await dataSources.templates.updateTemplate(id: templateId, request)
            template = updated
            templateStore?.updateItem(updated)
            templateStore?.needsReload = true
        } catch {
            self.error = error.localizedDescription
        }
    }

    func deleteTemplate() async -> Bool {
        do {
            try await dataSources.templates.deleteTemplate(id: templateId)
            templateStore?.removeItem(templateId)
            return true
        } catch {
            self.error = error.localizedDescription
            return false
        }
    }
}

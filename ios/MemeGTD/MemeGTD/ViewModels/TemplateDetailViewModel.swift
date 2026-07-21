import Combine
import SwiftUI

/// Template detail exposes only the metadata and copy capabilities it supports.
@MainActor
class TemplateDetailViewModel: ObservableObject, IssueMetadataProvider, IssueCopyProvider {
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

    private var issueMetadataService: IssueMetadataService {
        IssueMetadataService(issueId: templateId, dataSources: dataSources)
    }

    init(templateId: Int) {
        self.templateId = templateId
    }

    // MARK: - Shared detail capabilities

    var issueLabels: [String] { template?.labels ?? [] }

    func addNewLabel(_ label: IssueLabel) {
        allLabels = issueMetadataService.reconciling(allLabels, with: label)
    }

    func confirmLabels(_ selectedNames: Set<String>) {
        let currentNames = Set(template?.labels ?? [])

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

        await loadMetadataOptions()
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

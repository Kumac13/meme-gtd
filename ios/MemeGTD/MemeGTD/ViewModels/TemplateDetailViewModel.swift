import Combine
import SwiftUI

/// Template detail exposes only the metadata and copy capabilities it supports.
@MainActor
class TemplateDetailViewModel: ObservableObject, IssueMetadataManaging, IssueCopyProvider {
    let templateId: Int
    var metadataIssueId: Int { templateId }

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

    // MARK: - Shared detail capabilities

    var issueLabels: [String] { template?.labels ?? [] }

    func reloadMetadataIssue() async {
        do {
            let updated: Template = try await dataSources.templates.getTemplate(id: templateId)
            template = updated
            templateStore?.updateItem(updated)
        } catch { self.error = error.localizedDescription }
    }

    func metadataDidChange() async { templateStore?.needsReload = true }

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

import Combine
import SwiftUI

@MainActor
class CreateTemplateViewModel: ObservableObject {
    @Published var title: String = ""
    @Published var bodyMd: String = ""
    /// issues.template_target ("task" / "article")
    @Published var templateTarget: String = "task"
    @Published var selectedLabelNames: Set<String> = []
    @Published var selectedProjectIds: Set<Int> = []

    @Published var allLabels: [IssueLabel] = []
    @Published var allProjects: [Project] = []

    @Published var isSubmitting: Bool = false
    @Published var error: String?

    var dataSources = DataSourceProvider()

    func createTemplate() async -> Template? {
        let trimmedTitle = title.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmedTitle.isEmpty else { return nil }
        isSubmitting = true
        error = nil
        defer { isSubmitting = false }

        do {
            let request = CreateTemplateRequest(
                title: trimmedTitle,
                bodyMd: bodyMd,
                templateTarget: templateTarget,
                labels: selectedLabelNames.isEmpty ? nil : Array(selectedLabelNames).sorted(),
                projectIds: selectedProjectIds.isEmpty ? nil : Array(selectedProjectIds).sorted()
            )
            return try await dataSources.templates.createTemplate(request)
        } catch {
            self.error = error.localizedDescription
            return nil
        }
    }
}

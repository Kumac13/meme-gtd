import SwiftUI

/// New Template modal. Same anatomy as CreateTaskModal (header + rows +
/// picker sheets), minus the task-only rows (status/schedule/links) and plus
/// the Target row (issues.template_target).
struct CreateTemplateModal: View {
    let onCreated: (Template) -> Void
    let onDismiss: () -> Void

    @EnvironmentObject var dataSources: DataSourceProvider
    @StateObject private var viewModel = CreateTemplateViewModel()

    var body: some View {
        VStack(spacing: 0) {
            header

            Divider()

            fullForm
        }
        .background(Color(.systemBackground))
        .task {
            viewModel.dataSources = dataSources
        }
    }

    // MARK: - Header

    private var header: some View {
        CreateIssueModalHeader(
            title: "New Template",
            isSubmitting: viewModel.isSubmitting,
            isCreateDisabled: viewModel.title.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty,
            onDismiss: onDismiss,
            onCreate: submit
        )
    }

    // MARK: - Full Form

    private var fullForm: some View {
        ScrollView {
            VStack(spacing: 0) {
                CreateIssueTextFields(
                    titlePlaceholder: "Template title...",
                    title: $viewModel.title,
                    bodyMd: $viewModel.bodyMd,
                    bodyLabel: "Body"
                )

                Divider().padding(.leading, 16)

                // Target (issues.template_target)
                targetRow

                Divider().padding(.leading, 16)

                CreateIssueMetadataSection(
                    allLabels: $viewModel.allLabels,
                    selectedLabelNames: $viewModel.selectedLabelNames,
                    allProjects: $viewModel.allProjects,
                    selectedProjectIds: $viewModel.selectedProjectIds,
                    labelCount: { $0.taskCount }
                )

                if let error = viewModel.error {
                    CreateIssueErrorBanner(message: error)
                }

                Color.clear.frame(height: 40)
            }
        }
        .scrollDismissesKeyboard(.immediately)
    }

    // MARK: - Target Row

    private var targetRow: some View {
        SegmentedFormRow(
            title: "Target",
            options: ["task", "article"],
            selected: $viewModel.templateTarget,
            label: { $0 == "article" ? "Article" : "Task" }
        )
    }

    // MARK: - Submit

    private func submit() {
        Task {
            if let template = await viewModel.createTemplate() {
                onCreated(template)
                onDismiss()
            }
        }
    }
}

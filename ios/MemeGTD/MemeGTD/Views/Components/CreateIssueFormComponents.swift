import SwiftUI

struct CreateIssueMetadataOptions {
    let labels: [IssueLabel]?
    let projects: [Project]?
}

@MainActor
enum CreateIssueMetadataOptionsLoader {
    static func load(
        labels: @escaping @MainActor () async throws -> [IssueLabel],
        projects: @escaping @MainActor () async throws -> [Project]
    ) async -> CreateIssueMetadataOptions {
        async let labelsResult = try? labels()
        async let projectsResult = try? projects()
        return await CreateIssueMetadataOptions(
            labels: labelsResult,
            projects: projectsResult
        )
    }
}

/// Shared form chrome for issue creation screens. Keeping these pieces here
/// prevents Task and Article creation from drifting apart visually.
struct CreateIssueModalHeader: View {
    let title: String
    let isSubmitting: Bool
    let isCreateDisabled: Bool
    let onDismiss: () -> Void
    let onCreate: () -> Void

    var body: some View {
        ModalHeader(
            title: title,
            onDismiss: onDismiss,
            trailingAction: .create(
                isEnabled: !isCreateDisabled,
                isSubmitting: isSubmitting,
                action: onCreate
            )
        )
    }
}

struct CreateIssueTextFields: View {
    let titlePlaceholder: String
    @Binding var title: String
    @Binding var bodyMd: String
    var bodyLabel: String = "Description"

    var body: some View {
        VStack(spacing: 0) {
            VStack(alignment: .leading, spacing: 4) {
                Text("Title")
                    .font(.system(size: 13, weight: .medium))
                    .foregroundColor(.textSecondary)
                AutoFocusTextField(
                    placeholder: titlePlaceholder,
                    text: $title
                )
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 12)

            Divider().padding(.leading, 16)

            VStack(alignment: .leading, spacing: 4) {
                Text(bodyLabel)
                    .font(.system(size: 13, weight: .medium))
                    .foregroundColor(.textSecondary)
                TextEditor(text: $bodyMd)
                    .font(.system(size: 15))
                    .frame(minHeight: 80, maxHeight: 160)
                    .scrollContentBackground(.hidden)
                    .tint(Color.accent)
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 12)
        }
    }
}

struct CreateIssueMetadataSection: View {
    @EnvironmentObject private var dataSources: DataSourceProvider

    @Binding var allLabels: [IssueLabel]
    @Binding var selectedLabelNames: Set<String>
    @Binding var allProjects: [Project]
    @Binding var selectedProjectIds: Set<Int>
    let labelCount: (IssueLabel) -> Int

    @State private var showLabelPicker = false
    @State private var showProjectPicker = false
    @State private var labelDraft: Set<String> = []
    @State private var projectDraft: Set<Int> = []

    var body: some View {
        VStack(spacing: 0) {
            labelsRow

            Divider().padding(.leading, 16)

            projectsRow
        }
        .sheet(isPresented: $showLabelPicker) {
            LabelPickerModal(
                allLabels: allLabels,
                selectedNames: $labelDraft,
                onDismiss: { showLabelPicker = false },
                onConfirm: { names in
                    selectedLabelNames = names
                    showLabelPicker = false
                },
                countFor: labelCount,
                onLabelCreated: { newLabel in
                    allLabels.append(newLabel)
                    labelDraft.insert(newLabel.name)
                }
            )
            .presentationDetents([.medium, .large])
        }
        .sheet(isPresented: $showProjectPicker) {
            ProjectPickerModal(
                allProjects: allProjects,
                selectedIds: $projectDraft,
                onDismiss: { showProjectPicker = false },
                onConfirm: { ids in
                    selectedProjectIds = ids
                    showProjectPicker = false
                },
                includeNoProject: .constant(false)
            )
            .presentationDetents([.medium, .large])
        }
        .task {
            await loadOptions()
        }
    }

    private func loadOptions() async {
        let options = await CreateIssueMetadataOptionsLoader.load(
            labels: { try await dataSources.labels.listLabels() },
            projects: { try await dataSources.projects.listProjects() }
        )

        if let labels = options.labels {
            allLabels = labels
        }
        if let projects = options.projects {
            allProjects = projects
        }
    }

    private var labelsRow: some View {
        FormNavigationRow(title: "Labels", action: {
            labelDraft = selectedLabelNames
            showLabelPicker = true
        }) {
            if selectedLabelNames.isEmpty {
                EmptyFormSelection()
            } else {
                FlowLayout(spacing: 6) {
                    ForEach(Array(selectedLabelNames).sorted(), id: \.self) { name in
                        IssueLabelChip(name: name)
                    }
                }
            }
        }
    }

    private var projectsRow: some View {
        FormNavigationRow(title: "Projects", action: {
            projectDraft = selectedProjectIds
            showProjectPicker = true
        }) {
            if selectedProjectIds.isEmpty {
                EmptyFormSelection()
            } else {
                VStack(alignment: .leading, spacing: 4) {
                    ForEach(allProjects.filter { selectedProjectIds.contains($0.id) }) { project in
                        Text(project.name)
                            .font(.system(size: 13))
                            .foregroundColor(.textSecondary)
                    }
                }
            }
        }
    }
}

struct CreateIssueErrorBanner: View {
    let message: String

    var body: some View {
        Text(message)
            .font(.system(size: 13))
            .foregroundColor(.red)
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(12)
            .background(Color.red.opacity(0.08))
            .clipShape(RoundedRectangle(cornerRadius: 8))
            .padding(.horizontal, 16)
            .padding(.top, 12)
    }
}

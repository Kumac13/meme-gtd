import SwiftUI

/// New Template modal. Same anatomy as CreateTaskModal (header + rows +
/// picker sheets), minus the task-only rows (status/schedule/links) and plus
/// the Target row (issues.template_target).
struct CreateTemplateModal: View {
    let onCreated: (Template) -> Void
    let onDismiss: () -> Void

    @EnvironmentObject var dataSources: DataSourceProvider
    @StateObject private var viewModel = CreateTemplateViewModel()

    @State private var showLabelPicker = false
    @State private var showProjectPicker = false
    @State private var selectedLabelNames: Set<String> = []
    @State private var selectedProjectIds: Set<Int> = []

    var body: some View {
        VStack(spacing: 0) {
            header

            Divider()

            fullForm
        }
        .background(Color(.systemBackground))
        .task {
            viewModel.dataSources = dataSources
            await viewModel.loadData()
            selectedLabelNames = viewModel.selectedLabelNames
            selectedProjectIds = viewModel.selectedProjectIds
        }
    }

    // MARK: - Header

    private var header: some View {
        ModalHeader(
            title: "New Template",
            onDismiss: onDismiss,
            trailingAction: .create(
                isEnabled: !viewModel.title.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty,
                isSubmitting: viewModel.isSubmitting,
                action: submit
            )
        )
    }

    // MARK: - Full Form

    private var fullForm: some View {
        ScrollView {
            VStack(spacing: 0) {
                // Title
                VStack(alignment: .leading, spacing: 4) {
                    Text("Title")
                        .font(.system(size: 13, weight: .medium))
                        .foregroundColor(.textSecondary)
                    AutoFocusTextField(
                        placeholder: "Template title...",
                        text: $viewModel.title
                    )
                }
                .padding(.horizontal, 16)
                .padding(.vertical, 12)

                Divider().padding(.leading, 16)

                // Body
                VStack(alignment: .leading, spacing: 4) {
                    Text("Body")
                        .font(.system(size: 13, weight: .medium))
                        .foregroundColor(.textSecondary)
                    TextEditor(text: $viewModel.bodyMd)
                        .font(.system(size: 15))
                        .frame(minHeight: 80, maxHeight: 160)
                        .scrollContentBackground(.hidden)
                        .tint(Color.accent)
                }
                .padding(.horizontal, 16)
                .padding(.vertical, 12)

                Divider().padding(.leading, 16)

                // Target (issues.template_target)
                targetRow

                Divider().padding(.leading, 16)

                // Labels
                labelsRow

                Divider().padding(.leading, 16)

                // Projects
                projectsRow

                if let error = viewModel.error {
                    errorBanner(error)
                }

                Color.clear.frame(height: 40)
            }
        }
        .scrollDismissesKeyboard(.immediately)
        .sheet(isPresented: $showLabelPicker) {
            LabelPickerModal(
                allLabels: viewModel.allLabels,
                selectedNames: $selectedLabelNames,
                onDismiss: { showLabelPicker = false },
                countFor: { $0.taskCount },
                onLabelCreated: { newLabel in
                    viewModel.allLabels.append(newLabel)
                    selectedLabelNames.insert(newLabel.name)
                }
            )
            .presentationDetents([.medium, .large])
        }
        .onChange(of: selectedLabelNames) { _, newValue in
            viewModel.selectedLabelNames = newValue
        }
        .sheet(isPresented: $showProjectPicker) {
            ProjectPickerModal(
                allProjects: viewModel.allProjects,
                selectedIds: $selectedProjectIds,
                onDismiss: { showProjectPicker = false },
                onConfirm: { ids in
                    viewModel.selectedProjectIds = ids
                    selectedProjectIds = ids
                    showProjectPicker = false
                },
                includeNoProject: .constant(false)
            )
            .presentationDetents([.medium, .large])
        }
    }

    // MARK: - Target Row

    private var targetRow: some View {
        HStack {
            Text("Target")
                .font(.system(size: 15))
                .foregroundColor(.textPrimary)
            Spacer()
            Picker("Target", selection: $viewModel.templateTarget) {
                Text("Task").tag("task")
                Text("Article").tag("article")
            }
            .pickerStyle(.segmented)
            .frame(width: 180)
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 10)
    }

    // MARK: - Labels Row

    private var labelsRow: some View {
        Button(action: {
            HapticManager.impact(.light)
            selectedLabelNames = viewModel.selectedLabelNames
            showLabelPicker = true
        }) {
            VStack(alignment: .leading, spacing: 0) {
                HStack {
                    Text("Labels")
                        .font(.system(size: 15))
                        .foregroundColor(.textPrimary)
                    Spacer()
                    Image(systemName: "chevron.right")
                        .font(.system(size: 12, weight: .medium))
                        .foregroundColor(Color(.systemGray3))
                }

                if !viewModel.selectedLabelNames.isEmpty {
                    FlowLayout(spacing: 6) {
                        ForEach(Array(viewModel.selectedLabelNames).sorted(), id: \.self) { name in
                            IssueLabelChip(name: name)
                        }
                    }
                    .padding(.top, 8)
                } else {
                    Text("None")
                        .font(.system(size: 13))
                        .foregroundColor(.textSecondary)
                        .padding(.top, 4)
                }
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 14)
        }
    }

    // MARK: - Projects Row

    private var projectsRow: some View {
        Button(action: {
            HapticManager.impact(.light)
            selectedProjectIds = viewModel.selectedProjectIds
            showProjectPicker = true
        }) {
            VStack(alignment: .leading, spacing: 0) {
                HStack {
                    Text("Projects")
                        .font(.system(size: 15))
                        .foregroundColor(.textPrimary)
                    Spacer()
                    Image(systemName: "chevron.right")
                        .font(.system(size: 12, weight: .medium))
                        .foregroundColor(Color(.systemGray3))
                }

                if !viewModel.selectedProjectIds.isEmpty {
                    VStack(alignment: .leading, spacing: 4) {
                        ForEach(viewModel.allProjects.filter { viewModel.selectedProjectIds.contains($0.id) }) { project in
                            Text(project.name)
                                .font(.system(size: 13))
                                .foregroundColor(.textSecondary)
                        }
                    }
                    .padding(.top, 6)
                } else {
                    Text("None")
                        .font(.system(size: 13))
                        .foregroundColor(.textSecondary)
                        .padding(.top, 4)
                }
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 14)
        }
    }

    // MARK: - Error Banner

    private func errorBanner(_ message: String) -> some View {
        HStack {
            Image(systemName: "exclamationmark.triangle.fill")
                .font(.system(size: 14))
                .foregroundColor(.red)
            Text(message)
                .font(.system(size: 13))
                .foregroundColor(.red)
            Spacer()
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 10)
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

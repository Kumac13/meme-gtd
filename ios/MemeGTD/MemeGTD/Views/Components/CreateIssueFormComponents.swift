import SwiftUI

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
                Text("Description")
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
    @Binding var allLabels: [IssueLabel]
    @Binding var selectedLabelNames: Set<String>
    @Binding var allProjects: [Project]
    @Binding var selectedProjectIds: Set<Int>
    let labelCount: (IssueLabel) -> Int

    @State private var showLabelPicker = false
    @State private var showProjectPicker = false

    var body: some View {
        VStack(spacing: 0) {
            labelsRow

            Divider().padding(.leading, 16)

            projectsRow
        }
        .sheet(isPresented: $showLabelPicker) {
            LabelPickerModal(
                allLabels: allLabels,
                selectedNames: $selectedLabelNames,
                onDismiss: { showLabelPicker = false },
                countFor: labelCount,
                onLabelCreated: { newLabel in
                    allLabels.append(newLabel)
                    selectedLabelNames.insert(newLabel.name)
                }
            )
            .presentationDetents([.medium, .large])
        }
        .sheet(isPresented: $showProjectPicker) {
            ProjectPickerModal(
                allProjects: allProjects,
                selectedIds: $selectedProjectIds,
                onDismiss: { showProjectPicker = false },
                onConfirm: { ids in
                    selectedProjectIds = ids
                    showProjectPicker = false
                },
                includeNoProject: .constant(false)
            )
            .presentationDetents([.medium, .large])
        }
    }

    private var labelsRow: some View {
        Button(action: {
            HapticManager.impact(.light)
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

                if selectedLabelNames.isEmpty {
                    Text("None")
                        .font(.system(size: 13))
                        .foregroundColor(.textSecondary)
                        .padding(.top, 4)
                } else {
                    FlowLayout(spacing: 6) {
                        ForEach(Array(selectedLabelNames).sorted(), id: \.self) { name in
                            IssueLabelChip(name: name)
                        }
                    }
                    .padding(.top, 8)
                }
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 14)
        }
    }

    private var projectsRow: some View {
        Button(action: {
            HapticManager.impact(.light)
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

                if selectedProjectIds.isEmpty {
                    Text("None")
                        .font(.system(size: 13))
                        .foregroundColor(.textSecondary)
                        .padding(.top, 4)
                } else {
                    VStack(alignment: .leading, spacing: 4) {
                        ForEach(allProjects.filter { selectedProjectIds.contains($0.id) }) { project in
                            Text(project.name)
                                .font(.system(size: 13))
                                .foregroundColor(.textSecondary)
                        }
                    }
                    .padding(.top, 6)
                }
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 14)
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

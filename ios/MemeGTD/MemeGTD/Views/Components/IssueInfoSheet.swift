import SwiftUI

struct IssueInfoSheet<VM: IssueDetailProvider>: View {
    @ObservedObject var viewModel: VM
    @Binding var showCopiedFeedback: Bool
    var onEditTitle: (() -> Void)?
    var onDelete: (() -> Void)?
    var onNewTask: (() -> Void)?
    var labelCountKeyPath: KeyPath<IssueLabel, Int> = \.memoCount
    @Environment(\.dismiss) private var dismiss

    @State private var showLabelPicker = false
    @State private var showProjectPicker = false
    @State private var showLinkPicker = false
    @State private var selectedLabelNames: Set<String> = []
    @State private var selectedProjectIds: Set<Int> = []

    var body: some View {
        VStack(spacing: 0) {
            // Header
            HStack {
                Button(action: { dismiss() }) {
                    Image(systemName: "xmark.circle.fill")
                        .font(.system(size: 28))
                        .symbolRenderingMode(.hierarchical)
                        .foregroundColor(Color(.tertiaryLabel))
                }
                Spacer()
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 12)

            Divider()

            // Rows
            VStack(spacing: 0) {
                // Bookmark
                Button(action: {
                    Task { await viewModel.toggleBookmark() }
                }) {
                    HStack {
                        Text("Bookmark")
                            .font(.system(size: 15))
                            .foregroundColor(.textPrimary)
                        Spacer()
                        Image(systemName: viewModel.isBookmarked ? "bookmark.fill" : "bookmark")
                            .font(.system(size: 18))
                            .foregroundColor(viewModel.isBookmarked ? .accent : .textSecondary)
                    }
                    .padding(.horizontal, 16)
                    .padding(.vertical, 14)
                }
                .disabled(viewModel.isBookmarking)

                Divider().padding(.leading, 16)

                // New Task (optional, for tasks)
                if let onNewTask = onNewTask {
                    Button(action: {
                        dismiss()
                        onNewTask()
                    }) {
                        HStack {
                            Text("New Task")
                                .font(.system(size: 15))
                                .foregroundColor(.textPrimary)
                            Spacer()
                            Image(systemName: "plus.square")
                                .font(.system(size: 15))
                                .foregroundColor(.textSecondary)
                        }
                        .padding(.horizontal, 16)
                        .padding(.vertical, 14)
                    }

                    Divider().padding(.leading, 16)
                }

                // Edit Title (Task only)
                if let onEditTitle = onEditTitle {
                    Button(action: {
                        dismiss()
                        onEditTitle()
                    }) {
                        HStack {
                            Text("Title")
                                .font(.system(size: 15))
                                .foregroundColor(.textPrimary)
                            Spacer()
                            Text("Edit")
                                .font(.system(size: 15))
                                .foregroundColor(.accent)
                        }
                        .padding(.horizontal, 16)
                        .padding(.vertical, 14)
                    }

                    Divider().padding(.leading, 16)
                }

                // Labels
                Button(action: {
                    selectedLabelNames = Set(viewModel.issueLabels)
                    showLabelPicker = true
                }) {
                    VStack(alignment: .leading, spacing: 0) {
                        HStack {
                            Text("Labels")
                                .font(.system(size: 15))
                                .foregroundColor(.textPrimary)
                            Spacer()
                            Text("Edit")
                                .font(.system(size: 15))
                                .foregroundColor(.accent)
                        }

                        if !viewModel.issueLabels.isEmpty {
                            FlowLayout(spacing: 6) {
                                ForEach(viewModel.issueLabels, id: \.self) { name in
                                    Text(name)
                                        .font(.system(size: 12, weight: .medium))
                                        .padding(.horizontal, 8)
                                        .padding(.vertical, 4)
                                        .background(LabelColorHelper.bgColor(for: name))
                                        .foregroundColor(LabelColorHelper.textColor(for: name))
                                        .clipShape(Capsule())
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

                Divider().padding(.leading, 16)

                // Projects
                Button(action: {
                    selectedProjectIds = Set(viewModel.associatedProjects.map(\.id))
                    showProjectPicker = true
                }) {
                    VStack(alignment: .leading, spacing: 0) {
                        HStack {
                            Text("Projects")
                                .font(.system(size: 15))
                                .foregroundColor(.textPrimary)
                            Spacer()
                            Text("Edit")
                                .font(.system(size: 15))
                                .foregroundColor(.accent)
                        }

                        if !viewModel.associatedProjects.isEmpty {
                            VStack(alignment: .leading, spacing: 4) {
                                ForEach(viewModel.associatedProjects) { project in
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

                Divider().padding(.leading, 16)

                // Links
                Button(action: { showLinkPicker = true }) {
                    VStack(alignment: .leading, spacing: 0) {
                        HStack {
                            Text("Links")
                                .font(.system(size: 15))
                                .foregroundColor(.textPrimary)
                            Spacer()
                            Text("Edit")
                                .font(.system(size: 15))
                                .foregroundColor(.accent)
                        }

                        if !viewModel.issueLinks.isEmpty {
                            VStack(alignment: .leading, spacing: 6) {
                                ForEach(viewModel.issueLinks) { link in
                                    HStack(spacing: 6) {
                                        Image(systemName: link.linkType.iconName)
                                            .font(.system(size: 11, weight: .medium))
                                            .foregroundColor(.textPrimary)
                                            .frame(width: 12)

                                        issueTypeBadge(link.targetIssue.type)

                                        Text(link.targetIssue.title)
                                            .font(.system(size: 13))
                                            .foregroundColor(.textPrimary)
                                            .lineLimit(1)
                                    }
                                }
                            }
                            .padding(.top, 6)
                        } else {
                            Text("None")
                                .font(.system(size: 13))
                                .foregroundColor(.accentDark)
                                .padding(.top, 4)
                        }
                    }
                    .padding(.horizontal, 16)
                    .padding(.vertical, 14)
                }

                Divider().padding(.leading, 16)

                // Copy All Contents
                Button(action: {
                    viewModel.copyAllContents()
                    showCopiedFeedback = true
                    DispatchQueue.main.asyncAfter(deadline: .now() + 2) {
                        showCopiedFeedback = false
                    }
                    dismiss()
                }) {
                    HStack {
                        Text(showCopiedFeedback ? "Copied!" : "Copy All Contents")
                            .font(.system(size: 15))
                            .foregroundColor(.textPrimary)
                        Spacer()
                        Image(systemName: "doc.on.doc")
                            .font(.system(size: 15))
                            .foregroundColor(.textSecondary)
                    }
                    .padding(.horizontal, 16)
                    .padding(.vertical, 14)
                }

                // Delete (optional, for tasks)
                if let onDelete = onDelete {
                    Divider().padding(.leading, 16)

                    Button(action: {
                        dismiss()
                        onDelete()
                    }) {
                        HStack {
                            Text("Delete")
                                .font(.system(size: 15))
                                .foregroundColor(.red)
                            Spacer()
                            Image(systemName: "trash")
                                .font(.system(size: 15))
                                .foregroundColor(.red)
                        }
                        .padding(.horizontal, 16)
                        .padding(.vertical, 14)
                    }
                }
            }

            Spacer()
        }
        .background(Color(.systemBackground))
        .sheet(isPresented: $showLinkPicker) {
            LinkPickerModal(
                viewModel: viewModel,
                onDismiss: { showLinkPicker = false }
            )
            .presentationDetents([.medium, .large])
        }
        .sheet(isPresented: $showLabelPicker) {
            LabelPickerModal(
                allLabels: viewModel.allLabels,
                selectedNames: $selectedLabelNames,
                onDismiss: { showLabelPicker = false },
                countFor: { $0[keyPath: labelCountKeyPath] }
            )
            .presentationDetents([.medium, .large])
        }
        .onChange(of: selectedLabelNames) { _, newValue in
            viewModel.confirmLabels(newValue)
        }
        .sheet(isPresented: $showProjectPicker) {
            ProjectPickerModal(
                allProjects: viewModel.allProjects,
                selectedIds: $selectedProjectIds,
                onDismiss: { showProjectPicker = false },
                onConfirm: { ids in
                    viewModel.confirmProjects(ids)
                    showProjectPicker = false
                },
                includeNoProject: .constant(false)
            )
            .presentationDetents([.medium, .large])
        }
    }

    // MARK: - Issue type badge

    private static var badgeWidth: CGFloat { 56 }

    @ViewBuilder
    private func issueTypeBadge(_ type: String) -> some View {
        let label = type.capitalized
        let (bg, fg) = issueTypeColors(type)
        Text(label)
            .font(.system(size: 12, weight: .medium))
            .padding(.horizontal, 8)
            .padding(.vertical, 4)
            .frame(width: Self.badgeWidth)
            .background(bg)
            .foregroundColor(fg)
            .clipShape(Capsule())
    }

    private func issueTypeColors(_ type: String) -> (Color, Color) {
        switch type {
        case "task":
            return (Color(hex: "#1a7f37"), Color.white)
        case "memo":
            return (Color(hex: "#dafbe1"), Color(hex: "#1a7f37"))
        case "article":
            return (Color(hex: "#b4e6be"), Color(hex: "#0d5821"))
        default:
            return (Color.accent.opacity(0.15), Color.accentDark)
        }
    }
}

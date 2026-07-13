import SwiftUI

struct IssueInfoSheet<VM: IssueDetailProvider>: View {
    @ObservedObject var viewModel: VM
    @Binding var showCopiedFeedback: Bool
    /// Disables every write action (offline read-only cache, Phase 7).
    /// Copy and link navigation stay available. Defaults to false so
    /// existing call sites (memos) keep their behavior.
    var isReadOnly: Bool = false
    var onEditTitle: (() -> Void)?
    var onDelete: (() -> Void)?
    var onNewTask: (() -> Void)?
    var onAddChild: (() -> Void)?
    var onPromoteToTask: (() -> Void)?
    var onNavigateToIssue: ((TargetIssue) -> Void)?
    var labelCountKeyPath: KeyPath<IssueLabel, Int> = \.memoCount
    var showBookmark: Bool = true
    /// Templates have no links, so their detail sheet hides the section
    /// (same opt-out pattern as `showBookmark`).
    var showLinks: Bool = true
    @Environment(\.dismiss) private var dismiss
    @Environment(\.openURL) private var openURL

    @State private var showLabelPicker = false
    @State private var showProjectPicker = false
    @State private var showLinkPicker = false
    @State private var selectedLabelNames: Set<String> = []
    @State private var selectedProjectIds: Set<Int> = []

    var body: some View {
        VStack(spacing: 0) {
            // Header
            HStack {
                Button(action: { HapticManager.impact(.light); dismiss() }) {
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
                if showBookmark {
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
                    .disabled(viewModel.isBookmarking || isReadOnly)

                    Divider().padding(.leading, 16)
                }

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
                    .disabled(isReadOnly)

                    Divider().padding(.leading, 16)
                }

                // Add Child (optional, for tasks)
                if let onAddChild = onAddChild {
                    Button(action: {
                        dismiss()
                        onAddChild()
                    }) {
                        HStack {
                            Text("Add Child")
                                .font(.system(size: 15))
                                .foregroundColor(.textPrimary)
                            Spacer()
                            Image(systemName: "arrow.turn.down.right")
                                .font(.system(size: 15))
                                .foregroundColor(.textSecondary)
                        }
                        .padding(.horizontal, 16)
                        .padding(.vertical, 14)
                    }
                    .disabled(isReadOnly)

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
                    .disabled(isReadOnly)

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
                .disabled(isReadOnly)

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
                .disabled(isReadOnly)

                Divider().padding(.leading, 16)

                // Links
                if showLinks {
                VStack(alignment: .leading, spacing: 0) {
                    Button(action: { showLinkPicker = true }) {
                        HStack {
                            Text("Links")
                                .font(.system(size: 15))
                                .foregroundColor(.textPrimary)
                            Spacer()
                            Text("Edit")
                                .font(.system(size: 15))
                                .foregroundColor(.accent)
                        }
                    }
                    .disabled(isReadOnly)

                    if !viewModel.issueLinks.isEmpty || !viewModel.urlLinks.isEmpty {
                        VStack(alignment: .leading, spacing: 6) {
                            ForEach(viewModel.issueLinks) { link in
                                Button(action: {
                                    if let onNavigateToIssue {
                                        onNavigateToIssue(link.targetIssue)
                                    } else {
                                        dismiss()
                                    }
                                }) {
                                    HStack(spacing: 6) {
                                        Image(systemName: link.linkType.iconName)
                                            .font(.system(size: 11, weight: .medium))
                                            .foregroundColor(.textPrimary)
                                            .frame(width: 12)

                                        IssueTypeBadge(type: link.targetIssue.type)

                                        Text(link.targetIssue.title)
                                            .font(.system(size: 13))
                                            .foregroundColor(.textPrimary)
                                            .lineLimit(1)
                                    }
                                }
                            }

                            ForEach(viewModel.urlLinks) { urlLink in
                                Button(action: {
                                    if let url = URL(string: urlLink.url) {
                                        openURL(url)
                                    }
                                }) {
                                    HStack(spacing: 6) {
                                        Image(systemName: "link")
                                            .font(.system(size: 11, weight: .medium))
                                            .foregroundColor(.accent)
                                            .frame(width: 12)

                                        Text(urlLink.displayLabel)
                                            .font(.system(size: 13))
                                            .foregroundColor(.accent)
                                            .lineLimit(1)

                                        Image(systemName: "arrow.up.right")
                                            .font(.system(size: 9, weight: .medium))
                                            .foregroundColor(.accent)
                                    }
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

                Divider().padding(.leading, 16)
                }

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

                // Promote to Task (optional, for memos)
                if let onPromoteToTask = onPromoteToTask {
                    Divider().padding(.leading, 16)

                    Button(action: {
                        dismiss()
                        onPromoteToTask()
                    }) {
                        HStack {
                            Text("Promote to Task")
                                .font(.system(size: 15))
                                .foregroundColor(.textPrimary)
                            Spacer()
                            Image(systemName: "arrow.up.forward.square")
                                .font(.system(size: 15))
                                .foregroundColor(.textSecondary)
                        }
                        .padding(.horizontal, 16)
                        .padding(.vertical, 14)
                    }
                    .disabled(isReadOnly)
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
                    .disabled(isReadOnly)
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
                countFor: { $0[keyPath: labelCountKeyPath] },
                onLabelCreated: { newLabel in
                    viewModel.addNewLabel(newLabel)
                    selectedLabelNames.insert(newLabel.name)
                }
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

}

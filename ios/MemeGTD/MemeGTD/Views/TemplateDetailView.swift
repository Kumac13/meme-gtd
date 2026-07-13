import SwiftUI

/// Template detail. Same screen anatomy as TaskDetailView (glass area cards,
/// body ThreadItem, FloatingComposer edits, "..." info sheet), minus the
/// task-only parts (status, schedule, comments/activity timeline, links) and
/// plus a Target pill (issues.template_target) in the title area.
struct TemplateDetailView: View {
    let templateId: Int
    let initialTitle: String?
    let onMenuTap: () -> Void

    @EnvironmentObject var templateStore: TemplateStore
    @EnvironmentObject var dataSources: DataSourceProvider
    @StateObject private var viewModel: TemplateDetailViewModel
    @Environment(\.dismiss) private var dismiss
    @State private var showDeleteConfirm: Bool = false
    @State private var showInfoSheet: Bool = false
    @State private var showCopiedFeedback: Bool = false
    @State private var showTargetPicker: Bool = false
    @State private var editingMode: EditingMode = .none

    enum EditingMode: Equatable {
        case none
        case title
        case body
    }

    init(templateId: Int, initialTitle: String? = nil, onMenuTap: @escaping () -> Void) {
        self.templateId = templateId
        self.initialTitle = initialTitle
        self.onMenuTap = onMenuTap
        self._viewModel = StateObject(wrappedValue: TemplateDetailViewModel(templateId: templateId))
    }

    var body: some View {
        GeometryReader { geo in
            ScrollView {
                LazyVStack(spacing: 0) {
                    if let template = viewModel.template {
                        // === Title Area (glass, extends to top of screen) ===
                        IssueAreaCard {
                            VStack(alignment: .leading, spacing: 8) {
                                Text(template.title ?? "Template #\(template.id)")
                                    .font(.system(size: 18, weight: .semibold))
                                    .foregroundColor(.textPrimary)

                                // Target pill (issues.template_target), same
                                // idiom as the task status pill.
                                Button(action: {
                                    HapticManager.impact(.light)
                                    showTargetPicker = true
                                }) {
                                    HStack(spacing: 4) {
                                        Text(template.templateTarget == "article" ? "Article" : "Task")
                                            .font(.system(size: 12, weight: .medium))
                                        Image(systemName: "chevron.down")
                                            .font(.system(size: 8, weight: .semibold))
                                    }
                                    .padding(.horizontal, 10)
                                    .padding(.vertical, 4)
                                    .background(Color.accent.opacity(0.15))
                                    .foregroundColor(.accent)
                                    .clipShape(Capsule())
                                }
                            }
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .padding(.vertical, 10)
                            .padding(.horizontal, 16)
                            .padding(.top, geo.safeAreaInsets.top)
                        }

                        IssueSectionConnector()

                        // === Body Area (glass, full width) ===
                        IssueAreaCard {
                            VStack(alignment: .leading, spacing: 0) {
                                HStack {
                                    HStack(spacing: 4) {
                                        let isEdited = template.updatedAt != template.createdAt
                                        Text(TimelineHelpers.relativeTimeString(iso: isEdited ? template.updatedAt : template.createdAt))
                                        if isEdited {
                                            Text("(edited)")
                                        }
                                    }
                                    .font(.system(size: 11))
                                    .foregroundColor(Color(.systemGray))

                                    Spacer()

                                    Menu {
                                        Button(action: {
                                            UIPasteboard.general.string = template.bodyMd
                                            HapticManager.notification(.success)
                                        }) {
                                            Label("Copy", systemImage: "doc.on.doc")
                                        }
                                        Button(action: {
                                            viewModel.replyBody = template.bodyMd
                                            editingMode = .body
                                        }) {
                                            Label("Edit", systemImage: "pencil")
                                        }
                                    } label: {
                                        Image(systemName: "ellipsis")
                                            .font(.system(size: 13))
                                            .foregroundColor(.textSecondary)
                                            .frame(width: 28, height: 20)
                                            .contentShape(Rectangle())
                                    }
                                }
                                .padding(.horizontal, 16)
                                .padding(.top, 8)
                                .padding(.bottom, -2)

                                if !template.bodyMd.isEmpty {
                                    ThreadItem(
                                        bodyMd: template.bodyMd,
                                        labels: nil,
                                        showMenu: false
                                    )
                                } else {
                                    Text("No body provided.")
                                        .font(.system(size: 14))
                                        .foregroundColor(.textSecondary)
                                        .italic()
                                        .frame(maxWidth: .infinity, alignment: .leading)
                                        .padding(.vertical, 10)
                                        .padding(.horizontal, 16)
                                }
                            }
                        }
                    }

                    Color.clear.frame(height: 24)
                }
            }
            .background(Color.menuBackground)
            .scrollDismissesKeyboard(.immediately)
            .ignoresSafeArea(edges: .top)
            .refreshable {
                await withCheckedContinuation { continuation in
                    Task { @MainActor in
                        HapticManager.impact(.medium)
                        if let fetched = await viewModel.fetchTemplate() {
                            viewModel.applyTemplate(fetched)
                        }
                        HapticManager.notification(.success)
                        continuation.resume()
                    }
                }
            }
            .safeAreaBar(edge: .bottom) {
                if editingMode != .none {
                    FloatingComposer(
                        text: $viewModel.replyBody,
                        placeholder: composerPlaceholder,
                        disabled: viewModel.isLoading,
                        submitting: viewModel.isSubmittingReply,
                        notice: composerNotice,
                        onDismissNotice: {
                            editingMode = .none
                            viewModel.replyBody = ""
                        },
                        onSubmit: {
                            switch editingMode {
                            case .title:
                                Task {
                                    await viewModel.updateTemplate(title: viewModel.replyBody)
                                    editingMode = .none
                                    viewModel.replyBody = ""
                                }
                            case .body:
                                Task {
                                    await viewModel.updateTemplate(bodyMd: viewModel.replyBody)
                                    editingMode = .none
                                    viewModel.replyBody = ""
                                }
                            case .none:
                                break
                            }
                        }
                    )
                    .padding(.horizontal, 16)
                    .padding(.bottom, 10)
                }
            }
            .enableSwipeBack()
            .navigationBarBackButtonHidden(true)
            .toolbar {
                AppToolbar(
                    title: toolbarTitle,
                    onMenuTap: onMenuTap,
                    titleLineLimit: 1,
                    trailing: {
                        Button(action: {
                            HapticManager.impact(.light)
                            showInfoSheet = true
                        }) {
                            Image(systemName: "ellipsis")
                                .font(.system(size: 17, weight: .medium))
                                .foregroundColor(.textPrimary)
                        }
                    }
                )
            }
            .navigationBarTitleDisplayMode(.inline)
            .sheet(isPresented: $showInfoSheet) {
                IssueInfoSheet(
                    viewModel: viewModel,
                    showCopiedFeedback: $showCopiedFeedback,
                    bookmarkProvider: nil,
                    linkProvider: nil,
                    copyProvider: viewModel,
                    onEditTitle: {
                        if let template = viewModel.template {
                            viewModel.replyBody = template.title ?? ""
                            editingMode = .title
                        }
                    },
                    onDelete: { showDeleteConfirm = true },
                    labelCountKeyPath: \.taskCount
                )
                .presentationDetents([.fraction(0.7), .large])
            }
            .sheet(isPresented: $showTargetPicker) {
                targetPickerSheet
                    .presentationDetents([.medium])
            }
            .alert("Delete Template", isPresented: $showDeleteConfirm) {
                Button("Cancel", role: .cancel) {}
                Button("Delete", role: .destructive) {
                    Task {
                        if await viewModel.deleteTemplate() {
                            dismiss()
                        }
                    }
                }
            } message: {
                Text("Are you sure you want to delete this template? This action cannot be undone.")
            }
            .overlay {
                LoadingOverlay(
                    isPresented: viewModel.isLoading && viewModel.template == nil,
                    message: "Loading..."
                )
            }
            .task {
                viewModel.templateStore = templateStore
                viewModel.dataSources = dataSources
                await viewModel.loadTemplate()
            }
        }
    }

    // MARK: - Toolbar title

    private var toolbarTitle: String {
        viewModel.template?.title ?? initialTitle ?? (templateId > 0 ? "#\(templateId)" : "")
    }

    // MARK: - Composer helpers

    private var composerPlaceholder: String {
        switch editingMode {
        case .title: return "Edit title..."
        case .body: return "Edit body..."
        case .none: return ""
        }
    }

    private var composerNotice: String? {
        switch editingMode {
        case .title: return "Editing title"
        case .body: return "Editing body"
        case .none: return nil
        }
    }

    // MARK: - Target Picker Sheet (issues.template_target)

    private var targetPickerSheet: some View {
        SingleChoiceFilterSheet(
            title: "Target",
            options: ["task", "article"],
            selected: viewModel.template?.templateTarget ?? "task",
            label: { $0 == "article" ? "Article" : "Task" },
            onSelect: { target in
                Task { await viewModel.updateTemplate(templateTarget: target) }
                showTargetPicker = false
            },
            onDismiss: { showTargetPicker = false }
        )
    }
}

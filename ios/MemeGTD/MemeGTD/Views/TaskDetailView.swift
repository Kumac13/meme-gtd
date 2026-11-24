import SwiftUI

struct TaskDetailView: View {
    @State private var delivery = ThreadDelivery()
    let taskId: Int
    let initialTitle: String?
    let onMenuTap: () -> Void
    var onTransferredToMemo: ((Int) -> Void)?
    var onNavigateToLinkedIssue: ((Int, String, String) -> Void)?

    @EnvironmentObject var taskStore: TaskStore
    @EnvironmentObject var memoStore: MemoStore
    @EnvironmentObject var articleStore: ArticleStore
    @State private var pendingConversion: String?
    @State private var conversionConfirmation: ConfirmationRequest?
    @EnvironmentObject var dataSources: DataSourceProvider
    @StateObject private var viewModel: TaskDetailViewModel
    @Environment(\.dismiss) private var dismiss
    @State private var showDeleteConfirm: Bool = false
    @StateObject private var linkedIssueNavigation = DeferredSheetActionCoordinator<TargetIssue>()
    @State private var showCopiedFeedback: Bool = false
    @State private var showStatusPicker: Bool = false
    @State private var editingMode: EditingMode = .none
    @State private var createTaskMode: CreateTaskMode? = nil
    @StateObject private var newTaskCreation = CreationPresentationCoordinator<CreateTaskModeKind>()
    @State private var beginNewTaskAfterInfoDismiss = false
    @StateObject private var imageAttachment = ImageAttachmentCoordinator()
    @ObservedObject private var connectivity = ConnectivityMonitor.shared

    /// Server mode + Offline Sync ON + offline: the task is served from the
    /// local read cache and cannot be edited (offline support plan Phase 7).
    /// Never true in Standalone (tasks are fully local there).
    private var isOfflineReadOnly: Bool {
        connectivity.isOfflineReadOnly
    }

    enum EditingMode: Equatable {
        case none
        case title
        case body
        case comment(Int)
    }

    init(taskId: Int, initialTitle: String? = nil, onMenuTap: @escaping () -> Void, onNavigateToLinkedIssue: ((Int, String, String) -> Void)? = nil, onTransferredToMemo: ((Int) -> Void)? = nil) {
        self.taskId = taskId
        self.initialTitle = initialTitle
        self.onMenuTap = onMenuTap
        self.onNavigateToLinkedIssue = onNavigateToLinkedIssue
        self.onTransferredToMemo = onTransferredToMemo
        self._viewModel = StateObject(wrappedValue: TaskDetailViewModel(taskId: taskId))
    }

    var body: some View {
        GeometryReader { geo in
        IssueDetailScrollShell(
            policy: IssueDetailScrollPolicy(initialPosition: .top),
            isContentReady: viewModel.task != nil
        ) { scrollActions in
            ScrollView {
                LazyVStack(spacing: 0) {
                    if let task = viewModel.task {
                        // === Title Area (glass, extends to top of screen) ===
                        IssueAreaCard {
                            TaskTitleSection(
                                title: task.title,
                                status: task.status,
                                isReadOnly: isOfflineReadOnly || viewModel.isConverting,
                                onStatusTap: {
                                    guard !isOfflineReadOnly else { return }
                                    showStatusPicker = true
                                }
                            )
                            .padding(.top, geo.safeAreaInsets.top)
                        }

                        // --- Connector line ---
                        IssueSectionConnector()

                        // === Body Area (glass, full width) ===
                        IssueContentCard(
                            bodyMd: task.bodyMd,
                            createdAt: task.createdAt,
                            updatedAt: task.updatedAt,
                            pending: delivery.parentPending,
                            emptyText: "No description provided.",
                            mutationsDisabled: isOfflineReadOnly,
                            onEdit: {
                                viewModel.replyBody = task.bodyMd
                                editingMode = .body
                            },
                            onIssueTap: { id, type in
                                onNavigateToLinkedIssue?(id, type, "")
                            },
                            onTodoToggle: { todoIndex, _ in
                                guard !isOfflineReadOnly else { return }
                                Task { await viewModel.toggleBodyTodo(at: todoIndex) }
                            }
                        )

                        // === Timeline: Comments + Activities interleaved ===
                        if !delivery.historyAvailable {
                            Text("Earlier replies have not been downloaded.")
                                .font(.footnote).foregroundStyle(.secondary)
                        }
                        IssueTimeline(
                            entries: viewModel.timelineEntries,
                            issueId: taskId,
                            pendingComments: delivery.pendingComments,
                            mutationsDisabled: isOfflineReadOnly,
                            onEditComment: { comment in
                                viewModel.replyBody = comment.bodyMd
                                editingMode = .comment(comment.id)
                            },
                            onDeleteComment: { comment in
                                Task { await viewModel.deleteComment(comment.id) }
                            },
                            onIssueTap: { id, type in
                                onNavigateToLinkedIssue?(id, type, "")
                            },
                            onTodoToggle: { comment, todoIndex, _ in
                                guard !isOfflineReadOnly else { return }
                                Task { await viewModel.toggleCommentTodo(commentId: comment.id, todoIndex: todoIndex) }
                            }
                        )
                    }

                    IssueDetailBottomAnchor()
                }
            }
            .background(Color.menuBackground)
            .scrollDismissesKeyboard(.immediately)
            .ignoresSafeArea(edges: .top)
            .scrollEdgeEffectStyle(.soft, for: .vertical)
            .refreshable {
                await withCheckedContinuation { continuation in
                    Task { @MainActor in
                        HapticManager.impact(.medium)

                        let start = Date()
                        let sync = await dataSources.syncScheduler?.refresh()
                        let result = await viewModel.fetchTask()

                        let elapsed = Date().timeIntervalSince(start)
                        let remaining = 0.75 - elapsed
                        if remaining > 0 {
                            try? await Task.sleep(nanoseconds: UInt64(remaining * 1_000_000_000))
                        }

                        if let (task, comments, activities) = result {
                            viewModel.applyTask(task, comments: comments, activities: activities)
                        }
                        HapticManager.notification(result == nil || sync?.errors.isEmpty == false ? .error : .success)
                        continuation.resume()
                    }
                }
            }
            .safeAreaBar(edge: .bottom) {
                FloatingComposer(
                    text: $viewModel.replyBody,
                    placeholder: composerPlaceholder,
                    disabled: viewModel.task == nil || (editingMode != .none && isOfflineReadOnly),
                    submitting: viewModel.isSubmittingReply,
                    notice: composerNotice,
                    onDismissNotice: {
                        editingMode = .none
                        viewModel.replyBody = ""
                    },
                    onAttachImage: imageAttachment.presentImagePicker,
                    isUploadingImage: imageAttachment.isUploading,
                    onExpand: {
                        scrollActions.composerDidExpand()
                    },
                    onSubmit: {
                        switch editingMode {
                        case .title:
                            Task {
                                guard await viewModel.updateTask(title: viewModel.replyBody) else { return }
                                editingMode = .none
                                viewModel.replyBody = ""
                            }
                        case .body:
                            Task {
                                guard await viewModel.updateTask(bodyMd: viewModel.replyBody) else { return }
                                editingMode = .none
                                viewModel.replyBody = ""
                            }
                        case .comment(let commentId):
                            Task {
                                guard await viewModel.updateComment(commentId, bodyMd: viewModel.replyBody) else { return }
                                editingMode = .none
                                viewModel.replyBody = ""
                            }
                        case .none:
                            Task {
                                if await viewModel.addComment() {
                                    scrollActions.submissionDidComplete()
                                }
                            }
                        }
                    }
                )
                .padding(.horizontal, 16)
                .padding(.bottom, 10)
            }
        }
        } // GeometryReader
        .enableSwipeBack()
        .navigationBarBackButtonHidden(true)
        .toolbar {
            AppToolbar(
                title: toolbarTitle,
                showsPending: delivery.hasPending,
                onMenuTap: onMenuTap,
                titleLineLimit: 1,
                trailing: {
                    Button(action: {
                        HapticManager.impact(.light)
                        linkedIssueNavigation.present()
                    }) {
                        Image(systemName: "ellipsis")
                            .font(.system(size: 17, weight: .medium))
                            .foregroundColor(.textPrimary)
                    }
                }
            )
        }
        .alert("Could not complete the action", isPresented: Binding(
            get: { viewModel.error != nil },
            set: { if !$0 { viewModel.error = nil } }
        )) { Button("OK") { viewModel.error = nil } } message: { Text(viewModel.error ?? "") }
        .navigationBarTitleDisplayMode(.inline)
        .sheet(
            isPresented: $linkedIssueNavigation.isPresented,
            onDismiss: {
                linkedIssueNavigation.performPending { target in
                    onNavigateToLinkedIssue?(target.id, target.type, target.title)
                }
                if let target = pendingConversion {
                    pendingConversion = nil
                    conversionConfirmation = ConfirmationRequest(
                        title: target == "article" ? "Archive to Article?" : "Transfer to Memo?",
                        message: target == "article"
                            ? "Copy this task and its comments to a new article? The original task will remain unchanged. The article and copied comments will use the current date and time."
                            : "Change this task itself into a memo? It will no longer appear as a task. Original dates, comments, and relationships will be kept. Task status and scheduling will be removed.",
                        confirmLabel: target == "article" ? "Archive to Article" : "Transfer to Memo",
                        onConfirm: { performConversion(target) }
                    )
                }
                if beginNewTaskAfterInfoDismiss {
                    beginNewTaskAfterInfoDismiss = false
                    newTaskCreation.beginChoosing()
                }
            }
        ) {
            IssueInfoSheet(
                viewModel: viewModel,
                showCopiedFeedback: $showCopiedFeedback,
                bookmarkProvider: viewModel,
                linkProvider: viewModel,
                copyProvider: viewModel,
                jsonCopyProvider: viewModel,
                isReadOnly: isOfflineReadOnly || viewModel.isConverting,
                onEditTitle: {
                    if let task = viewModel.task {
                        viewModel.replyBody = task.title
                        editingMode = .title
                    }
                },
                onDelete: { showDeleteConfirm = true },
                onNewTask: {
                    beginNewTaskAfterInfoDismiss = true
                },
                onAddChild: {
                    if let task = viewModel.task {
                        createTaskMode = CreateTaskMode(kind: .quickChild(
                            parentTask: task,
                            parentProjects: viewModel.associatedProjects,
                            parentLabels: task.labels
                        ))
                    }
                },
                onArchiveToArticle: { pendingConversion = "article" },
                onTransferToMemo: { pendingConversion = "memo" },
                onNavigateToIssue: { target in
                    linkedIssueNavigation.requestAfterDismiss(target)
                },
                labelCountKeyPath: \.taskCount
            )
            .presentationDetents([.fraction(0.7), .large])
        }
        .sheet(isPresented: $showStatusPicker) {
            statusPickerSheet
                .presentationDetents([.medium])
        }
        .sheet(
            isPresented: $newTaskCreation.isChooserPresented,
            onDismiss: newTaskCreation.chooserDidDismiss
        ) {
            TemplateChooserSheet(
                target: .task,
                onSelect: { initialValues in
                    newTaskCreation.choose(.linkedTo(
                        sourceTaskId: taskId,
                        initialValues: initialValues
                    ))
                },
                onDismiss: newTaskCreation.cancelChooser
            )
            .presentationDetents([.medium, .large])
        }
        .sheet(item: $newTaskCreation.activeRequest) { request in
            CreateTaskModal(
                mode: request.payload,
                onCreated: { _ in
                    Task { await viewModel.loadTask() }
                },
                onDismiss: newTaskCreation.dismissForm
            )
            .presentationDetents([.large])
        }
        .sheet(item: $createTaskMode) { mode in
            CreateTaskModal(
                mode: mode.kind,
                onCreated: { _ in
                    Task { await viewModel.loadTask() }
                },
                onDismiss: { createTaskMode = nil }
            )
            .presentationDetents([.large])
        }
        .confirmationModal($conversionConfirmation)
        .alert("Delete Task", isPresented: $showDeleteConfirm) {
            Button("Cancel", role: .cancel) {}
            Button("Delete", role: .destructive) {
                Task {
                    if await viewModel.deleteTask() {
                        dismiss()
                    }
                }
            }
        } message: {
            Text("Are you sure you want to delete this task? This action cannot be undone.")
        }
        .imageAttachmentPresentation(coordinator: imageAttachment, text: $viewModel.replyBody)
        .overlay {
            LoadingOverlay(
                isPresented: viewModel.isLoading && viewModel.task == nil,
                message: "Loading..."
            )
        }
        .observeThread(id: taskId) { snapshot in
            delivery = snapshot
            viewModel.comments = snapshot.comments
        }
        .task {
            viewModel.taskStore = taskStore
            viewModel.dataSources = dataSources
            await viewModel.loadTask()
        }
    }

    private func performConversion(_ target: String) {
        guard !isOfflineReadOnly else { return }
        Task {
            if target == "article", let id = await viewModel.archiveToArticle() {
                articleStore.needsReload = true
                onNavigateToLinkedIssue?(id, "article", viewModel.task?.title ?? "Article")
            } else if target == "memo", let id = await viewModel.transferToMemo() {
                memoStore.needsReload = true
                onTransferredToMemo?(id)
            }
        }
    }

    // MARK: - Toolbar title

    private var toolbarTitle: String {
        // Negative ids are device-local rows with no server identity — not a
        // number to surface.
        let title = viewModel.task?.title ?? initialTitle.flatMap { $0.isEmpty ? nil : $0 } ?? (taskId > 0 ? "#\(taskId)" : "Task")
        return title
    }

    // MARK: - Composer helpers

    private var composerPlaceholder: String {
        switch editingMode {
        case .title: return "Edit title..."
        case .body: return "Edit body..."
        case .comment: return "Edit..."
        case .none: return "Add a comment..."
        }
    }

    private var composerNotice: String? {
        switch editingMode {
        case .title: return "Editing title"
        case .body: return "Editing body"
        case .comment: return "Editing comment"
        case .none: return nil
        }
    }

    // MARK: - Status Picker Sheet

    private var statusPickerSheet: some View {
        let statuses: [TaskStatusFilter] = [
            .inbox, .open, .next, .waiting, .scheduled, .someday, .done, .canceled,
        ]

        return SingleChoiceFilterSheet(
            title: "Status",
            options: statuses,
            selected: TaskStatusFilter(rawValue: viewModel.task?.status ?? "") ?? .inbox,
            label: { $0.displayLabel },
            onSelect: { status in
                Task { await viewModel.updateTask(status: status.rawValue) }
                showStatusPicker = false
            },
            onDismiss: { showStatusPicker = false }
        )
    }
}

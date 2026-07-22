import SwiftUI

struct TaskDetailView: View {
    let taskId: Int
    let initialTitle: String?
    let onMenuTap: () -> Void
    var onNavigateToLinkedIssue: ((Int, String, String) -> Void)?

    @EnvironmentObject var taskStore: TaskStore
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

    init(taskId: Int, initialTitle: String? = nil, onMenuTap: @escaping () -> Void, onNavigateToLinkedIssue: ((Int, String, String) -> Void)? = nil) {
        self.taskId = taskId
        self.initialTitle = initialTitle
        self.onMenuTap = onMenuTap
        self.onNavigateToLinkedIssue = onNavigateToLinkedIssue
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
                                isReadOnly: isOfflineReadOnly,
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
                        IssueTimeline(
                            entries: viewModel.timelineEntries,
                            issueId: taskId,
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
            .scrollEdgeEffectStyle(.soft, for: .bottom)
            .refreshable {
                await withCheckedContinuation { continuation in
                    Task { @MainActor in
                        HapticManager.impact(.medium)

                        let start = Date()
                        let result = await viewModel.fetchTask()

                        let elapsed = Date().timeIntervalSince(start)
                        let remaining = 0.75 - elapsed
                        if remaining > 0 {
                            try? await Task.sleep(nanoseconds: UInt64(remaining * 1_000_000_000))
                        }

                        if let (task, comments, activities) = result {
                            viewModel.applyTask(task, comments: comments, activities: activities)
                        }
                        HapticManager.notification(.success)
                        continuation.resume()
                    }
                }
            }
            .safeAreaBar(edge: .bottom) {
                FloatingComposer(
                    text: $viewModel.replyBody,
                    placeholder: composerPlaceholder,
                    disabled: viewModel.isLoading || isOfflineReadOnly,
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
                                await viewModel.updateTask(title: viewModel.replyBody)
                                editingMode = .none
                                viewModel.replyBody = ""
                            }
                        case .body:
                            Task {
                                await viewModel.updateTask(bodyMd: viewModel.replyBody)
                                editingMode = .none
                                viewModel.replyBody = ""
                            }
                        case .comment(let commentId):
                            Task {
                                await viewModel.updateComment(commentId, bodyMd: viewModel.replyBody)
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
                        linkedIssueNavigation.present()
                    }) {
                        Image(systemName: "ellipsis")
                            .font(.system(size: 17, weight: .medium))
                            .foregroundColor(.textPrimary)
                    }
                }
            )
        }
        .navigationBarTitleDisplayMode(.inline)
        .sheet(
            isPresented: $linkedIssueNavigation.isPresented,
            onDismiss: {
                linkedIssueNavigation.performPending { target in
                    onNavigateToLinkedIssue?(target.id, target.type, target.title)
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
                isReadOnly: isOfflineReadOnly,
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
        .task {
            viewModel.taskStore = taskStore
            viewModel.dataSources = dataSources
            await viewModel.loadTask()
        }
        } // GeometryReader
    }

    // MARK: - Toolbar title

    private var toolbarTitle: String {
        // Negative ids are device-local rows with no server identity — not a
        // number to surface.
        let title = viewModel.task?.title ?? initialTitle ?? (taskId > 0 ? "#\(taskId)" : "")
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

import SwiftUI

struct TaskDetailView: View {
    let taskId: Int
    let initialTitle: String?
    let onMenuTap: () -> Void

    @StateObject private var viewModel: TaskDetailViewModel
    @Environment(\.dismiss) private var dismiss
    @State private var showDeleteConfirm: Bool = false
    @State private var showInfoSheet: Bool = false
    @State private var showCopiedFeedback: Bool = false
    @State private var showStatusPicker: Bool = false
    @State private var editingMode: EditingMode = .none

    enum EditingMode: Equatable {
        case none
        case title
        case body
        case comment(Int)
    }

    init(taskId: Int, initialTitle: String? = nil, onMenuTap: @escaping () -> Void) {
        self.taskId = taskId
        self.initialTitle = initialTitle
        self.onMenuTap = onMenuTap
        self._viewModel = StateObject(wrappedValue: TaskDetailViewModel(taskId: taskId))
    }

    var body: some View {
        GeometryReader { geo in
        ScrollViewReader { proxy in
            ScrollView {
                LazyVStack(spacing: 0) {
                    if let task = viewModel.task {
                        // === Title Area (glass, extends to top of screen) ===
                        areaCard {
                            TaskTitleSection(
                                title: task.title,
                                status: task.status,
                                onStatusTap: { showStatusPicker = true }
                            )
                            .padding(.top, geo.safeAreaInsets.top)
                        }

                        // --- Connector line ---
                        sectionConnector

                        // === Body Area (glass, full width) ===
                        areaCard {
                            VStack(alignment: .leading, spacing: 0) {
                                // Timestamp
                                HStack(spacing: 4) {
                                    let isEdited = task.updatedAt != task.createdAt
                                    Text(TimelineHelpers.relativeTimeString(iso: isEdited ? task.updatedAt : task.createdAt))
                                    if isEdited {
                                        Text("(edited)")
                                    }
                                }
                                .font(.system(size: 11))
                                .foregroundColor(Color(.systemGray))
                                .padding(.horizontal, 16)
                                .padding(.top, 8)
                                .padding(.bottom, -2)

                                if !task.bodyMd.isEmpty {
                                    ThreadItem(
                                        bodyMd: task.bodyMd,
                                        labels: nil,
                                        onEdit: {
                                            viewModel.replyBody = task.bodyMd
                                            editingMode = .body
                                        },
                                        onDelete: nil,
                                        onCopy: {
                                            UIPasteboard.general.string = task.bodyMd
                                            HapticManager.notification(.success)
                                        }
                                    )
                                } else {
                                    HStack(alignment: .top, spacing: 4) {
                                        Text("No description provided.")
                                            .font(.system(size: 14))
                                            .foregroundColor(.textSecondary)
                                            .italic()
                                            .frame(maxWidth: .infinity, alignment: .leading)

                                        Menu {
                                            Button(action: {
                                                viewModel.replyBody = ""
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
                                    .padding(.vertical, 10)
                                    .padding(.horizontal, 16)
                                }
                            }
                        }

                        // === Each Comment = independent Area, connected by lines ===
                        ForEach(Array(viewModel.comments.enumerated()), id: \.element.id) { index, comment in
                            // Connector line before each comment
                            sectionConnector

                            // Each comment is its own glass area
                            areaCard {
                                VStack(alignment: .leading, spacing: 0) {
                                    // Timestamp inside the area
                                    HStack(spacing: 4) {
                                        let isEdited = comment.updatedAt != comment.createdAt
                                        Text(TimelineHelpers.relativeTimeString(iso: isEdited ? comment.updatedAt : comment.createdAt))
                                        if isEdited {
                                            Text("(edited)")
                                        }
                                    }
                                    .font(.system(size: 11))
                                    .foregroundColor(Color(.systemGray))
                                    .padding(.horizontal, 16)
                                    .padding(.top, 8)
                                    .padding(.bottom, -2)

                                    ThreadItem(
                                        bodyMd: comment.bodyMd,
                                        labels: nil,
                                        onEdit: {
                                            viewModel.replyBody = comment.bodyMd
                                            editingMode = .comment(comment.id)
                                        },
                                        onDelete: {
                                            Task { await viewModel.deleteComment(comment.id) }
                                        },
                                        onCopy: {
                                            UIPasteboard.general.string = comment.bodyMd
                                            HapticManager.notification(.success)
                                        }
                                    )
                                }
                            }
                        }
                    }

                    Color.clear.frame(height: 24)
                        .id("threadBottom")
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

                        if let (task, comments) = result {
                            viewModel.applyTask(task, comments: comments)
                        }
                        HapticManager.notification(.success)
                        continuation.resume()
                    }
                }
            }
            .onChange(of: viewModel.comments.count) { _ in
                withAnimation {
                    proxy.scrollTo("threadBottom", anchor: .bottom)
                }
            }
            .safeAreaBar(edge: .bottom) {
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
                            Task { await viewModel.addComment() }
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
            AppToolbar(title: toolbarTitle, onMenuTap: onMenuTap, titleLineLimit: 1) {
                Button(action: {
                    HapticManager.impact(.light)
                    showInfoSheet = true
                }) {
                    Image(systemName: "ellipsis")
                        .font(.system(size: 17, weight: .medium))
                        .foregroundColor(.textPrimary)
                }
            }
        }
        .navigationBarTitleDisplayMode(.inline)
        .sheet(isPresented: $showInfoSheet) {
            IssueInfoSheet(
                viewModel: viewModel,
                showCopiedFeedback: $showCopiedFeedback,
                onEditTitle: {
                    if let task = viewModel.task {
                        viewModel.replyBody = task.title
                        editingMode = .title
                    }
                },
                onDelete: { showDeleteConfirm = true },
                labelCountKeyPath: \.taskCount
            )
            .presentationDetents([.fraction(0.7), .large])
        }
        .sheet(isPresented: $showStatusPicker) {
            statusPickerSheet
                .presentationDetents([.medium])
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
        .overlay {
            if viewModel.isLoading && viewModel.task == nil {
                ProgressView("Loading...")
                    .foregroundColor(.textSecondary)
            }
        }
        .task {
            await viewModel.loadTask()
        }
        } // GeometryReader
    }

    // MARK: - Toolbar title

    private var toolbarTitle: String {
        let title = viewModel.task?.title ?? initialTitle ?? "#\(taskId)"
        return title
    }

    // MARK: - Area card (glass effect, full width, no rounded corners)

    private func areaCard<Content: View>(@ViewBuilder content: () -> Content) -> some View {
        content()
            .frame(maxWidth: .infinity)
            .glassEffect(.regular, in: Rectangle())
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

    // MARK: - Section connector (line between areas)

    private var sectionConnector: some View {
        Rectangle()
            .fill(Color(.systemGray3))
            .frame(width: 2, height: 12)
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.leading, 24)
    }

    // MARK: - Status Picker Sheet

    private var statusPickerSheet: some View {
        let statuses: [TaskStatusFilter] = [
            .inbox, .open, .next, .waiting, .scheduled, .someday, .done, .canceled,
        ]

        return VStack(spacing: 0) {
            HStack {
                Button(action: { showStatusPicker = false }) {
                    Image(systemName: "xmark.circle.fill")
                        .font(.system(size: 28))
                        .symbolRenderingMode(.hierarchical)
                        .foregroundColor(Color(.tertiaryLabel))
                }
                Spacer()
                Text("Status")
                    .font(.system(size: 17, weight: .semibold))
                Spacer()
                Image(systemName: "xmark.circle.fill")
                    .font(.system(size: 28))
                    .hidden()
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 12)

            Divider()

            ScrollView {
                VStack(alignment: .leading, spacing: 0) {
                    ForEach(statuses, id: \.self) { status in
                        let isSelected = viewModel.task?.status == status.rawValue
                        Button(action: {
                            HapticManager.selection()
                            Task {
                                await viewModel.updateTask(status: status.rawValue)
                            }
                            showStatusPicker = false
                        }) {
                            HStack {
                                Text(status.displayLabel)
                                    .font(.system(size: 16))
                                    .foregroundColor(.textPrimary)
                                Spacer()
                                if isSelected {
                                    Image(systemName: "checkmark.circle.fill")
                                        .font(.system(size: 22))
                                        .foregroundColor(.accent)
                                } else {
                                    Image(systemName: "circle")
                                        .font(.system(size: 22))
                                        .foregroundColor(Color(.systemGray3))
                                }
                            }
                            .padding(.horizontal, 16)
                            .padding(.vertical, 14)
                        }
                        Divider().padding(.leading, 16)
                    }
                }
            }
        }
        .background(Color(.systemBackground))
    }
}

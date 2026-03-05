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
        ScrollViewReader { proxy in
            ScrollView {
                LazyVStack(spacing: 0) {
                    if let task = viewModel.task {
                        // === Title Area ===
                        TaskTitleSection(
                            title: task.title,
                            status: task.status,
                            onEdit: {
                                viewModel.replyBody = task.title
                                editingMode = .title
                            }
                        )

                        // --- Gray connecting line ---
                        sectionConnector

                        // === Body Area ===
                        if !task.bodyMd.isEmpty {
                            ThreadItem(
                                bodyMd: task.bodyMd,
                                labels: task.labels,
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
                            // Empty body placeholder
                            HStack {
                                Text("No description provided.")
                                    .font(.system(size: 14))
                                    .foregroundColor(.textSecondary)
                                    .italic()
                                Spacer()
                            }
                            .padding(.vertical, 10)
                            .padding(.horizontal, 16)
                        }

                        // --- Gray connecting line ---
                        sectionConnector

                        // === Comments Area ===
                        let commentItems = buildCommentTimelineItems(comments: viewModel.comments)

                        ForEach(Array(commentItems.enumerated()), id: \.element.id) { index, item in
                            let previousItem = index > 0 ? commentItems[index - 1] : nil

                            let currentBucket = TimelineHelpers.getTimelineDateBucket(iso: item.createdAt)
                            let previousBucket = previousItem.map { TimelineHelpers.getTimelineDateBucket(iso: $0.createdAt) }
                            let bucketChanged = previousBucket == nil || currentBucket != previousBucket

                            if bucketChanged {
                                TimelineDateHeader(bucket: currentBucket)
                            }

                            let showTimestamp = bucketChanged || TimelineHelpers.shouldShowGapTimestamp(
                                previousIso: previousItem?.createdAt,
                                currentIso: item.createdAt
                            )

                            if showTimestamp {
                                TimelineTimestamp(text: TimelineHelpers.formatTimelineTime(iso: item.createdAt))
                            }

                            ThreadItem(
                                bodyMd: item.bodyMd,
                                labels: nil,
                                onEdit: {
                                    viewModel.replyBody = item.bodyMd
                                    editingMode = .comment(item.commentId)
                                },
                                onDelete: {
                                    Task { await viewModel.deleteComment(item.commentId) }
                                },
                                onCopy: {
                                    UIPasteboard.general.string = item.bodyMd
                                    HapticManager.notification(.success)
                                }
                            )
                        }
                    }

                    Color.clear.frame(height: 1)
                        .id("threadBottom")
                }
            }
            .scrollDismissesKeyboard(.immediately)
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
            AppToolbar(title: "#\(taskId)", onMenuTap: onMenuTap, titleLineLimit: 1) {
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
                onDelete: { showDeleteConfirm = true },
                labelCountKeyPath: \.taskCount
            )
            .presentationDetents([.fraction(0.7), .large])
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

    // MARK: - Section connector (gray line between areas)

    private var sectionConnector: some View {
        Rectangle()
            .fill(Color(.systemGray4))
            .frame(width: 1, height: 20)
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.leading, 24)
    }

    // MARK: - Build comment timeline items

    private func buildCommentTimelineItems(comments: [Comment]) -> [CommentTimelineItem] {
        comments.map { comment in
            CommentTimelineItem(
                id: "comment-\(comment.id)",
                bodyMd: comment.bodyMd,
                createdAt: comment.createdAt,
                commentId: comment.id
            )
        }
    }
}

// MARK: - Comment timeline item

private struct CommentTimelineItem: Identifiable {
    let id: String
    let bodyMd: String
    let createdAt: String
    let commentId: Int
}

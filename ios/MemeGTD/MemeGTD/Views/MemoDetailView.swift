import SwiftUI

struct MemoDetailView: View {
    let memoId: Int
    let initialBody: String?
    let onMenuTap: () -> Void

    @StateObject private var viewModel: MemoDetailViewModel
    @Environment(\.dismiss) private var dismiss
    @State private var showDeleteConfirm: Bool = false
    @State private var showInfoSheet: Bool = false
    @State private var showCopiedFeedback: Bool = false
    @State private var editingMemo: Bool = false
    @State private var editingCommentId: Int? = nil

    init(memoId: Int, initialBody: String? = nil, onMenuTap: @escaping () -> Void) {
        self.memoId = memoId
        self.initialBody = initialBody
        self.onMenuTap = onMenuTap
        self._viewModel = StateObject(wrappedValue: MemoDetailViewModel(memoId: memoId))
    }

    var body: some View {
        ScrollViewReader { proxy in
            ScrollView {
                LazyVStack(spacing: 0) {
                    if let memo = viewModel.memo {
                        let allItems = buildTimelineItems(memo: memo, comments: viewModel.comments)

                        ForEach(Array(allItems.enumerated()), id: \.element.id) { index, item in
                            let previousItem = index > 0 ? allItems[index - 1] : nil

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
                                    if item.isOriginal {
                                        editingMemo = true
                                        editingCommentId = nil
                                    } else {
                                        editingMemo = false
                                        editingCommentId = item.commentId
                                    }
                                },
                                onDelete: {
                                    if item.isOriginal {
                                        showDeleteConfirm = true
                                    } else {
                                        Task { await viewModel.deleteComment(item.commentId!) }
                                    }
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
                        // 1. トリガー到達ハプティクス
                        HapticManager.impact(.medium)

                        // データを裏で取得（UIには反映しない）
                        let start = Date()
                        let result = await viewModel.fetchMemo()

                        // 最低1秒スピナー表示
                        let elapsed = Date().timeIntervalSince(start)
                        let remaining = 0.75 - elapsed
                        if remaining > 0 {
                            try? await Task.sleep(nanoseconds: UInt64(remaining * 1_000_000_000))
                        }

                        // 2. データをUIに反映 + 完了ハプティクス
                        if let (memo, comments) = result {
                            viewModel.applyMemo(memo, comments: comments)
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
                HStack(alignment: .bottom, spacing: 10) {
                    Button(action: {
                        HapticManager.impact(.light)
                        showInfoSheet = true
                    }) {
                        Image(systemName: "info.circle")
                            .font(.system(size: 17, weight: .medium))
                            .foregroundColor(Color(.systemGray))
                            .frame(width: 52, height: 52)
                    }
                    .modifier(PillSurface(radius: 26))

                    FloatingComposer(
                        text: $viewModel.replyBody,
                        placeholder: (editingMemo || editingCommentId != nil) ? "Edit..." : "Add a comment...",
                        disabled: viewModel.isLoading,
                        submitting: viewModel.isSubmittingReply,
                        notice: editingMemo ? "Editing this memo" : editingCommentId != nil ? "Editing this comment" : nil,
                        onDismissNotice: {
                            editingMemo = false
                            editingCommentId = nil
                            viewModel.replyBody = ""
                        },
                        onSubmit: {
                            if editingMemo {
                                Task {
                                    await viewModel.updateMemo(bodyMd: viewModel.replyBody)
                                    editingMemo = false
                                    viewModel.replyBody = ""
                                }
                            } else if let commentId = editingCommentId {
                                Task {
                                    await viewModel.updateComment(commentId, bodyMd: viewModel.replyBody)
                                    editingCommentId = nil
                                    viewModel.replyBody = ""
                                }
                            } else {
                                Task { await viewModel.addComment() }
                            }
                        }
                    )
                }
                .padding(.horizontal, 16)
                .padding(.bottom, 10)
            }
        }
        .enableSwipeBack()
        .navigationBarBackButtonHidden(true)
        .toolbar {
            ToolbarItem(placement: .navigationBarLeading) {
                Button(action: onMenuTap) {
                    Image(systemName: "line.3.horizontal")
                        .font(.system(size: 18, weight: .medium))
                        .foregroundColor(.textPrimary)
                }
            }

            ToolbarItem(placement: .principal) {
                Text(memoTitlePreview)
                    .font(.headline)
                    .lineLimit(1)
                    .truncationMode(.tail)
            }

            ToolbarItem(placement: .navigationBarTrailing) {
                Button(action: {
                    Task { await viewModel.toggleBookmark() }
                }) {
                    Image(systemName: viewModel.memo?.isBookmarked == true ? "bookmark.fill" : "bookmark")
                        .foregroundColor(viewModel.memo?.isBookmarked == true ? .accent : .textSecondary)
                }
                .disabled(viewModel.isBookmarking)
            }
        }
        .navigationBarTitleDisplayMode(.inline)
        .sheet(isPresented: $showInfoSheet) {
            MemoInfoSheet(
                viewModel: viewModel,
                showCopiedFeedback: $showCopiedFeedback
            )
            .presentationDetents([.medium])
        }
        .alert("Delete Memo", isPresented: $showDeleteConfirm) {
            Button("Cancel", role: .cancel) {}
            Button("Delete", role: .destructive) {
                Task {
                    if await viewModel.deleteMemo() {
                        dismiss()
                    }
                }
            }
        } message: {
            Text("Are you sure you want to delete this memo? This action cannot be undone.")
        }
        .overlay {
            if viewModel.isLoading && viewModel.memo == nil {
                ProgressView("Loading...")
                    .foregroundColor(.textSecondary)
            }
        }
        .task {
            await viewModel.loadMemo()
        }
    }

    // MARK: - Title preview

    private var memoTitlePreview: String {
        let body = viewModel.memo?.bodyMd ?? initialBody
        guard let body else { return "Memo" }
        guard let firstLine = body
            .components(separatedBy: "\n")
            .first(where: { !$0.trimmingCharacters(in: .whitespaces).isEmpty })
        else { return "Memo" }
        // Strip markdown heading prefix (e.g. "## Title" -> "Title")
        let stripped = firstLine.replacingOccurrences(
            of: #"^#{1,6}\s+"#, with: "", options: .regularExpression
        )
        return stripped.isEmpty ? "Memo" : stripped
    }

    // MARK: - Build unified timeline items

    private func buildTimelineItems(memo: Memo, comments: [Comment]) -> [ThreadTimelineItem] {
        var items: [ThreadTimelineItem] = []

        items.append(ThreadTimelineItem(
            id: "memo-\(memo.id)",
            bodyMd: memo.bodyMd,
            createdAt: memo.createdAt,
            labels: memo.labels,
            isOriginal: true,
            commentId: nil
        ))

        for comment in comments {
            items.append(ThreadTimelineItem(
                id: "comment-\(comment.id)",
                bodyMd: comment.bodyMd,
                createdAt: comment.createdAt,
                labels: nil,
                isOriginal: false,
                commentId: comment.id
            ))
        }

        return items
    }
}

// MARK: - Thread timeline item

private struct ThreadTimelineItem: Identifiable {
    let id: String
    let bodyMd: String
    let createdAt: String
    let labels: [String]?
    let isOriginal: Bool
    let commentId: Int?
}

// MARK: - Info sheet (GitHub Issue style)

private struct MemoInfoSheet: View {
    @ObservedObject var viewModel: MemoDetailViewModel
    @Binding var showCopiedFeedback: Bool
    @Environment(\.dismiss) private var dismiss

    @State private var showLabelPicker = false
    @State private var showProjectPicker = false
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
                // Labels
                Button(action: {
                    selectedLabelNames = Set(viewModel.memo?.labels ?? [])
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

                        if let labels = viewModel.memo?.labels, !labels.isEmpty {
                            FlowLayout(spacing: 6) {
                                ForEach(labels, id: \.self) { name in
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
            }

            Spacer()
        }
        .background(Color(.systemBackground))
        .sheet(isPresented: $showLabelPicker) {
            LabelPickerModal(
                allLabels: viewModel.allLabels,
                selectedNames: $selectedLabelNames,
                onDismiss: { showLabelPicker = false },
                onConfirm: { names in
                    viewModel.confirmLabels(names)
                    showLabelPicker = false
                }
            )
            .presentationDetents([.medium, .large])
        }
        .sheet(isPresented: $showProjectPicker) {
            ProjectPickerModal(
                allProjects: viewModel.allProjects,
                selectedIds: $selectedProjectIds,
                onDismiss: { showProjectPicker = false },
                onConfirm: { ids in
                    viewModel.confirmProjects(ids)
                    showProjectPicker = false
                }
            )
            .presentationDetents([.medium, .large])
        }
    }
}

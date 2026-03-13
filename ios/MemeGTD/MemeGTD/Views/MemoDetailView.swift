import SwiftUI

struct MemoDetailView: View {
    let memoId: Int
    let initialBody: String?
    let onMenuTap: () -> Void

    @EnvironmentObject var memoStore: MemoStore
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
                .padding(.horizontal, 16)
                .padding(.bottom, 10)
            }
        }
        .enableSwipeBack()
        .navigationBarBackButtonHidden(true)
        .toolbar {
            AppToolbar(title: memoTitlePreview, onMenuTap: onMenuTap, titleLineLimit: 1) {
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
                showCopiedFeedback: $showCopiedFeedback
            )
            .presentationDetents([.fraction(0.6), .large])
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
            viewModel.memoStore = memoStore
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


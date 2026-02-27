import SwiftUI

struct MemoDetailView: View {
    let memoId: Int
    let onMenuTap: () -> Void

    @StateObject private var viewModel: MemoDetailViewModel
    @Environment(\.dismiss) private var dismiss
    @State private var showDeleteConfirm: Bool = false

    init(memoId: Int, onMenuTap: @escaping () -> Void) {
        self.memoId = memoId
        self.onMenuTap = onMenuTap
        self._viewModel = StateObject(wrappedValue: MemoDetailViewModel(memoId: memoId))
    }

    var body: some View {
        ZStack(alignment: .bottom) {
            // Content layer
            ScrollViewReader { proxy in
                ScrollView {
                    LazyVStack(spacing: 0) {
                        if let memo = viewModel.memo {
                            // Original memo
                            ThreadItem(
                                bodyMd: memo.bodyMd,
                                createdAt: memo.createdAt,
                                showGapTimestamp: false,
                                gapTimestampText: "",
                                isOriginalMemo: true,
                                onDelete: {
                                    showDeleteConfirm = true
                                },
                                onCopy: {
                                    UIPasteboard.general.string = memo.bodyMd
                                    HapticManager.notification(.success)
                                }
                            )

                            // Labels
                            if let labels = memo.labels, !labels.isEmpty {
                                HStack(spacing: 6) {
                                    ForEach(labels, id: \.self) { label in
                                        Text(label)
                                            .font(.caption)
                                            .padding(.horizontal, 8)
                                            .padding(.vertical, 4)
                                            .background(Color.accent.opacity(0.1))
                                            .foregroundColor(.accent)
                                            .cornerRadius(6)
                                    }
                                    Spacer()
                                }
                                .padding(.horizontal, 16)
                                .padding(.bottom, 8)
                            }

                            Divider()

                            // Comments
                            ForEach(Array(viewModel.comments.enumerated()), id: \.element.id) { index, comment in
                                let previousIso: String? = {
                                    if index == 0 { return memo.createdAt }
                                    return viewModel.comments[index - 1].createdAt
                                }()

                                let showGap = TimelineHelpers.shouldShowGapTimestamp(
                                    previousIso: previousIso,
                                    currentIso: comment.createdAt
                                )

                                ThreadItem(
                                    bodyMd: comment.bodyMd,
                                    createdAt: comment.createdAt,
                                    showGapTimestamp: showGap,
                                    gapTimestampText: TimelineHelpers.formatTimelineTime(iso: comment.createdAt),
                                    onDelete: {
                                        Task { await viewModel.deleteComment(comment.id) }
                                    },
                                    onCopy: {
                                        UIPasteboard.general.string = comment.bodyMd
                                        HapticManager.notification(.success)
                                    }
                                )

                                if index < viewModel.comments.count - 1 {
                                    Divider()
                                        .padding(.leading, 16)
                                }
                            }
                        }

                        // Bottom spacer for composer
                        Color.clear.frame(height: 80)
                            .id("threadBottom")
                    }
                }
                .onChange(of: viewModel.comments.count) { _ in
                    withAnimation {
                        proxy.scrollTo("threadBottom", anchor: .bottom)
                    }
                }
            }

            // Overlay layer: Reply composer
            FloatingComposer(
                text: $viewModel.replyBody,
                placeholder: "Add a comment...",
                disabled: viewModel.isLoading,
                submitting: viewModel.isSubmittingReply,
                onSubmit: {
                    Task { await viewModel.addComment() }
                }
            )
        }
        .background(Color(.systemBackground))
        .toolbar {
            ToolbarItem(placement: .navigationBarLeading) {
                Button(action: onMenuTap) {
                    Image(systemName: "line.3.horizontal")
                        .font(.system(size: 18, weight: .medium))
                        .foregroundColor(.textPrimary)
                }
            }

            ToolbarItem(placement: .principal) {
                Text("#\(memoId)")
                    .font(.headline)
                    .foregroundColor(.textSecondary)
            }

            ToolbarItem(placement: .navigationBarTrailing) {
                HStack(spacing: 16) {
                    // Bookmark button
                    Button(action: {
                        Task { await viewModel.toggleBookmark() }
                    }) {
                        Image(systemName: viewModel.memo?.isBookmarked == true ? "bookmark.fill" : "bookmark")
                            .foregroundColor(viewModel.memo?.isBookmarked == true ? .accent : .textSecondary)
                    }
                    .disabled(viewModel.isBookmarking)
                }
            }
        }
        .navigationBarTitleDisplayMode(.inline)
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
}

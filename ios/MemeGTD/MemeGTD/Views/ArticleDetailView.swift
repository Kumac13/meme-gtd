import SwiftUI

struct ArticleDetailView: View {
    let articleId: Int
    let initialTitle: String?
    let onMenuTap: () -> Void
    var onNavigateToLinkedIssue: ((Int, String, String) -> Void)?

    @EnvironmentObject var articleStore: ArticleStore
    @StateObject private var viewModel: ArticleDetailViewModel
    @Environment(\.dismiss) private var dismiss
    @Environment(\.openURL) private var openURL
    @State private var showDeleteConfirm: Bool = false
    @State private var showInfoSheet: Bool = false
    @State private var showCopiedFeedback: Bool = false
    @State private var editingCommentId: Int? = nil

    init(articleId: Int, initialTitle: String? = nil, onMenuTap: @escaping () -> Void, onNavigateToLinkedIssue: ((Int, String, String) -> Void)? = nil) {
        self.articleId = articleId
        self.initialTitle = initialTitle
        self.onMenuTap = onMenuTap
        self.onNavigateToLinkedIssue = onNavigateToLinkedIssue
        self._viewModel = StateObject(wrappedValue: ArticleDetailViewModel(articleId: articleId))
    }

    var body: some View {
        ScrollViewReader { proxy in
            ScrollView {
                LazyVStack(alignment: .leading, spacing: 0) {
                    if let article = viewModel.article {
                        // Article header
                        VStack(alignment: .leading, spacing: 12) {
                            Text(article.title)
                                .font(.system(size: 22, weight: .bold))
                                .foregroundColor(.textPrimary)

                            HStack(spacing: 12) {
                                if let url = URL(string: article.meta.originalUrl) {
                                    Button(action: { openURL(url) }) {
                                        HStack(spacing: 4) {
                                            Image(systemName: "safari")
                                            Text(article.meta.siteName ?? url.host ?? "Source")
                                            Image(systemName: "arrow.up.right")
                                                .font(.system(size: 10))
                                        }
                                        .font(.system(size: 13))
                                        .foregroundColor(.accent)
                                    }
                                }

                                Text(TimelineHelpers.relativeTimeString(iso: article.createdAt))
                                    .font(.system(size: 12))
                                    .foregroundColor(.textSecondary)
                            }
                        }
                        .padding(.horizontal, 16)
                        .padding(.vertical, 16)

                        Divider()
                            .padding(.horizontal, 16)

                        // Article body
                        MarkdownBody(article.bodyMd)
                            .padding(.horizontal, 16)
                            .padding(.vertical, 16)

                        // Comments section
                        if !viewModel.comments.isEmpty {
                            Divider()
                                .padding(.horizontal, 16)

                            ForEach(Array(viewModel.comments.enumerated()), id: \.element.id) { index, comment in
                                let previousComment = index > 0 ? viewModel.comments[index - 1] : nil

                                let currentBucket = TimelineHelpers.getTimelineDateBucket(iso: comment.createdAt)
                                let previousBucket = previousComment.map { TimelineHelpers.getTimelineDateBucket(iso: $0.createdAt) }
                                let bucketChanged = previousBucket == nil || currentBucket != previousBucket

                                if bucketChanged {
                                    TimelineDateHeader(bucket: currentBucket)
                                }

                                let showTimestamp = bucketChanged || TimelineHelpers.shouldShowGapTimestamp(
                                    previousIso: previousComment?.createdAt,
                                    currentIso: comment.createdAt
                                )

                                if showTimestamp {
                                    TimelineTimestamp(text: TimelineHelpers.formatTimelineTime(iso: comment.createdAt))
                                }

                                ThreadItem(
                                    bodyMd: comment.bodyMd,
                                    labels: nil,
                                    onEdit: {
                                        viewModel.replyBody = comment.bodyMd
                                        editingCommentId = comment.id
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
                        let result = await viewModel.fetchArticle()

                        let elapsed = Date().timeIntervalSince(start)
                        let remaining = 0.75 - elapsed
                        if remaining > 0 {
                            try? await Task.sleep(nanoseconds: UInt64(remaining * 1_000_000_000))
                        }

                        if let (article, comments) = result {
                            viewModel.applyArticle(article, comments: comments)
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
                    placeholder: editingCommentId != nil ? "Edit..." : "Add a comment...",
                    disabled: viewModel.isLoading,
                    submitting: viewModel.isSubmittingReply,
                    notice: editingCommentId != nil ? "Editing this comment" : nil,
                    onDismissNotice: {
                        editingCommentId = nil
                        viewModel.replyBody = ""
                    },
                    onSubmit: {
                        if let commentId = editingCommentId {
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
            AppToolbar(title: viewModel.article?.title ?? initialTitle ?? "Article", onMenuTap: onMenuTap, titleLineLimit: 1) {
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
                onDelete: {
                    showInfoSheet = false
                    showDeleteConfirm = true
                },
                onNavigateToIssue: { target in
                    onNavigateToLinkedIssue?(target.id, target.type, target.title)
                },
                labelCountKeyPath: \.articleCount
            )
            .presentationDetents([.fraction(0.6), .large])
        }
        .alert("Delete Article", isPresented: $showDeleteConfirm) {
            Button("Cancel", role: .cancel) {}
            Button("Delete", role: .destructive) {
                Task {
                    if await viewModel.deleteArticle() {
                        dismiss()
                    }
                }
            }
        } message: {
            Text("Are you sure you want to delete this article? This action cannot be undone.")
        }
        .overlay {
            if viewModel.isLoading && viewModel.article == nil {
                ProgressView("Loading...")
                    .foregroundColor(.textSecondary)
            }
        }
        .task {
            viewModel.articleStore = articleStore
            await viewModel.loadArticle()
        }
    }
}

import SwiftUI

struct ArticleDetailView: View {
    let articleId: Int
    let initialTitle: String?
    let onMenuTap: () -> Void
    var onNavigateToLinkedIssue: ((Int, String, String) -> Void)?

    @EnvironmentObject var articleStore: ArticleStore
    @EnvironmentObject var dataSources: DataSourceProvider
    @StateObject private var viewModel: ArticleDetailViewModel
    @Environment(\.dismiss) private var dismiss
    @Environment(\.openURL) private var openURL
    @State private var showDeleteConfirm: Bool = false
    @StateObject private var linkedIssueNavigation = DeferredSheetActionCoordinator<TargetIssue>()
    @State private var showCopiedFeedback: Bool = false
    @State private var editingMode: EditingMode = .none
    @StateObject private var imageAttachment = ImageAttachmentCoordinator()
    @ObservedObject private var connectivity = ConnectivityMonitor.shared

    /// Server mode + Offline Sync ON + offline: the article is served from
    /// the local read cache and cannot be edited (offline support plan
    /// Phase 7). Never true in Standalone.
    private var isOfflineReadOnly: Bool {
        connectivity.isOfflineReadOnly
    }

    enum EditingMode: Equatable {
        case none
        case title
        case body
        case comment(Int)
    }

    init(articleId: Int, initialTitle: String? = nil, onMenuTap: @escaping () -> Void, onNavigateToLinkedIssue: ((Int, String, String) -> Void)? = nil) {
        self.articleId = articleId
        self.initialTitle = initialTitle
        self.onMenuTap = onMenuTap
        self.onNavigateToLinkedIssue = onNavigateToLinkedIssue
        self._viewModel = StateObject(wrappedValue: ArticleDetailViewModel(articleId: articleId))
    }

    var body: some View {
        GeometryReader { geo in
        IssueDetailScrollShell(
            policy: IssueDetailScrollPolicy(initialPosition: .top),
            isContentReady: viewModel.article != nil
        ) { scrollActions in
            ScrollView {
                LazyVStack(spacing: 0) {
                    if let article = viewModel.article {
                        // === Header Area (glass card): Title + Meta ===
                        IssueAreaCard {
                            VStack(alignment: .leading, spacing: 8) {
                                Text(article.title)
                                    .font(.system(size: 18, weight: .semibold))
                                    .foregroundColor(.textPrimary)
                                    .frame(maxWidth: .infinity, alignment: .leading)

                                // Meta info row
                                HStack(spacing: 8) {
                                    if let siteName = siteDisplayName(for: article) {
                                        Text(siteName)
                                            .font(.system(size: 12))
                                            .foregroundColor(.textSecondary)
                                    }

                                    Text("Saved \(TimelineHelpers.relativeTimeString(iso: article.createdAt))")
                                        .font(.system(size: 12))
                                        .foregroundColor(Color(.systemGray))

                                    Spacer()

                                    if let originalUrl = article.meta?.originalUrl,
                                       !originalUrl.isEmpty,
                                       let url = URL(string: originalUrl) {
                                        Button(action: { openURL(url) }) {
                                            HStack(spacing: 3) {
                                                Image(systemName: "safari")
                                                    .font(.system(size: 12))
                                                Text("Open")
                                                    .font(.system(size: 12))
                                            }
                                            .foregroundColor(.accent)
                                        }
                                    }
                                }

                                if isOfflineReadOnly {
                                    OfflineReadOnlyBadge()
                                }

                                // Labels
                                if let labels = article.labels, !labels.isEmpty {
                                    FlowLayout(spacing: 6) {
                                        ForEach(labels, id: \.self) { name in
                                            Text(name)
                                                .font(.system(size: 11, weight: .medium))
                                                .padding(.horizontal, 8)
                                                .padding(.vertical, 3)
                                                .background(LabelColorHelper.bgColor(for: name))
                                                .foregroundColor(LabelColorHelper.textColor(for: name))
                                                .clipShape(Capsule())
                                        }
                                    }
                                }
                            }
                            .padding(.horizontal, 16)
                            .padding(.top, geo.safeAreaInsets.top + 8)
                            .padding(.bottom, 12)
                        }

                        IssueSectionConnector()

                        // === Body Area (same card/menu structure as Task Details) ===
                        let displayBody = article.bodyMd.replacingOccurrences(
                            of: "\\{#block-\\d+\\}",
                            with: "",
                            options: .regularExpression
                        )
                        IssueContentCard(
                            bodyMd: displayBody,
                            createdAt: article.createdAt,
                            updatedAt: article.updatedAt,
                            emptyText: "No content available.",
                            copyText: article.bodyMd,
                            mutationsDisabled: isOfflineReadOnly,
                            onEdit: article.origin == .manual ? {
                                viewModel.replyBody = article.bodyMd
                                editingMode = .body
                            } : nil,
                            onIssueTap: { id, type in
                                onNavigateToLinkedIssue?(id, type, "")
                            }
                        )

                        // === Timeline: Comments + activities interleaved ===
                        IssueTimeline(
                            entries: viewModel.timelineEntries,
                            issueId: articleId,
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
                        let result = await viewModel.fetchArticle()

                        let elapsed = Date().timeIntervalSince(start)
                        let remaining = 0.75 - elapsed
                        if remaining > 0 {
                            try? await Task.sleep(nanoseconds: UInt64(remaining * 1_000_000_000))
                        }

                        if let (article, comments, activities) = result {
                            viewModel.applyArticle(article, comments: comments, activities: activities)
                        }
                        HapticManager.notification(.success)
                        continuation.resume()
                    }
                }
            }
            .safeAreaBar(edge: .bottom) {
                FloatingComposer(
                    text: $viewModel.replyBody,
                    placeholder: editingMode == .none ? "Add a comment..." : "Edit...",
                    disabled: viewModel.isLoading || isOfflineReadOnly,
                    submitting: viewModel.isSubmittingReply,
                    notice: editingMode == .none ? nil : "Editing",
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
                            Task { await viewModel.updateArticle(title: viewModel.replyBody); editingMode = .none; viewModel.replyBody = "" }
                        case .body:
                            Task { await viewModel.updateArticle(bodyMd: viewModel.replyBody); editingMode = .none; viewModel.replyBody = "" }
                        case .comment(let id):
                            Task { await viewModel.updateComment(id, bodyMd: viewModel.replyBody); editingMode = .none; viewModel.replyBody = "" }
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
            }
        ) {
            IssueInfoSheet(
                viewModel: viewModel,
                showCopiedFeedback: $showCopiedFeedback,
                bookmarkProvider: viewModel,
                linkProvider: viewModel,
                copyProvider: viewModel,
                isReadOnly: isOfflineReadOnly,
                onEditTitle: editTitleAction,
                onDelete: { showDeleteConfirm = true },
                onNavigateToIssue: { target in
                    linkedIssueNavigation.requestAfterDismiss(target)
                },
                labelCountKeyPath: \.articleCount
            )
            .presentationDetents([.fraction(0.7), .large])
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
        .imageAttachmentPresentation(coordinator: imageAttachment, text: $viewModel.replyBody)
        .overlay {
            LoadingOverlay(
                isPresented: viewModel.isLoading && viewModel.article == nil,
                message: "Loading..."
            )
        }
        .task {
            viewModel.articleStore = articleStore
            viewModel.dataSources = dataSources
            await viewModel.loadArticle()
        }
    }

    // MARK: - Toolbar title

    private var toolbarTitle: String {
        // Negative ids are device-local rows with no server identity — not a
        // number to surface.
        viewModel.article?.title ?? initialTitle ?? (articleId > 0 ? "#\(articleId)" : "")
    }

    private var editTitleAction: (() -> Void)? {
        guard viewModel.article?.origin == .manual else { return nil }
        return {
            guard let article = viewModel.article else { return }
            viewModel.replyBody = article.title
            editingMode = .title
        }
    }

    // MARK: - Site display name

    private func siteDisplayName(for article: Article) -> String? {
        if let siteName = article.meta?.siteName, !siteName.isEmpty {
            return siteName
        }
        guard let url = URL(string: article.meta?.originalUrl ?? ""),
              let host = url.host else {
            return nil
        }
        return host.hasPrefix("www.") ? String(host.dropFirst(4)) : host
    }

}

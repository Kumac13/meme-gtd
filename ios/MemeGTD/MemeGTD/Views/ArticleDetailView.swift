import SwiftUI

struct ArticleDetailView: View {
    @State private var delivery = ThreadDelivery()
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
    @StateObject private var imageAttachment = ImageAttachmentCoordinator()
    @ObservedObject private var connectivity = ConnectivityMonitor.shared

    /// Server mode + Offline Sync ON + offline: the article is served from
    /// the local read cache and cannot be edited (offline support plan
    /// Phase 7). Never true in Standalone.
    private var isOfflineReadOnly: Bool {
        connectivity.isOfflineReadOnly || (Settings.shared.appMode == .server && delivery.serverID == nil)
    }

    init(articleId: Int, initialTitle: String? = nil, onMenuTap: @escaping () -> Void, onNavigateToLinkedIssue: ((Int, String, String) -> Void)? = nil) {
        self.articleId = articleId
        self.initialTitle = initialTitle
        self.onMenuTap = onMenuTap
        self.onNavigateToLinkedIssue = onNavigateToLinkedIssue
        self._viewModel = StateObject(wrappedValue: ArticleDetailViewModel(articleId: articleId))
    }

    private var isEditingOnlineOnly: Bool {
        switch viewModel.editingMode {
        case .none, .comment: false
        default: isOfflineReadOnly
        }
    }

    var body: some View {
        GeometryReader { geometry in
            detail(topInset: geometry.safeAreaInsets.top)
        }
    }

    private func detail(topInset: CGFloat) -> some View {
        IssueDetailScrollShell(
            policy: IssueDetailScrollPolicy(initialPosition: .top),
            isContentReady: viewModel.article != nil
        ) { scrollActions in
            ScrollView {
                LazyVStack(spacing: 0) {
                    if let article = viewModel.article {
                        // === Header Area (glass card): Title + Meta ===
                        IssueAreaCard(glassTopExtension: topInset) {
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
                            .padding(.top, 8)
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
                            pending: delivery.parentPending,
                            emptyText: "No content available.",
                            copyText: article.bodyMd,
                            mutationsDisabled: isOfflineReadOnly,
                            onEdit: article.origin == .manual ? {
                                viewModel.replyBody = article.bodyMd
                                viewModel.editingMode = .body
                            } : nil,
                            onIssueTap: { id, type in
                                onNavigateToLinkedIssue?(id, type, "")
                            }
                        )

                        // === Timeline: Comments + activities interleaved ===
                        if !delivery.historyAvailable {
                            Text("Earlier replies have not been downloaded.")
                                .font(.footnote).foregroundStyle(.secondary)
                        }
                        IssueTimeline(
                            entries: viewModel.timelineEntries,
                            issueId: viewModel.articleId,
                            pendingComments: delivery.pendingComments,
                            deletionDisabled: isOfflineReadOnly,
                            onEditComment: { comment in
                                viewModel.replyBody = comment.bodyMd
                                viewModel.editingMode = .comment(comment.id)
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
            .scrollEdgeEffectStyle(.soft, for: .vertical)
            .refreshable {
                await withCheckedContinuation { continuation in
                    Task { @MainActor in
                        HapticManager.impact(.medium)

                        let start = Date()
                        let sync = await dataSources.syncScheduler?.refresh()
                        let result = await viewModel.fetchArticle()

                        let elapsed = Date().timeIntervalSince(start)
                        let remaining = 0.75 - elapsed
                        if remaining > 0 {
                            try? await Task.sleep(nanoseconds: UInt64(remaining * 1_000_000_000))
                        }

                        if let (article, comments, activities) = result {
                            viewModel.applyArticle(article, comments: comments, activities: activities)
                        }
                        HapticManager.notification(result == nil || sync?.errors.isEmpty == false ? .error : .success)
                        continuation.resume()
                    }
                }
            }
            .safeAreaBar(edge: .bottom) {
                FloatingComposer(
                    text: $viewModel.replyBody,
                    placeholder: viewModel.editingMode == .none ? "Add a comment..." : "Edit...",
                    disabled: viewModel.article == nil || isEditingOnlineOnly,
                    submitting: viewModel.isSubmittingReply,
                    notice: viewModel.editingMode == .none ? nil : "Editing",
                    onDismissNotice: {
                        viewModel.editingMode = .none
                        viewModel.replyBody = ""
                    },
                    onAttachImage: imageAttachment.presentImagePicker,
                    isUploadingImage: imageAttachment.isUploading,
                    onExpand: {
                        scrollActions.composerDidExpand()
                    },
                    onSubmit: {
                        switch viewModel.editingMode {
                        case .title, .body, .comment:
                            Task { await viewModel.submitEdit() }
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
            }
        ) {
            IssueInfoSheet(
                viewModel: viewModel,
                showCopiedFeedback: $showCopiedFeedback,
                bookmarkProvider: viewModel,
                linkProvider: viewModel,
                copyProvider: viewModel,
                jsonCopyProvider: viewModel,
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
        .observeThread(id: articleId) { snapshot in
            if let resolved = snapshot.serverID { viewModel.resolvedID = resolved }
            delivery = snapshot
            viewModel.comments = snapshot.comments
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
        viewModel.article?.title ?? initialTitle.flatMap { $0.isEmpty ? nil : $0 } ?? (articleId > 0 ? "#\(articleId)" : "Article")
    }

    private var editTitleAction: (() -> Void)? {
        guard viewModel.article?.origin == .manual else { return nil }
        return {
            guard let article = viewModel.article else { return }
            viewModel.replyBody = article.title
            viewModel.editingMode = .title
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

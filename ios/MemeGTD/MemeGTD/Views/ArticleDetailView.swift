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
        ScrollViewReader { proxy in
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
                        IssueAreaCard {
                            VStack(alignment: .leading, spacing: 0) {
                                HStack {
                                    HStack(spacing: 4) {
                                        let isEdited = article.updatedAt != article.createdAt
                                        Text(TimelineHelpers.relativeTimeString(iso: isEdited ? article.updatedAt : article.createdAt))
                                        if isEdited {
                                            Text("(edited)")
                                        }
                                    }
                                    .font(.system(size: 11))
                                    .foregroundColor(Color(.systemGray))

                                    Spacer()

                                    Menu {
                                        Button(action: {
                                            UIPasteboard.general.string = article.bodyMd
                                            HapticManager.notification(.success)
                                        }) {
                                            Label("Copy", systemImage: "doc.on.doc")
                                        }
                                        if article.origin == .manual {
                                            Button(action: {
                                                viewModel.replyBody = article.bodyMd
                                                editingMode = .body
                                            }) {
                                                Label("Edit", systemImage: "pencil")
                                            }
                                            .disabled(isOfflineReadOnly)
                                        }
                                    } label: {
                                        Image(systemName: "ellipsis")
                                            .font(.system(size: 13))
                                            .foregroundColor(.textSecondary)
                                            .frame(width: 28, height: 20)
                                            .contentShape(Rectangle())
                                    }
                                }
                                .padding(.horizontal, 16)
                                .padding(.top, 8)
                                .padding(.bottom, -2)

                                if !article.bodyMd.isEmpty {
                                    let displayBody = article.bodyMd.replacingOccurrences(
                                        of: "\\{#block-\\d+\\}",
                                        with: "",
                                        options: .regularExpression
                                    )
                                    ThreadItem(
                                        bodyMd: displayBody,
                                        labels: nil,
                                        showMenu: false,
                                        onIssueTap: { id, type in
                                            onNavigateToLinkedIssue?(id, type, "")
                                        }
                                    )
                                } else {
                                    Text("No content available.")
                                        .font(.system(size: 14))
                                        .foregroundColor(.textSecondary)
                                        .italic()
                                        .frame(maxWidth: .infinity, alignment: .leading)
                                        .padding(.vertical, 10)
                                        .padding(.horizontal, 16)
                                }
                            }
                        }

                        // === Timeline: Comments + activities interleaved ===
                        if !viewModel.timelineEntries.isEmpty {
                            ForEach(viewModel.timelineEntries) { entry in
                                IssueSectionConnector()
                                switch entry {
                                case .activity(let activity):
                                    ActivityItemView(activity: activity, issueId: articleId)
                                case .comment(let comment):
                                    IssueAreaCard {
                                        VStack(alignment: .leading, spacing: 0) {
                                            HStack {
                                                Text(TimelineHelpers.relativeTimeString(iso: comment.updatedAt))
                                                    .font(.system(size: 11))
                                                    .foregroundColor(Color(.systemGray))
                                                Spacer()
                                                Menu {
                                                    Button("Copy") { UIPasteboard.general.string = comment.bodyMd }
                                                    Button("Edit") {
                                                        viewModel.replyBody = comment.bodyMd
                                                        editingMode = .comment(comment.id)
                                                    }
                                                    .disabled(isOfflineReadOnly)
                                                    Button("Delete", role: .destructive) {
                                                        Task { await viewModel.deleteComment(comment.id) }
                                                    }
                                                    .disabled(isOfflineReadOnly)
                                                } label: {
                                                    Image(systemName: "ellipsis")
                                                        .foregroundColor(.textSecondary)
                                                }
                                            }
                                            .padding(.horizontal, 16)
                                            .padding(.top, 8)
                                            ThreadItem(
                                                bodyMd: comment.bodyMd,
                                                labels: nil,
                                                showMenu: false,
                                                onIssueTap: { id, type in
                                                    onNavigateToLinkedIssue?(id, type, "")
                                                }
                                            )
                                        }
                                    }
                                }
                            }
                        }
                    }

                    Color.clear.frame(height: 24).id("threadBottom")
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
                    onAttachImage: {},
                    isUploadingImage: false,
                    onExpand: {
                        DispatchQueue.main.asyncAfter(deadline: .now() + 0.1) {
                            withAnimation { proxy.scrollTo("threadBottom", anchor: .bottom) }
                        }
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
                                await viewModel.addComment()
                                DispatchQueue.main.asyncAfter(deadline: .now() + 0.1) {
                                    withAnimation { proxy.scrollTo("threadBottom", anchor: .bottom) }
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
                isReadOnly: isOfflineReadOnly,
                onEditTitle: editTitleAction,
                onDelete: { showDeleteConfirm = true },
                onNavigateToIssue: { target in
                    linkedIssueNavigation.requestAfterDismiss(target)
                },
                labelCountKeyPath: \.articleCount,
                showBookmark: true
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

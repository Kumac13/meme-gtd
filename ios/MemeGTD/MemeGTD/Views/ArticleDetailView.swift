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
    @State private var showInfoSheet: Bool = false
    @State private var showCopiedFeedback: Bool = false
    @ObservedObject private var connectivity = ConnectivityMonitor.shared

    /// Server mode + Offline Sync ON + offline: the article is served from
    /// the local read cache and cannot be edited (offline support plan
    /// Phase 7). Never true in Standalone.
    private var isOfflineReadOnly: Bool {
        connectivity.isOfflineReadOnly
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
            ScrollView {
                LazyVStack(spacing: 0) {
                    if let article = viewModel.article {
                        // === Header Area (glass card): Title + Meta ===
                        areaCard {
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

                                    // Open in browser
                                    Button(action: {
                                        if let url = URL(string: article.meta?.originalUrl ?? "") {
                                            openURL(url)
                                        }
                                    }) {
                                        HStack(spacing: 3) {
                                            Image(systemName: "safari")
                                                .font(.system(size: 12))
                                            Text("Open")
                                                .font(.system(size: 12))
                                        }
                                        .foregroundColor(.accent)
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

                        // === Article Body (reader-like, no card) ===
                        if !article.bodyMd.isEmpty {
                            let cleanBody = article.bodyMd.replacingOccurrences(
                                of: "\\{#block-\\d+\\}",
                                with: "",
                                options: .regularExpression
                            )
                            MarkdownBody(
                                cleanBody,
                                onIssueTap: { id, type in
                                    onNavigateToLinkedIssue?(id, type, "")
                                }
                            )
                            .padding(.horizontal, 16)
                            .padding(.vertical, 16)
                            .frame(maxWidth: .infinity, alignment: .leading)
                        } else {
                            Text("No content available.")
                                .font(.system(size: 14))
                                .foregroundColor(.textSecondary)
                                .italic()
                                .frame(maxWidth: .infinity, alignment: .leading)
                                .padding(.vertical, 16)
                                .padding(.horizontal, 16)
                        }

                        // === Timeline: Activities only (no comments) ===
                        if !viewModel.timelineEntries.isEmpty {
                            sectionConnector

                            ForEach(viewModel.timelineEntries) { entry in
                                switch entry {
                                case .activity(let activity):
                                    ActivityItemView(activity: activity, issueId: articleId)
                                case .comment:
                                    EmptyView()
                                }
                            }
                        }
                    }

                    Color.clear.frame(height: 24)
                }
            }
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

                        if let (article, activities) = result {
                            viewModel.applyArticle(article, activities: activities)
                        }
                        HapticManager.notification(.success)
                        continuation.resume()
                    }
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
                        showInfoSheet = true
                    }) {
                        Image(systemName: "ellipsis")
                            .font(.system(size: 17, weight: .medium))
                            .foregroundColor(.textPrimary)
                    }
                }
            )
        }
        .navigationBarTitleDisplayMode(.inline)
        .sheet(isPresented: $showInfoSheet) {
            IssueInfoSheet(
                viewModel: viewModel,
                showCopiedFeedback: $showCopiedFeedback,
                isReadOnly: isOfflineReadOnly,
                onDelete: { showDeleteConfirm = true },
                onNavigateToIssue: { target in
                    onNavigateToLinkedIssue?(target.id, target.type, target.title)
                },
                labelCountKeyPath: \.articleCount,
                showBookmark: false
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
            if viewModel.isLoading && viewModel.article == nil {
                ProgressView("Loading...")
                    .foregroundColor(.textSecondary)
            }
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

    // MARK: - Area card (glass effect, full width)

    private func areaCard<Content: View>(@ViewBuilder content: () -> Content) -> some View {
        content()
            .frame(maxWidth: .infinity)
            .glassEffect(.regular, in: Rectangle())
    }

    // MARK: - Section connector (line between areas)

    private var sectionConnector: some View {
        Rectangle()
            .fill(Color(.systemGray3))
            .frame(width: 2, height: 12)
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.leading, 24)
    }
}

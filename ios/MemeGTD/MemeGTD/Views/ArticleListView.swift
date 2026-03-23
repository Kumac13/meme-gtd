import SwiftUI

struct ArticleListView: View {
    let onMenuTap: () -> Void
    @Binding var navigationPath: NavigationPath

    @EnvironmentObject var articleStore: ArticleStore
    @StateObject private var viewModel = ArticleListViewModel()
    @State private var isSearching: Bool = false

    var body: some View {
        ScrollView {
            LazyVStack(spacing: 0) {
                ForEach(articleStore.articles) { article in
                    Button(action: {
                        HapticManager.selection()
                        navigationPath.append(
                            ArticleRoute(articleId: article.id, initialTitle: article.title)
                        )
                    }) {
                        ArticleCell(article: article, matchInfo: viewModel.searchMatchInfos[article.id])
                            .padding(.horizontal, 16)
                    }
                    .buttonStyle(.plain)

                    Divider()
                        .padding(.horizontal, 16)
                }

                if articleStore.hasMore {
                    ProgressView()
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 16)
                        .onAppear {
                            Task { await viewModel.loadOlderArticles() }
                        }
                }
            }
        }
        .scrollDismissesKeyboard(.immediately)
        .scrollEdgeEffectStyle(.soft, for: .bottom)
        .refreshable {
            await withCheckedContinuation { continuation in
                Task { @MainActor in
                    HapticManager.impact(.medium)

                    let start = Date()
                    let response = await viewModel.fetchArticles()

                    let elapsed = Date().timeIntervalSince(start)
                    let remaining = 0.75 - elapsed
                    if remaining > 0 {
                        try? await Task.sleep(nanoseconds: UInt64(remaining * 1_000_000_000))
                    }

                    if let response = response {
                        viewModel.applyArticles(response)
                    }
                    HapticManager.notification(.success)
                    continuation.resume()
                }
            }
        }
        .toolbar {
            AppToolbar(
                title: "Articles",
                onMenuTap: onMenuTap,
                isSearching: $isSearching,
                searchQuery: $viewModel.searchQuery,
                searchPlaceholder: "Search articles...",
                onSearch: { viewModel.search() }
            )
        }
        .navigationBarTitleDisplayMode(.inline)
        .onChange(of: articleStore.needsReload) { _, needsReload in
            if needsReload {
                articleStore.needsReload = false
                Task { await viewModel.loadArticles() }
            }
        }
        .onChange(of: isSearching) { _, newValue in
            if !newValue {
                UIApplication.shared.sendAction(#selector(UIResponder.resignFirstResponder), to: nil, from: nil, for: nil)
            }
        }
        .overlay {
            if viewModel.isLoading && articleStore.articles.isEmpty {
                ProgressView("Loading articles...")
                    .foregroundColor(.textSecondary)
            }
        }
        .task {
            viewModel.store = articleStore
            if articleStore.articles.isEmpty {
                await viewModel.loadArticles()
            }
        }
    }
}

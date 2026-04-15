import SwiftUI

struct ArticleListView: View {
    let onMenuTap: () -> Void
    @Binding var navigationPath: NavigationPath

    @EnvironmentObject var articleStore: ArticleStore
    @StateObject private var viewModel = ArticleListViewModel()
    @State private var isSearching: Bool = false
    @State private var showCopyDialog: Bool = false

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
                        ArticleCell(article: article, snippet: viewModel.searchMatchInfos[article.id], searchQuery: viewModel.searchQuery.isEmpty ? nil : viewModel.searchQuery)
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
                onSearch: { viewModel.search() },
                searchBarAction: {
                    if !articleStore.articles.isEmpty {
                        Button(action: {
                            HapticManager.impact(.light)
                            showCopyDialog = true
                        }) {
                            if viewModel.isExporting {
                                ProgressView()
                                    .controlSize(.mini)
                            } else {
                                Image(systemName: "doc.on.doc")
                                    .font(.system(size: 14))
                                    .foregroundColor(Color(.systemGray))
                            }
                        }
                        .disabled(viewModel.isExporting)
                    }
                }
            )
        }
        .confirmationDialog(
            "Copy Search Results",
            isPresented: $showCopyDialog,
            titleVisibility: .visible
        ) {
            Button("Copy Results") {
                Task { await viewModel.exportAndCopy(includeComments: false) }
            }
            Button("Copy with Comments") {
                Task { await viewModel.exportAndCopy(includeComments: true) }
            }
            Button("Cancel", role: .cancel) {}
        }
        .overlay(alignment: .top) {
            if viewModel.showCopiedFeedback {
                Text("Copied!")
                    .font(.system(size: 13, weight: .semibold))
                    .padding(.horizontal, 16)
                    .padding(.vertical, 8)
                    .background(.regularMaterial, in: Capsule())
                    .padding(.top, 8)
                    .transition(.move(edge: .top).combined(with: .opacity))
            }
        }
        .animation(.easeInOut(duration: 0.2), value: viewModel.showCopiedFeedback)
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

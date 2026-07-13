import SwiftUI

struct ArticleListView: View {
    let onMenuTap: () -> Void
    @Binding var navigationPath: NavigationPath

    @EnvironmentObject var articleStore: ArticleStore
    @EnvironmentObject var dataSources: DataSourceProvider
    @StateObject private var viewModel = ArticleListViewModel()
    @State private var isSearching: Bool = false
    @State private var showCopyDialog: Bool = false
    @StateObject private var creation = CreationPresentationCoordinator<Template?>()
    @State private var showOriginPicker = false
    @State private var showLabelPicker = false
    @State private var selectedLabels: Set<String> = []
    @State private var showProjectPicker = false
    @State private var selectedProjects: Set<Int> = []
    @State private var selectedNoProject = false

    private var hasActiveFilters: Bool {
        !viewModel.searchQuery.isEmpty || viewModel.originFilter != "all" ||
        !viewModel.labelFilters.isEmpty || !viewModel.projectFilters.isEmpty ||
        viewModel.includeNoProject || viewModel.bookmarkFilter
    }

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
        .safeAreaInset(edge: .top) {
            VStack(spacing: 0) {
                OfflineReadOnlyIndicator()
                HStack(spacing: 8) {
                    FilterPill(
                        label: viewModel.originFilter == "all" ? "Origin" : viewModel.originFilter.capitalized,
                        isActive: viewModel.originFilter != "all"
                    ) {
                        showOriginPicker = true
                    }

                    FilterPill(
                        label: viewModel.labelFilters.isEmpty ? "Labels" : "\(viewModel.labelFilters.count) Labels",
                        isActive: !viewModel.labelFilters.isEmpty
                    ) {
                        selectedLabels = viewModel.labelFilters
                        showLabelPicker = true
                    }

                    FilterPill(
                        label: viewModel.projectFilters.isEmpty && !viewModel.includeNoProject ? "Projects" : "Projects ✓",
                        isActive: !viewModel.projectFilters.isEmpty || viewModel.includeNoProject
                    ) {
                        selectedProjects = viewModel.projectFilters
                        selectedNoProject = viewModel.includeNoProject
                        showProjectPicker = true
                    }

                    FilterPill(
                        label: viewModel.bookmarkFilter ? "Bookmarked" : "Bookmark",
                        isActive: viewModel.bookmarkFilter,
                        activeColor: .accent
                    ) {
                        viewModel.bookmarkFilter.toggle()
                        viewModel.applyFilters()
                    }
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(.horizontal, 16)
                .padding(.vertical, 8)
            }
        }
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
        .safeAreaBar(edge: .bottom) {
            HStack {
                Spacer()
                FloatingCreateButton {
                    creation.beginChoosing()
                }
            }
            .padding(.horizontal, 16)
            .padding(.bottom, 10)
            .opacity(isSearching ? 0 : 1)
            .allowsHitTesting(!isSearching)
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
                    if !articleStore.articles.isEmpty && hasActiveFilters {
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
        .sheet(isPresented: $showCopyDialog) {
            CopyOptionsSheet(
                isPresented: $showCopyDialog,
                isExporting: viewModel.isExporting,
                onCopyResults: {
                    showCopyDialog = false
                    Task { await viewModel.exportAndCopy(includeComments: false) }
                },
                onCopyWithComments: {
                    showCopyDialog = false
                    Task { await viewModel.exportAndCopy(includeComments: true) }
                }
            )
            .presentationDetents([.height(220)])
        }
        .sheet(isPresented: $creation.isChooserPresented, onDismiss: creation.chooserDidDismiss) {
            TemplateChooserSheet(
                target: "article",
                onBlank: {
                    creation.choose(nil)
                },
                onTemplate: { template in
                    creation.choose(template)
                },
                onDismiss: creation.cancelChooser
            )
            .presentationDetents([.medium, .large])
        }
        .sheet(item: $creation.activeRequest) { request in
            CreateArticleModal(
                template: request.payload,
                initialLabels: viewModel.allLabels,
                initialProjects: viewModel.allProjects,
                onCreated: { article in
                    creation.dismissForm()
                    articleStore.needsReload = true
                    navigationPath.append(ArticleRoute(articleId: article.id, initialTitle: article.title))
                },
                onDismiss: creation.dismissForm
            )
        }
        .sheet(isPresented: $showOriginPicker) {
            originPickerSheet
                .presentationDetents([.medium])
        }
        .sheet(isPresented: $showLabelPicker, onDismiss: { viewModel.labelFilters = selectedLabels; viewModel.applyFilters() }) {
            LabelPickerModal(
                allLabels: viewModel.allLabels,
                selectedNames: $selectedLabels,
                onDismiss: { showLabelPicker = false },
                showClear: true,
                countFor: { $0.articleCount },
                onLabelCreated: { label in viewModel.allLabels.append(label); selectedLabels.insert(label.name) }
            )
            .presentationDetents([.medium, .large])
        }
        .sheet(isPresented: $showProjectPicker, onDismiss: { viewModel.projectFilters = selectedProjects; viewModel.includeNoProject = selectedNoProject; viewModel.applyFilters() }) {
            ProjectPickerModal(
                allProjects: viewModel.allProjects,
                selectedIds: $selectedProjects,
                onDismiss: { showProjectPicker = false },
                showClear: true,
                includeNoProject: $selectedNoProject
            )
            .presentationDetents([.medium, .large])
        }
        .overlay(alignment: .top) {
            if viewModel.showCopiedFeedback {
                FeedbackToast(message: "Copied!")
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
            LoadingOverlay(
                isPresented: viewModel.isLoading && articleStore.articles.isEmpty,
                message: "Loading articles..."
            )
        }
        .task {
            viewModel.store = articleStore
            viewModel.dataSources = dataSources
            if articleStore.articles.isEmpty {
                await viewModel.loadArticles()
            }
            await viewModel.loadFilterData()
        }
    }

    private var originPickerSheet: some View {
        SingleChoiceFilterSheet(
            title: "Origin",
            options: ["all", "web", "manual"],
            selected: viewModel.originFilter,
            label: { $0 == "all" ? "All" : $0.capitalized },
            onSelect: { origin in
                viewModel.originFilter = origin
                viewModel.applyFilters()
                showOriginPicker = false
            },
            onDismiss: { showOriginPicker = false }
        )
    }
}

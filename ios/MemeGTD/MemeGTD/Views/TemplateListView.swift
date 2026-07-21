import SwiftUI

/// Templates list. Same screen anatomy as the Tasks list (rows + filter pill
/// row + floating + button + toolbar search), scoped to what templates have:
/// a target filter (issues.template_target) instead of the task filters.
struct TemplateListView: View {
    let onMenuTap: () -> Void
    @Binding var navigationPath: NavigationPath

    @EnvironmentObject var templateStore: TemplateStore
    @EnvironmentObject var dataSources: DataSourceProvider
    @StateObject private var viewModel = TemplateListViewModel()
    @State private var isSearching: Bool = false
    @State private var showTargetPicker: Bool = false
    @StateObject private var creation = CreationPresentationCoordinator<Void>()

    var body: some View {
        StandardIssueList(
            items: templateStore.templates,
            hasMore: templateStore.hasMore,
            onSelect: { template in
                navigationPath.append(
                    TemplateRoute(templateId: template.id, initialTitle: template.title ?? "")
                )
            },
            onLoadMore: {
                await viewModel.loadOlderTemplates()
            }
        ) { template in
            TemplateCell(template: template)
        }
        .issueListRefreshable {
            if let response = await viewModel.fetchTemplates() {
                viewModel.applyTemplates(response)
            }
        }
        .safeAreaInset(edge: .top) {
            IssueListFilterBar {
                FilterPill(
                    label: viewModel.targetFilter.displayLabel,
                    isActive: viewModel.targetFilter != .all
                ) {
                    showTargetPicker = true
                }
            }
        }
        .safeAreaBar(edge: .bottom) {
            IssueListCreateBar(isSearching: isSearching) {
                creation.present(())
            }
        }
        .toolbar {
            AppToolbar(
                title: "Templates",
                onMenuTap: onMenuTap,
                isSearching: $isSearching,
                searchQuery: $viewModel.searchQuery,
                searchPlaceholder: "Search templates...",
                onSearch: { viewModel.search() }
            )
        }
        .navigationBarTitleDisplayMode(.inline)
        .onChange(of: templateStore.needsReload) { _, needsReload in
            if needsReload {
                templateStore.needsReload = false
                Task { await viewModel.loadTemplates() }
            }
        }
        .issueListSearchLifecycle(isSearching: isSearching)
        .sheet(isPresented: $showTargetPicker) {
            targetPickerSheet
                .presentationDetents([.medium])
        }
        .sheet(item: $creation.activeRequest) { _ in
            CreateTemplateModal(
                onCreated: { _ in
                    Task { await viewModel.loadTemplates() }
                },
                onDismiss: creation.dismissForm
            )
            .presentationDetents([.large])
        }
        .overlay {
            LoadingOverlay(
                isPresented: viewModel.isLoading && templateStore.templates.isEmpty,
                message: "Loading templates..."
            )
        }
        .task {
            viewModel.store = templateStore
            viewModel.dataSources = dataSources
            if templateStore.templates.isEmpty {
                await viewModel.loadTemplates()
            }
        }
    }

    // MARK: - Target Picker Sheet (issues.template_target)

    private var targetPickerSheet: some View {
        SingleChoiceFilterSheet(
            title: "Target",
            options: TemplateTargetFilter.allCases,
            selected: viewModel.targetFilter,
            label: { $0.displayLabel },
            onSelect: { filter in
                viewModel.setTargetFilter(filter)
                showTargetPicker = false
            },
            onDismiss: { showTargetPicker = false }
        )
    }
}

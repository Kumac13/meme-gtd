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
        ScrollView {
            LazyVStack(spacing: 0) {
                ForEach(templateStore.templates) { template in
                    Button(action: {
                        HapticManager.selection()
                        navigationPath.append(
                            TemplateRoute(templateId: template.id, initialTitle: template.title ?? "")
                        )
                    }) {
                        TemplateCell(template: template)
                            .padding(.horizontal, 16)
                    }
                    .buttonStyle(.plain)

                    Divider()
                        .padding(.horizontal, 16)
                }

                if templateStore.hasMore {
                    ProgressView()
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 16)
                        .onAppear {
                            Task { await viewModel.loadOlderTemplates() }
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
                    let response = await viewModel.fetchTemplates()

                    let elapsed = Date().timeIntervalSince(start)
                    let remaining = 0.75 - elapsed
                    if remaining > 0 {
                        try? await Task.sleep(nanoseconds: UInt64(remaining * 1_000_000_000))
                    }

                    if let response = response {
                        viewModel.applyTemplates(response)
                    }
                    HapticManager.notification(.success)
                    continuation.resume()
                }
            }
        }
        .safeAreaInset(edge: .top) {
            HStack(spacing: 8) {
                FilterPill(
                    label: viewModel.targetFilter.displayLabel,
                    isActive: viewModel.targetFilter != .all
                ) {
                    showTargetPicker = true
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.horizontal, 16)
            .padding(.vertical, 8)
        }
        .safeAreaBar(edge: .bottom) {
            HStack {
                Spacer()
                FloatingCreateButton {
                    creation.present(())
                }
            }
            .padding(.horizontal, 16)
            .padding(.bottom, 10)
            .opacity(isSearching ? 0 : 1)
            .allowsHitTesting(!isSearching)
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
        .onChange(of: isSearching) { _, newValue in
            if !newValue {
                UIApplication.shared.sendAction(#selector(UIResponder.resignFirstResponder), to: nil, from: nil, for: nil)
            }
        }
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

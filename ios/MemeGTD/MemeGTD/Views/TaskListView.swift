import SwiftUI

struct TaskListView: View {
    let onMenuTap: () -> Void
    @Binding var navigationPath: NavigationPath

    @EnvironmentObject var taskStore: TaskStore
    @EnvironmentObject var dataSources: DataSourceProvider
    @StateObject private var viewModel = TaskListViewModel()
    @State private var showStatusPicker: Bool = false
    @State private var isSearching: Bool = false
    @State private var showLabelPicker: Bool = false
    @State private var selectedLabelNames: Set<String> = []
    @State private var showProjectPicker: Bool = false
    @State private var selectedProjectIds: Set<Int> = []
    @State private var selectedNoProject: Bool = false
    @State private var showDateRangePicker: Bool = false
    @State private var dateFrom: Date?
    @State private var dateTo: Date?
    @StateObject private var creation = CreationPresentationCoordinator<CreateTaskModeKind>()
    @State private var showCopyDialog: Bool = false
    @ObservedObject private var connectivity = ConnectivityMonitor.shared

    /// Server mode + Offline Sync ON + offline: tasks are served from the
    /// local read cache and cannot be edited (offline support plan Phase 7).
    /// Never true in Standalone (tasks are fully local there).
    private var isOfflineReadOnly: Bool {
        connectivity.isOfflineReadOnly
    }

    /// Standalone Storage Mode: tasks work fully locally (offline support
    /// plan Phase 9), but semantic search needs the server's embedding stack,
    /// so the search-mode picker is hidden (keyword-only).
    private var isStandalone: Bool {
        Settings.shared.appMode == .standalone
    }

    private var hasActiveFilters: Bool {
        !viewModel.searchQuery.isEmpty ||
        !viewModel.labelFilters.isEmpty ||
        !viewModel.projectFilters.isEmpty ||
        viewModel.includeNoProject ||
        viewModel.bookmarkFilter ||
        viewModel.scheduledFrom != nil ||
        viewModel.scheduledTo != nil
    }

    var body: some View {
        StandardIssueList(
            items: taskStore.tasks,
            hasMore: taskStore.hasMore,
            onSelect: { task in
                navigationPath.append(
                    TaskRoute(taskId: task.id, initialTitle: task.title)
                )
            },
            onLoadMore: {
                await viewModel.loadOlderTasks()
            }
        ) { task in
            VStack(alignment: .leading, spacing: 0) {
                TaskCell(
                    task: task,
                    snippet: viewModel.searchMatchInfos[task.id],
                    searchQuery: viewModel.searchMode == .keyword && !viewModel.searchQuery.isEmpty ? viewModel.searchQuery : nil
                )
                if let score = viewModel.relevanceScores[task.id] {
                    RelevanceBar(score: score)
                        .padding(.top, 4)
                }
            }
        }
        .issueListRefreshable {
            if let response = await viewModel.fetchTasks() {
                viewModel.applyTasks(response)
            }
        }
        .safeAreaInset(edge: .top) {
            VStack(spacing: 0) {
                OfflineReadOnlyIndicator()

                // Standalone: semantic search is server-only, so the mode
                // picker is hidden and search stays on its keyword default.
                if isSearching && !isStandalone {
                    IssueSearchModePicker(selection: $viewModel.searchMode) {
                        if viewModel.isSearching {
                            viewModel.search()
                        }
                    }
                }

                IssueListFilterBar {
                    FilterPill(
                        label: viewModel.statusFilter.displayLabel,
                        isActive: true
                    ) {
                        showStatusPicker = true
                    }

                    FilterPill(
                        label: labelFilterDisplayLabel,
                        isActive: !viewModel.labelFilters.isEmpty
                    ) {
                        selectedLabelNames = viewModel.labelFilters
                        showLabelPicker = true
                    }

                    FilterPill(
                        label: projectFilterDisplayLabel,
                        isActive: !viewModel.projectFilters.isEmpty || viewModel.includeNoProject
                    ) {
                        selectedProjectIds = viewModel.projectFilters
                        selectedNoProject = viewModel.includeNoProject
                        showProjectPicker = true
                    }

                    FilterPill(
                        label: scheduleFilterDisplayLabel,
                        isActive: viewModel.scheduledFrom != nil || viewModel.scheduledTo != nil
                    ) {
                        dateFrom = viewModel.scheduledFrom
                        dateTo = viewModel.scheduledTo
                        showDateRangePicker = true
                    }

                    FilterPill(
                        label: viewModel.bookmarkFilter ? "Bookmarked" : "Bookmark",
                        isActive: viewModel.bookmarkFilter,
                        activeColor: .accent
                    ) {
                        viewModel.toggleBookmarkFilter()
                    }
                }
            }
        }
        .safeAreaBar(edge: .bottom) {
            IssueListCreateBar(isSearching: isSearching, disabled: isOfflineReadOnly) {
                creation.beginChoosing()
            }
        }
        .toolbar {
            AppToolbar(
                title: "Tasks",
                onMenuTap: onMenuTap,
                isSearching: $isSearching,
                searchQuery: $viewModel.searchQuery,
                searchPlaceholder: "Search tasks...",
                onSearch: { viewModel.search() },
                searchBarAction: {
                    IssueListExportButton(
                        isVisible: !taskStore.tasks.isEmpty && hasActiveFilters,
                        isExporting: viewModel.isExporting,
                        action: {
                            showCopyDialog = true
                        }
                    )
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
        .overlay(alignment: .top) {
            if viewModel.showCopiedFeedback {
                FeedbackToast(message: "Copied!")
            }
        }
        .animation(.easeInOut(duration: 0.2), value: viewModel.showCopiedFeedback)
        .navigationBarTitleDisplayMode(.inline)
        .onChange(of: taskStore.needsReload) { _, needsReload in
            if needsReload {
                taskStore.needsReload = false
                Task { await viewModel.loadTasks() }
            }
        }
        .issueListSearchLifecycle(isSearching: isSearching)
        .sheet(isPresented: $showStatusPicker) {
            statusPickerSheet
                .presentationDetents([.medium])
        }
        .sheet(isPresented: $showLabelPicker, onDismiss: {
            viewModel.setLabelFilters(selectedLabelNames)
        }) {
            LabelPickerModal(
                allLabels: viewModel.allLabels,
                selectedNames: $selectedLabelNames,
                onDismiss: { showLabelPicker = false },
                showClear: true,
                countFor: { $0.taskCount },
                onLabelCreated: { newLabel in
                    viewModel.allLabels.append(newLabel)
                    selectedLabelNames.insert(newLabel.name)
                }
            )
            .presentationDetents([.medium, .large])
        }
        .sheet(isPresented: $showProjectPicker, onDismiss: {
            viewModel.setProjectFilters(selectedProjectIds, includeNone: selectedNoProject)
        }) {
            ProjectPickerModal(
                allProjects: viewModel.allProjects,
                selectedIds: $selectedProjectIds,
                onDismiss: { showProjectPicker = false },
                showClear: true,
                includeNoProject: $selectedNoProject
            )
            .presentationDetents([.medium, .large])
        }
        .sheet(isPresented: $showDateRangePicker, onDismiss: {
            viewModel.setDateFilter(from: dateFrom, to: dateTo)
        }) {
            DateRangePickerModal(
                dateFrom: $dateFrom,
                dateTo: $dateTo,
                onDismiss: { showDateRangePicker = false }
            )
            .presentationDetents([.medium])
        }
        .sheet(isPresented: $creation.isChooserPresented, onDismiss: creation.chooserDidDismiss) {
            TemplateChooserSheet(
                target: "task",
                onBlank: {
                    creation.choose(.standard)
                },
                onTemplate: { template in
                    creation.choose(.fromTemplate(
                        bodyMd: template.bodyMd,
                        initialLabelNames: template.labels ?? [],
                        initialProjectIds: template.projectIds ?? []
                    ))
                },
                onDismiss: creation.cancelChooser
            )
            .presentationDetents([.medium, .large])
        }
        .sheet(item: $creation.activeRequest) { request in
            CreateTaskModal(
                mode: request.payload,
                onCreated: { _ in
                    Task { await viewModel.loadTasks() }
                },
                onDismiss: creation.dismissForm
            )
            .presentationDetents([.large])
        }
        .overlay {
            LoadingOverlay(
                isPresented: viewModel.isLoading && taskStore.tasks.isEmpty,
                message: "Loading tasks..."
            )
        }
        .task {
            viewModel.store = taskStore
            viewModel.dataSources = dataSources
            // Tasks render first; labels/projects only feed the filter
            // pickers and must not block the list (see MemoListView).
            if taskStore.tasks.isEmpty {
                await viewModel.loadTasks()
            }
            async let labels: Void = viewModel.loadLabels()
            async let projects: Void = viewModel.loadProjects()
            _ = await (labels, projects)
        }
    }

    // MARK: - Filter Display Labels

    private var labelFilterDisplayLabel: String {
        let count = viewModel.labelFilters.count
        if count == 0 { return "Label" }
        if count == 1 { return viewModel.labelFilters.first! }
        return "\(count) Labels"
    }

    private var projectFilterDisplayLabel: String {
        let count = viewModel.projectFilters.count + (viewModel.includeNoProject ? 1 : 0)
        if count == 0 { return "Project" }
        return "\(count) Projects"
    }

    private var scheduleFilterDisplayLabel: String {
        DateFilterHelpers.displayLabel(from: viewModel.scheduledFrom, to: viewModel.scheduledTo)
    }


    // MARK: - Status Picker Sheet

    private var statusPickerSheet: some View {
        SingleChoiceFilterSheet(
            title: "Status",
            options: TaskStatusFilter.allCases,
            selected: viewModel.statusFilter,
            label: { $0.displayLabel },
            onSelect: { status in
                viewModel.setStatusFilter(status)
                showStatusPicker = false
            },
            onDismiss: { showStatusPicker = false }
        )
    }

}

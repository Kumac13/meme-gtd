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
    @State private var createTaskMode: CreateTaskMode? = nil
    @State private var showTemplateChooser: Bool = false
    @State private var chosenCreateKind: CreateTaskModeKind? = nil
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
        ScrollView {
            LazyVStack(spacing: 0) {
                ForEach(taskStore.tasks) { task in
                    Button(action: {
                        HapticManager.selection()
                        navigationPath.append(
                            TaskRoute(taskId: task.id, initialTitle: task.title)
                        )
                    }) {
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
                        .padding(.horizontal, 16)
                    }
                    .buttonStyle(.plain)

                    Divider()
                        .padding(.horizontal, 16)
                }

                if taskStore.hasMore {
                    ProgressView()
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 16)
                        .onAppear {
                            Task { await viewModel.loadOlderTasks() }
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
                    let response = await viewModel.fetchTasks()

                    let elapsed = Date().timeIntervalSince(start)
                    let remaining = 0.75 - elapsed
                    if remaining > 0 {
                        try? await Task.sleep(nanoseconds: UInt64(remaining * 1_000_000_000))
                    }

                    if let response = response {
                        viewModel.applyTasks(response)
                    }
                    HapticManager.notification(.success)
                    continuation.resume()
                }
            }
        }
        .safeAreaInset(edge: .top) {
            VStack(spacing: 0) {
                OfflineReadOnlyIndicator()

                // Standalone: semantic search is server-only, so the mode
                // picker is hidden and search stays on its keyword default.
                if isSearching && !isStandalone {
                    Picker("Search Mode", selection: $viewModel.searchMode) {
                        ForEach(SearchMode.allCases, id: \.self) { mode in
                            Text(mode.rawValue).tag(mode)
                        }
                    }
                    .pickerStyle(.segmented)
                    .background(.regularMaterial, in: Capsule())
                    .padding(.horizontal, 16)
                    .padding(.vertical, 8)
                    .onChange(of: viewModel.searchMode) { _, _ in
                        if viewModel.isSearching {
                            viewModel.search()
                        }
                    }
                }

                HStack(spacing: 8) {
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
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.horizontal, 16)
            .padding(.vertical, 8)
            }
        }
        .safeAreaBar(edge: .bottom) {
            HStack {
                Spacer()
                Button(action: {
                    HapticManager.impact(.medium)
                    // Pre-screen (requirement): choose Blank or a template
                    // before entering the Create New Task form.
                    showTemplateChooser = true
                }) {
                    Image(systemName: "plus")
                        .font(.system(size: 20, weight: .semibold))
                        .foregroundColor(.white)
                        .frame(width: 52, height: 52)
                        .background(Color.accent)
                        .clipShape(Circle())
                }
                .disabled(isOfflineReadOnly)
                .opacity(isOfflineReadOnly ? 0.4 : 1)
            }
            .padding(.horizontal, 16)
            .padding(.bottom, 10)
            .opacity(isSearching ? 0 : 1)
            .allowsHitTesting(!isSearching)
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
                    if !taskStore.tasks.isEmpty && hasActiveFilters {
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
        .onChange(of: taskStore.needsReload) { _, needsReload in
            if needsReload {
                taskStore.needsReload = false
                Task { await viewModel.loadTasks() }
            }
        }
        .onChange(of: isSearching) { _, newValue in
            if !newValue {
                UIApplication.shared.sendAction(#selector(UIResponder.resignFirstResponder), to: nil, from: nil, for: nil)
            }
        }
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
        .sheet(isPresented: $showTemplateChooser, onDismiss: {
            if let kind = chosenCreateKind {
                createTaskMode = CreateTaskMode(kind: kind)
                chosenCreateKind = nil
            }
        }) {
            TemplateChooserSheet(
                target: "task",
                onBlank: {
                    chosenCreateKind = .standard
                    showTemplateChooser = false
                },
                onTemplate: { template in
                    chosenCreateKind = .fromTemplate(
                        bodyMd: template.bodyMd,
                        initialLabelNames: template.labels ?? [],
                        initialProjectIds: template.projectIds ?? []
                    )
                    showTemplateChooser = false
                },
                onDismiss: { showTemplateChooser = false }
            )
            .presentationDetents([.medium, .large])
        }
        .sheet(item: $createTaskMode) { mode in
            CreateTaskModal(
                mode: mode.kind,
                onCreated: { _ in
                    Task { await viewModel.loadTasks() }
                },
                onDismiss: { createTaskMode = nil }
            )
            .presentationDetents([.large])
        }
        .overlay {
            if viewModel.isLoading && taskStore.tasks.isEmpty {
                ProgressView("Loading tasks...")
                    .foregroundColor(.textSecondary)
            }
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
        VStack(spacing: 0) {
            HStack {
                Button(action: { HapticManager.impact(.light); showStatusPicker = false }) {
                    Image(systemName: "xmark.circle.fill")
                        .font(.system(size: 28))
                        .symbolRenderingMode(.hierarchical)
                        .foregroundColor(Color(.tertiaryLabel))
                }
                Spacer()
                Text("Status")
                    .font(.system(size: 17, weight: .semibold))
                Spacer()
                Image(systemName: "xmark.circle.fill")
                    .font(.system(size: 28))
                    .hidden()
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 12)

            Divider()

            ScrollView {
                VStack(alignment: .leading, spacing: 0) {
                    ForEach(TaskStatusFilter.allCases, id: \.self) { status in
                        Button(action: {
                            HapticManager.selection()
                            viewModel.setStatusFilter(status)
                            showStatusPicker = false
                        }) {
                            HStack {
                                Text(status.displayLabel)
                                    .font(.system(size: 16))
                                    .foregroundColor(.textPrimary)
                                Spacer()
                                if viewModel.statusFilter == status {
                                    Image(systemName: "checkmark.circle.fill")
                                        .font(.system(size: 22))
                                        .foregroundColor(.accent)
                                } else {
                                    Image(systemName: "plus.circle")
                                        .font(.system(size: 22))
                                        .foregroundColor(Color(.systemGray3))
                                }
                            }
                            .padding(.horizontal, 16)
                            .padding(.vertical, 14)
                        }
                        Divider().padding(.leading, 16)
                    }
                }
            }
        }
        .background(Color(.systemBackground))
    }

}

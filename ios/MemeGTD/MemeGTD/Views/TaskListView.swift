import SwiftUI

struct TaskListView: View {
    let onMenuTap: () -> Void
    @Binding var navigationPath: NavigationPath

    @StateObject private var viewModel = TaskListViewModel()
    @State private var showStatusPicker: Bool = false
    @State private var isSearching: Bool = false
    @State private var showLabelPicker: Bool = false
    @State private var selectedLabelNames: Set<String> = []
    @State private var showProjectPicker: Bool = false
    @State private var selectedProjectIds: Set<Int> = []
    @State private var selectedNoProject: Bool = false
    @State private var showCreateTask: Bool = false

    var body: some View {
        ScrollView {
            LazyVStack(spacing: 0) {
                ForEach(viewModel.tasks) { task in
                    Button(action: {
                        HapticManager.selection()
                        navigationPath.append(
                            TaskRoute(taskId: task.id, initialTitle: task.title)
                        )
                    }) {
                        TaskCell(task: task)
                            .padding(.horizontal, 16)
                    }
                    .buttonStyle(.plain)

                    Divider()
                        .padding(.horizontal, 16)
                }

                if viewModel.hasMore {
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
            HStack(spacing: 8) {
                filterPill(
                    label: viewModel.statusFilter.displayLabel,
                    isActive: true
                ) {
                    showStatusPicker = true
                }

                filterPill(
                    label: labelFilterDisplayLabel,
                    isActive: !viewModel.labelFilters.isEmpty
                ) {
                    selectedLabelNames = viewModel.labelFilters
                    showLabelPicker = true
                }

                filterPill(
                    label: projectFilterDisplayLabel,
                    isActive: !viewModel.projectFilters.isEmpty || viewModel.includeNoProject
                ) {
                    selectedProjectIds = viewModel.projectFilters
                    selectedNoProject = viewModel.includeNoProject
                    showProjectPicker = true
                }

                bookmarkPill

                Spacer()
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 8)
        }
        .safeAreaBar(edge: .bottom) {
            HStack {
                Spacer()
                Button(action: {
                    HapticManager.impact(.medium)
                    showCreateTask = true
                }) {
                    Image(systemName: "plus")
                        .font(.system(size: 20, weight: .semibold))
                        .foregroundColor(.white)
                        .frame(width: 52, height: 52)
                        .background(Color.accent)
                        .clipShape(Circle())
                }
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
                onSearch: { viewModel.search() }
            )
        }
        .navigationBarTitleDisplayMode(.inline)
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
                countFor: { $0.taskCount }
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
        .sheet(isPresented: $showCreateTask) {
            CreateTaskModal(
                mode: .standard,
                onCreated: { _ in
                    Task { await viewModel.loadTasks() }
                },
                onDismiss: { showCreateTask = false }
            )
            .presentationDetents([.large])
        }
        .overlay {
            if viewModel.isLoading && viewModel.tasks.isEmpty {
                ProgressView("Loading tasks...")
                    .foregroundColor(.textSecondary)
            }
        }
        .task {
            await viewModel.loadLabels()
            await viewModel.loadProjects()
            if viewModel.tasks.isEmpty {
                await viewModel.loadTasks()
            }
        }
    }

    // MARK: - Bookmark Pill

    private var bookmarkPill: some View {
        Button(action: {
            HapticManager.impact(.light)
            viewModel.toggleBookmarkFilter()
        }) {
            Text(viewModel.bookmarkFilter ? "Bookmarked" : "Bookmark")
                .font(.system(size: 13))
                .foregroundColor(viewModel.bookmarkFilter ? .accent : .textSecondary)
                .padding(.horizontal, 10)
                .padding(.vertical, 6)
        }
        .modifier(PillSurface(radius: 16))
    }

    // MARK: - Filter Pill

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

    private func filterPill(label: String, isActive: Bool, action: @escaping () -> Void) -> some View {
        Button(action: {
            HapticManager.impact(.light)
            action()
        }) {
            HStack(spacing: 3) {
                Text(label)
                    .font(.system(size: 13))
                    .foregroundColor(isActive ? .textPrimary : .textSecondary)
                Image(systemName: "chevron.down")
                    .font(.system(size: 9, weight: .medium))
                    .foregroundColor(.textSecondary)
            }
            .padding(.horizontal, 10)
            .padding(.vertical, 6)
        }
        .modifier(PillSurface(radius: 16))
    }

    // MARK: - Status Picker Sheet

    private var statusPickerSheet: some View {
        VStack(spacing: 0) {
            HStack {
                Button(action: { showStatusPicker = false }) {
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

import SwiftUI

struct TaskListView: View {
    let onMenuTap: () -> Void

    @StateObject private var viewModel = TaskListViewModel()
    @State private var showStatusPicker: Bool = false
    @State private var showLabelPicker: Bool = false
    @State private var showCreateAlert: Bool = false
    @FocusState private var searchFocused: Bool

    var body: some View {
        VStack(spacing: 0) {
            filterBar
            taskListContent
        }
        .safeAreaBar(edge: .bottom) {
            taskBottomBar
                .padding(.horizontal, 16)
                .padding(.bottom, 10)
        }
        .toolbar {
            ToolbarItem(placement: .navigationBarLeading) {
                Button(action: onMenuTap) {
                    Image(systemName: "line.3.horizontal")
                        .font(.system(size: 18, weight: .medium))
                        .foregroundColor(.textPrimary)
                }
            }
            ToolbarItem(placement: .principal) {
                Text("Tasks")
                    .font(.headline)
            }
            ToolbarItem(placement: .navigationBarTrailing) {
                Button(action: {
                    HapticManager.impact(.light)
                    viewModel.toggleBookmarkFilter()
                }) {
                    Image(systemName: viewModel.bookmarkFilter ? "bookmark.fill" : "bookmark")
                        .foregroundColor(viewModel.bookmarkFilter ? .accent : .textSecondary)
                }
            }
        }
        .navigationBarTitleDisplayMode(.inline)
        .overlay {
            if viewModel.isLoading && viewModel.tasks.isEmpty {
                ProgressView("Loading tasks...")
                    .foregroundColor(.textSecondary)
            }
        }
        .task {
            await viewModel.loadLabels()
            if viewModel.tasks.isEmpty {
                await viewModel.loadTasks()
            }
        }
        .alert("New Task", isPresented: $showCreateAlert) {
            TextField("Task title", text: $viewModel.newTaskTitle)
            Button("Cancel", role: .cancel) {
                viewModel.newTaskTitle = ""
            }
            Button("Create") {
                Task { await viewModel.createTask() }
            }
        } message: {
            Text("Enter a title for the new task.")
        }
    }

    // MARK: - Filter Bar

    private var filterBar: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                filterPill(
                    label: viewModel.statusFilter?.displayLabel ?? "Status",
                    isActive: viewModel.statusFilter != nil
                ) {
                    showStatusPicker = true
                }

                filterPill(
                    label: viewModel.labelFilter ?? "Label",
                    isActive: viewModel.labelFilter != nil
                ) {
                    showLabelPicker = true
                }
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 8)
        }
        .sheet(isPresented: $showStatusPicker) {
            statusPickerSheet
                .presentationDetents([.medium])
        }
        .sheet(isPresented: $showLabelPicker) {
            labelPickerSheet
                .presentationDetents([.medium, .large])
        }
    }

    private func filterPill(label: String, isActive: Bool, action: @escaping () -> Void) -> some View {
        Button(action: {
            HapticManager.impact(.light)
            action()
        }) {
            HStack(spacing: 4) {
                Text(label)
                    .font(.system(size: 14))
                    .foregroundColor(isActive ? .textPrimary : .textSecondary)
                Image(systemName: "chevron.down")
                    .font(.system(size: 10, weight: .medium))
                    .foregroundColor(.textSecondary)
            }
            .padding(.horizontal, 12)
            .padding(.vertical, 6)
            .background(Color(.systemBackground))
            .overlay(
                RoundedRectangle(cornerRadius: 20, style: .continuous)
                    .stroke(Color.border, lineWidth: 1)
            )
            .clipShape(RoundedRectangle(cornerRadius: 20, style: .continuous))
        }
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
                Button(action: {
                    viewModel.setStatusFilter(nil)
                    showStatusPicker = false
                }) {
                    Text("Clear")
                        .font(.system(size: 15))
                        .foregroundColor(.accent)
                }
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 12)

            Divider()

            ScrollView {
                VStack(alignment: .leading, spacing: 0) {
                    ForEach(TaskStatus.allCases, id: \.self) { status in
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
                                    Image(systemName: "checkmark")
                                        .foregroundColor(.accent)
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

    // MARK: - Label Picker Sheet

    private var labelPickerSheet: some View {
        VStack(spacing: 0) {
            HStack {
                Button(action: { showLabelPicker = false }) {
                    Image(systemName: "xmark.circle.fill")
                        .font(.system(size: 28))
                        .symbolRenderingMode(.hierarchical)
                        .foregroundColor(Color(.tertiaryLabel))
                }
                Spacer()
                Text("Label")
                    .font(.system(size: 17, weight: .semibold))
                Spacer()
                Button(action: {
                    viewModel.setLabelFilter(nil)
                    showLabelPicker = false
                }) {
                    Text("Clear")
                        .font(.system(size: 15))
                        .foregroundColor(.accent)
                }
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 12)

            Divider()

            ScrollView {
                VStack(alignment: .leading, spacing: 0) {
                    ForEach(viewModel.allLabels) { label in
                        Button(action: {
                            HapticManager.selection()
                            viewModel.setLabelFilter(label.name)
                            showLabelPicker = false
                        }) {
                            HStack {
                                Text(label.name)
                                    .font(.system(size: 13, weight: .medium))
                                    .padding(.horizontal, 10)
                                    .padding(.vertical, 5)
                                    .background(LabelColorHelper.bgColor(for: label.name))
                                    .foregroundColor(LabelColorHelper.textColor(for: label.name))
                                    .clipShape(Capsule())
                                Spacer()
                                if viewModel.labelFilter == label.name {
                                    Image(systemName: "checkmark")
                                        .foregroundColor(.accent)
                                }
                            }
                            .padding(.horizontal, 16)
                            .padding(.vertical, 10)
                        }
                        Divider().padding(.leading, 16)
                    }
                }
            }
        }
        .background(Color(.systemBackground))
    }

    // MARK: - Task List Content

    private var taskListContent: some View {
        ScrollView {
            LazyVStack(spacing: 0) {
                ForEach(viewModel.tasks) { task in
                    TaskCell(task: task)
                        .padding(.horizontal, 16)

                    Divider()
                        .padding(.leading, 16)
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
    }

    // MARK: - Bottom Bar

    private var taskBottomBar: some View {
        HStack(alignment: .bottom, spacing: 10) {
            // Search pill (always expanded)
            HStack(spacing: 8) {
                Image(systemName: "magnifyingglass")
                    .font(.system(size: 13))
                    .foregroundColor(Color(.systemGray))

                TextField("Search tasks...", text: $viewModel.searchQuery)
                    .textFieldStyle(.plain)
                    .font(.system(size: 14))
                    .tint(Color.accent)
                    .textInputAutocapitalization(.never)
                    .autocorrectionDisabled()
                    .focused($searchFocused)
                    .onSubmit { viewModel.search() }

                if !viewModel.searchQuery.isEmpty {
                    Button(action: {
                        viewModel.searchQuery = ""
                        viewModel.search()
                    }) {
                        Image(systemName: "xmark.circle.fill")
                            .font(.system(size: 14))
                            .foregroundColor(Color(.systemGray))
                    }
                }
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 16)
            .frame(minHeight: 52)
            .modifier(PillSurface(radius: 22))

            // New task button (green circle)
            Button(action: {
                HapticManager.impact(.light)
                showCreateAlert = true
            }) {
                Image(systemName: "plus")
                    .font(.system(size: 20, weight: .semibold))
                    .foregroundColor(.white)
                    .frame(width: 52, height: 52)
                    .background(Color.accent)
                    .clipShape(Circle())
            }
        }
    }
}

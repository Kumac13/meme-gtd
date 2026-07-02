import SwiftUI

struct CreateTaskModal: View {
    let mode: CreateTaskModeKind
    let onCreated: (TaskItem) -> Void
    let onDismiss: () -> Void

    @EnvironmentObject var dataSources: DataSourceProvider
    @StateObject private var viewModel: CreateTaskViewModel

    @State private var showStatusPicker = false
    @State private var showLabelPicker = false
    @State private var showProjectPicker = false
    @State private var showLinkPicker = false
    @State private var selectedLabelNames: Set<String> = []
    @State private var selectedProjectIds: Set<Int> = []

    init(mode: CreateTaskModeKind, onCreated: @escaping (TaskItem) -> Void, onDismiss: @escaping () -> Void) {
        self.mode = mode
        self.onCreated = onCreated
        self.onDismiss = onDismiss
        self._viewModel = StateObject(wrappedValue: CreateTaskViewModel(mode: mode))
    }

    private var headerTitle: String {
        if case .promoteFromMemo = mode { return "Promote to Task" }
        if case .quickChild = mode { return "Add Child" }
        return "New Task"
    }

    var body: some View {
        VStack(spacing: 0) {
            // Header
            header

            Divider()

            fullForm
        }
        .background(Color(.systemBackground))
        .task {
            viewModel.dataSources = dataSources
            await viewModel.loadData()
            // Sync initial selections for picker state
            selectedLabelNames = viewModel.selectedLabelNames
            selectedProjectIds = viewModel.selectedProjectIds
        }
    }

    // MARK: - Header

    private var header: some View {
        HStack {
            Button(action: {
                HapticManager.impact(.light)
                onDismiss()
            }) {
                Image(systemName: "xmark.circle.fill")
                    .font(.system(size: 28))
                    .symbolRenderingMode(.hierarchical)
                    .foregroundColor(Color(.tertiaryLabel))
            }

            Spacer()

            Text(headerTitle)
                .font(.system(size: 17, weight: .semibold))

            Spacer()

            Button(action: { submit() }) {
                if viewModel.isSubmitting {
                    ProgressView()
                        .frame(width: 28, height: 28)
                } else {
                    Text("Create")
                        .font(.system(size: 17, weight: .semibold))
                        .foregroundColor(
                            viewModel.title.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
                                ? Color(.systemGray3) : .accent
                        )
                }
            }
            .disabled(viewModel.title.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || viewModel.isSubmitting)
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 12)
    }

    // MARK: - Full Form

    private var fullForm: some View {
        ScrollView {
            VStack(spacing: 0) {
                // Title
                VStack(alignment: .leading, spacing: 4) {
                    Text("Title")
                        .font(.system(size: 13, weight: .medium))
                        .foregroundColor(.textSecondary)
                    AutoFocusTextField(
                        placeholder: "Task title...",
                        text: $viewModel.title
                    )
                }
                .padding(.horizontal, 16)
                .padding(.vertical, 12)

                Divider().padding(.leading, 16)

                // Description
                VStack(alignment: .leading, spacing: 4) {
                    Text("Description")
                        .font(.system(size: 13, weight: .medium))
                        .foregroundColor(.textSecondary)
                    TextEditor(text: $viewModel.bodyMd)
                        .font(.system(size: 15))
                        .frame(minHeight: 80, maxHeight: 160)
                        .scrollContentBackground(.hidden)
                        .tint(Color.accent)
                }
                .padding(.horizontal, 16)
                .padding(.vertical, 12)

                Divider().padding(.leading, 16)

                // Status
                statusRow

                Divider().padding(.leading, 16)

                // Kind
                kindRow

                Divider().padding(.leading, 16)

                // Schedule
                scheduleSection

                Divider().padding(.leading, 16)

                // Labels
                labelsRow

                Divider().padding(.leading, 16)

                // Projects
                projectsRow

                Divider().padding(.leading, 16)

                // Links
                linksRow

                if let error = viewModel.error {
                    errorBanner(error)
                }

                Color.clear.frame(height: 40)
            }
        }
        .scrollDismissesKeyboard(.immediately)
        .sheet(isPresented: $showStatusPicker) {
            statusPickerSheet
                .presentationDetents([.medium])
        }
        .sheet(isPresented: $showLabelPicker) {
            LabelPickerModal(
                allLabels: viewModel.allLabels,
                selectedNames: $selectedLabelNames,
                onDismiss: { showLabelPicker = false },
                countFor: { $0.taskCount },
                onLabelCreated: { newLabel in
                    viewModel.allLabels.append(newLabel)
                    selectedLabelNames.insert(newLabel.name)
                }
            )
            .presentationDetents([.medium, .large])
        }
        .onChange(of: selectedLabelNames) { _, newValue in
            viewModel.selectedLabelNames = newValue
        }
        .sheet(isPresented: $showProjectPicker) {
            ProjectPickerModal(
                allProjects: viewModel.allProjects,
                selectedIds: $selectedProjectIds,
                onDismiss: { showProjectPicker = false },
                onConfirm: { ids in
                    viewModel.selectedProjectIds = ids
                    selectedProjectIds = ids
                    showProjectPicker = false
                },
                includeNoProject: .constant(false)
            )
            .presentationDetents([.medium, .large])
        }
        .sheet(isPresented: $showLinkPicker) {
            CreateTaskLinkPicker(
                viewModel: viewModel,
                onDismiss: { showLinkPicker = false }
            )
            .presentationDetents([.medium, .large])
        }
    }

    // MARK: - Status Row

    private var statusRow: some View {
        Button(action: {
            HapticManager.impact(.light)
            showStatusPicker = true
        }) {
            HStack {
                Text("Status")
                    .font(.system(size: 15))
                    .foregroundColor(.textPrimary)
                Spacer()
                Text(viewModel.status.displayLabel)
                    .font(.system(size: 15))
                    .foregroundColor(.textSecondary)
                Image(systemName: "chevron.right")
                    .font(.system(size: 12, weight: .medium))
                    .foregroundColor(Color(.systemGray3))
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 14)
        }
    }

    // MARK: - Kind Row

    private var kindRow: some View {
        HStack {
            Text("Kind")
                .font(.system(size: 15))
                .foregroundColor(.textPrimary)
            Spacer()
            Picker("Kind", selection: $viewModel.taskKind) {
                ForEach(TaskKind.allCases, id: \.self) { kind in
                    Text(kind.displayLabel).tag(kind)
                }
            }
            .pickerStyle(.segmented)
            .frame(width: 180)
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 10)
    }

    // MARK: - Schedule Section

    private var scheduleSection: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Text("Schedule")
                    .font(.system(size: 15))
                    .foregroundColor(.textPrimary)
                Spacer()
                Text("All Day")
                    .font(.system(size: 13))
                    .foregroundColor(.textSecondary)
                Toggle("", isOn: $viewModel.isAllDay)
                    .labelsHidden()
                    .tint(.accent)
            }

            HStack {
                Text("Start")
                    .font(.system(size: 13))
                    .foregroundColor(.textSecondary)
                    .frame(width: 40, alignment: .leading)
                if viewModel.isAllDay {
                    DatePicker("", selection: Binding(
                        get: { viewModel.scheduledStart ?? Date() },
                        set: { viewModel.scheduledStart = $0 }
                    ), displayedComponents: .date)
                    .labelsHidden()
                } else {
                    DatePicker("", selection: Binding(
                        get: { viewModel.scheduledStart ?? Date() },
                        set: { viewModel.scheduledStart = $0 }
                    ), displayedComponents: [.date, .hourAndMinute])
                    .labelsHidden()
                }
                if viewModel.scheduledStart != nil {
                    Button(action: { viewModel.scheduledStart = nil }) {
                        Image(systemName: "xmark.circle.fill")
                            .font(.system(size: 16))
                            .foregroundColor(Color(.systemGray3))
                    }
                }
            }

            HStack {
                Text("End")
                    .font(.system(size: 13))
                    .foregroundColor(.textSecondary)
                    .frame(width: 40, alignment: .leading)
                if viewModel.isAllDay {
                    DatePicker("", selection: Binding(
                        get: { viewModel.scheduledEnd ?? Date() },
                        set: { viewModel.scheduledEnd = $0 }
                    ), displayedComponents: .date)
                    .labelsHidden()
                } else {
                    DatePicker("", selection: Binding(
                        get: { viewModel.scheduledEnd ?? Date() },
                        set: { viewModel.scheduledEnd = $0 }
                    ), displayedComponents: [.date, .hourAndMinute])
                    .labelsHidden()
                }
                if viewModel.scheduledEnd != nil {
                    Button(action: { viewModel.scheduledEnd = nil }) {
                        Image(systemName: "xmark.circle.fill")
                            .font(.system(size: 16))
                            .foregroundColor(Color(.systemGray3))
                    }
                }
            }
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 12)
    }

    // MARK: - Labels Row

    private var labelsRow: some View {
        Button(action: {
            HapticManager.impact(.light)
            selectedLabelNames = viewModel.selectedLabelNames
            showLabelPicker = true
        }) {
            VStack(alignment: .leading, spacing: 0) {
                HStack {
                    Text("Labels")
                        .font(.system(size: 15))
                        .foregroundColor(.textPrimary)
                    Spacer()
                    Image(systemName: "chevron.right")
                        .font(.system(size: 12, weight: .medium))
                        .foregroundColor(Color(.systemGray3))
                }

                if !viewModel.selectedLabelNames.isEmpty {
                    FlowLayout(spacing: 6) {
                        ForEach(Array(viewModel.selectedLabelNames).sorted(), id: \.self) { name in
                            Text(name)
                                .font(.system(size: 12, weight: .medium))
                                .padding(.horizontal, 8)
                                .padding(.vertical, 4)
                                .background(LabelColorHelper.bgColor(for: name))
                                .foregroundColor(LabelColorHelper.textColor(for: name))
                                .clipShape(Capsule())
                        }
                    }
                    .padding(.top, 8)
                } else {
                    Text("None")
                        .font(.system(size: 13))
                        .foregroundColor(.textSecondary)
                        .padding(.top, 4)
                }
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 14)
        }
    }

    // MARK: - Projects Row

    private var projectsRow: some View {
        Button(action: {
            HapticManager.impact(.light)
            selectedProjectIds = viewModel.selectedProjectIds
            showProjectPicker = true
        }) {
            VStack(alignment: .leading, spacing: 0) {
                HStack {
                    Text("Projects")
                        .font(.system(size: 15))
                        .foregroundColor(.textPrimary)
                    Spacer()
                    Image(systemName: "chevron.right")
                        .font(.system(size: 12, weight: .medium))
                        .foregroundColor(Color(.systemGray3))
                }

                if !viewModel.selectedProjectIds.isEmpty {
                    VStack(alignment: .leading, spacing: 4) {
                        ForEach(viewModel.allProjects.filter { viewModel.selectedProjectIds.contains($0.id) }) { project in
                            Text(project.name)
                                .font(.system(size: 13))
                                .foregroundColor(.textSecondary)
                        }
                    }
                    .padding(.top, 6)
                } else {
                    Text("None")
                        .font(.system(size: 13))
                        .foregroundColor(.textSecondary)
                        .padding(.top, 4)
                }
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 14)
        }
    }

    // MARK: - Links Row

    private var linksRow: some View {
        Button(action: {
            HapticManager.impact(.light)
            showLinkPicker = true
        }) {
            VStack(alignment: .leading, spacing: 0) {
                HStack {
                    Text("Links")
                        .font(.system(size: 15))
                        .foregroundColor(.textPrimary)
                    Spacer()
                    Image(systemName: "chevron.right")
                        .font(.system(size: 12, weight: .medium))
                        .foregroundColor(Color(.systemGray3))
                }

                if !viewModel.pendingLinks.isEmpty || !viewModel.pendingUrlLinks.isEmpty {
                    VStack(alignment: .leading, spacing: 6) {
                        ForEach(viewModel.pendingLinks) { link in
                            HStack(spacing: 6) {
                                Image(systemName: link.linkType.iconName)
                                    .font(.system(size: 11, weight: .medium))
                                    .foregroundColor(.textPrimary)
                                    .frame(width: 12)

                                Text(link.title)
                                    .font(.system(size: 13))
                                    .foregroundColor(.textPrimary)
                                    .lineLimit(1)

                                Text(link.linkType.displayLabel)
                                    .font(.system(size: 11))
                                    .foregroundColor(.accentDark)
                            }
                        }

                        ForEach(viewModel.pendingUrlLinks) { urlLink in
                            HStack(spacing: 6) {
                                Image(systemName: "link")
                                    .font(.system(size: 11, weight: .medium))
                                    .foregroundColor(.textPrimary)
                                    .frame(width: 12)

                                Text(urlLink.title ?? urlLink.url)
                                    .font(.system(size: 13))
                                    .foregroundColor(.textPrimary)
                                    .lineLimit(1)
                            }
                        }
                    }
                    .padding(.top, 6)
                } else {
                    Text("None")
                        .font(.system(size: 13))
                        .foregroundColor(.textSecondary)
                        .padding(.top, 4)
                }
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 14)
        }
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
                    ForEach(TaskStatus.allCases, id: \.self) { status in
                        Button(action: {
                            HapticManager.selection()
                            viewModel.status = status
                            showStatusPicker = false
                        }) {
                            HStack {
                                Text(status.displayLabel)
                                    .font(.system(size: 16))
                                    .foregroundColor(.textPrimary)
                                Spacer()
                                if viewModel.status == status {
                                    Image(systemName: "checkmark.circle.fill")
                                        .font(.system(size: 22))
                                        .foregroundColor(.accent)
                                } else {
                                    Image(systemName: "circle")
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

    // MARK: - Error Banner

    private func errorBanner(_ message: String) -> some View {
        HStack {
            Image(systemName: "exclamationmark.triangle.fill")
                .font(.system(size: 14))
                .foregroundColor(.red)
            Text(message)
                .font(.system(size: 13))
                .foregroundColor(.red)
            Spacer()
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 10)
    }

    // MARK: - Submit

    private func submit() {
        Task {
            if let task = await viewModel.createTask() {
                onCreated(task)
                onDismiss()
            }
        }
    }
}

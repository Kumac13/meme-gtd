import SwiftUI

struct CreateTaskModal: View {
    let mode: CreateTaskModeKind
    let onCreated: (TaskItem) -> Void
    let onDismiss: () -> Void

    @EnvironmentObject var dataSources: DataSourceProvider
    @StateObject private var viewModel: CreateTaskViewModel

    @State private var showStatusPicker = false
    @State private var showLinkPicker = false

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
        }
    }

    // MARK: - Header

    private var header: some View {
        CreateIssueModalHeader(
            title: headerTitle,
            isSubmitting: viewModel.isSubmitting,
            isCreateDisabled: viewModel.title.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty,
            onDismiss: onDismiss,
            onCreate: submit
        )
    }

    // MARK: - Full Form

    private var fullForm: some View {
        ScrollView {
            VStack(spacing: 0) {
                CreateIssueTextFields(
                    titlePlaceholder: "Task title...",
                    title: $viewModel.title,
                    bodyMd: $viewModel.bodyMd
                )

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

                CreateIssueMetadataSection(
                    allLabels: $viewModel.allLabels,
                    selectedLabelNames: $viewModel.selectedLabelNames,
                    allProjects: $viewModel.allProjects,
                    selectedProjectIds: $viewModel.selectedProjectIds,
                    labelCount: { $0.taskCount }
                )

                Divider().padding(.leading, 16)

                // Links
                linksRow

                if let error = viewModel.error {
                    CreateIssueErrorBanner(message: error)
                }

                Color.clear.frame(height: 40)
            }
        }
        .scrollDismissesKeyboard(.immediately)
        .sheet(isPresented: $showStatusPicker) {
            statusPickerSheet
                .presentationDetents([.medium])
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
            ModalHeader(title: "Status", onDismiss: { showStatusPicker = false })

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

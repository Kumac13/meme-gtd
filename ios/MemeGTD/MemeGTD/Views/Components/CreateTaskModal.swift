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
        FormNavigationRow(title: "Status", action: { showStatusPicker = true }) {
            Text(viewModel.status.displayLabel)
                .font(.system(size: 15))
                .foregroundColor(.textSecondary)
        }
    }

    // MARK: - Kind Row

    private var kindRow: some View {
        SegmentedFormRow(
            title: "Kind",
            options: TaskKind.allCases,
            selected: $viewModel.taskKind,
            label: { $0.displayLabel }
        )
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
        FormNavigationRow(title: "Links", action: { showLinkPicker = true }) {
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
            } else {
                EmptyFormSelection()
            }
        }
    }

    // MARK: - Status Picker Sheet

    private var statusPickerSheet: some View {
        SingleChoiceFilterSheet(
            title: "Status",
            options: TaskStatus.allCases,
            selected: viewModel.status,
            label: { $0.displayLabel },
            onSelect: { status in
                viewModel.status = status
                showStatusPicker = false
            },
            onDismiss: { showStatusPicker = false }
        )
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

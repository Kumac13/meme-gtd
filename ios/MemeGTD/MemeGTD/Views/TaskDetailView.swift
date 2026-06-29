import PhotosUI
import SwiftUI

struct TaskDetailView: View {
    let taskId: Int
    let initialTitle: String?
    let onMenuTap: () -> Void
    var onNavigateToLinkedIssue: ((Int, String, String) -> Void)?

    @EnvironmentObject var taskStore: TaskStore
    @StateObject private var viewModel: TaskDetailViewModel
    @Environment(\.dismiss) private var dismiss
    @State private var showDeleteConfirm: Bool = false
    @State private var showInfoSheet: Bool = false
    @State private var showCopiedFeedback: Bool = false
    @State private var showStatusPicker: Bool = false
    @State private var editingMode: EditingMode = .none
    @State private var createTaskMode: CreateTaskMode? = nil
    @State private var showImagePicker: Bool = false
    @State private var showSizePicker: Bool = false
    @State private var isUploadingImage: Bool = false
    @State private var pickedImageData: Data? = nil
    @State private var pickedMimeType: String = "image/jpeg"
    @State private var pickedExtension: String = "jpg"

    enum EditingMode: Equatable {
        case none
        case title
        case body
        case comment(Int)
    }

    init(taskId: Int, initialTitle: String? = nil, onMenuTap: @escaping () -> Void, onNavigateToLinkedIssue: ((Int, String, String) -> Void)? = nil) {
        self.taskId = taskId
        self.initialTitle = initialTitle
        self.onMenuTap = onMenuTap
        self.onNavigateToLinkedIssue = onNavigateToLinkedIssue
        self._viewModel = StateObject(wrappedValue: TaskDetailViewModel(taskId: taskId))
    }

    var body: some View {
        GeometryReader { geo in
        ScrollViewReader { proxy in
            ScrollView {
                LazyVStack(spacing: 0) {
                    if let task = viewModel.task {
                        // === Title Area (glass, extends to top of screen) ===
                        areaCard {
                            TaskTitleSection(
                                title: task.title,
                                status: task.status,
                                onStatusTap: { showStatusPicker = true }
                            )
                            .padding(.top, geo.safeAreaInsets.top)
                        }

                        // --- Connector line ---
                        sectionConnector

                        // === Body Area (glass, full width) ===
                        areaCard {
                            VStack(alignment: .leading, spacing: 0) {
                                // Timestamp + menu
                                HStack {
                                    HStack(spacing: 4) {
                                        let isEdited = task.updatedAt != task.createdAt
                                        Text(TimelineHelpers.relativeTimeString(iso: isEdited ? task.updatedAt : task.createdAt))
                                        if isEdited {
                                            Text("(edited)")
                                        }
                                    }
                                    .font(.system(size: 11))
                                    .foregroundColor(Color(.systemGray))

                                    Spacer()

                                    Menu {
                                        Button(action: {
                                            UIPasteboard.general.string = task.bodyMd
                                            HapticManager.notification(.success)
                                        }) {
                                            Label("Copy", systemImage: "doc.on.doc")
                                        }
                                        Button(action: {
                                            viewModel.replyBody = task.bodyMd.isEmpty ? "" : task.bodyMd
                                            editingMode = .body
                                        }) {
                                            Label("Edit", systemImage: "pencil")
                                        }
                                    } label: {
                                        Image(systemName: "ellipsis")
                                            .font(.system(size: 13))
                                            .foregroundColor(.textSecondary)
                                            .frame(width: 28, height: 20)
                                            .contentShape(Rectangle())
                                    }
                                }
                                .padding(.horizontal, 16)
                                .padding(.top, 8)
                                .padding(.bottom, -2)

                                if !task.bodyMd.isEmpty {
                                    ThreadItem(
                                        bodyMd: task.bodyMd,
                                        labels: nil,
                                        showMenu: false,
                                        onIssueTap: { id, type in
                                            onNavigateToLinkedIssue?(id, type, "")
                                        }
                                    )
                                } else {
                                    Text("No description provided.")
                                        .font(.system(size: 14))
                                        .foregroundColor(.textSecondary)
                                        .italic()
                                        .frame(maxWidth: .infinity, alignment: .leading)
                                        .padding(.vertical, 10)
                                        .padding(.horizontal, 16)
                                }
                            }
                        }

                        // === Timeline: Comments + Activities interleaved ===
                        ForEach(viewModel.timelineEntries) { entry in
                            sectionConnector

                            switch entry {
                            case .comment(let comment):
                                areaCard {
                                    VStack(alignment: .leading, spacing: 0) {
                                        HStack {
                                            HStack(spacing: 4) {
                                                let isEdited = comment.updatedAt != comment.createdAt
                                                Text(TimelineHelpers.relativeTimeString(iso: isEdited ? comment.updatedAt : comment.createdAt))
                                                if isEdited {
                                                    Text("(edited)")
                                                }
                                            }
                                            .font(.system(size: 11))
                                            .foregroundColor(Color(.systemGray))

                                            Spacer()

                                            Menu {
                                                Button(action: {
                                                    UIPasteboard.general.string = comment.bodyMd
                                                    HapticManager.notification(.success)
                                                }) {
                                                    Label("Copy", systemImage: "doc.on.doc")
                                                }
                                                Button(action: {
                                                    viewModel.replyBody = comment.bodyMd
                                                    editingMode = .comment(comment.id)
                                                }) {
                                                    Label("Edit", systemImage: "pencil")
                                                }
                                                Button(role: .destructive, action: {
                                                    Task { await viewModel.deleteComment(comment.id) }
                                                }) {
                                                    Label("Delete", systemImage: "trash")
                                                }
                                            } label: {
                                                Image(systemName: "ellipsis")
                                                    .font(.system(size: 13))
                                                    .foregroundColor(.textSecondary)
                                                    .frame(width: 28, height: 20)
                                                    .contentShape(Rectangle())
                                            }
                                        }
                                        .padding(.horizontal, 16)
                                        .padding(.top, 8)
                                        .padding(.bottom, -2)

                                        ThreadItem(
                                            bodyMd: comment.bodyMd,
                                            labels: nil,
                                            showMenu: false,
                                            onIssueTap: { id, type in
                                                onNavigateToLinkedIssue?(id, type, "")
                                            }
                                        )
                                    }
                                }

                            case .activity(let activity):
                                ActivityItemView(activity: activity, issueId: taskId)
                            }
                        }
                    }

                    Color.clear.frame(height: 24)
                        .id("threadBottom")
                }
            }
            .background(Color.menuBackground)
            .scrollDismissesKeyboard(.immediately)
            .ignoresSafeArea(edges: .top)
            .scrollEdgeEffectStyle(.soft, for: .bottom)
            .refreshable {
                await withCheckedContinuation { continuation in
                    Task { @MainActor in
                        HapticManager.impact(.medium)

                        let start = Date()
                        let result = await viewModel.fetchTask()

                        let elapsed = Date().timeIntervalSince(start)
                        let remaining = 0.75 - elapsed
                        if remaining > 0 {
                            try? await Task.sleep(nanoseconds: UInt64(remaining * 1_000_000_000))
                        }

                        if let (task, comments, activities) = result {
                            viewModel.applyTask(task, comments: comments, activities: activities)
                        }
                        HapticManager.notification(.success)
                        continuation.resume()
                    }
                }
            }
            .onChange(of: viewModel.timelineEntries.count) { _ in
                withAnimation {
                    proxy.scrollTo("threadBottom", anchor: .bottom)
                }
            }
            .safeAreaBar(edge: .bottom) {
                FloatingComposer(
                    text: $viewModel.replyBody,
                    placeholder: composerPlaceholder,
                    disabled: viewModel.isLoading,
                    submitting: viewModel.isSubmittingReply,
                    notice: composerNotice,
                    onDismissNotice: {
                        editingMode = .none
                        viewModel.replyBody = ""
                    },
                    onAttachImage: { showImagePicker = true },
                    isUploadingImage: isUploadingImage,
                    onExpand: {
                        DispatchQueue.main.asyncAfter(deadline: .now() + 0.1) {
                            withAnimation { proxy.scrollTo("threadBottom", anchor: .bottom) }
                        }
                    },
                    onSubmit: {
                        switch editingMode {
                        case .title:
                            Task {
                                await viewModel.updateTask(title: viewModel.replyBody)
                                editingMode = .none
                                viewModel.replyBody = ""
                            }
                        case .body:
                            Task {
                                await viewModel.updateTask(bodyMd: viewModel.replyBody)
                                editingMode = .none
                                viewModel.replyBody = ""
                            }
                        case .comment(let commentId):
                            Task {
                                await viewModel.updateComment(commentId, bodyMd: viewModel.replyBody)
                                editingMode = .none
                                viewModel.replyBody = ""
                            }
                        case .none:
                            Task { await viewModel.addComment() }
                        }
                    }
                )
                .padding(.horizontal, 16)
                .padding(.bottom, 10)
            }
        }
        .enableSwipeBack()
        .navigationBarBackButtonHidden(true)
        .toolbar {
            AppToolbar(
                title: toolbarTitle,
                onMenuTap: onMenuTap,
                titleLineLimit: 1,
                trailing: {
                    Button(action: {
                        HapticManager.impact(.light)
                        showInfoSheet = true
                    }) {
                        Image(systemName: "ellipsis")
                            .font(.system(size: 17, weight: .medium))
                            .foregroundColor(.textPrimary)
                    }
                }
            )
        }
        .navigationBarTitleDisplayMode(.inline)
        .sheet(isPresented: $showInfoSheet) {
            IssueInfoSheet(
                viewModel: viewModel,
                showCopiedFeedback: $showCopiedFeedback,
                onEditTitle: {
                    if let task = viewModel.task {
                        viewModel.replyBody = task.title
                        editingMode = .title
                    }
                },
                onDelete: { showDeleteConfirm = true },
                onNewTask: {
                    createTaskMode = CreateTaskMode(kind: .linkedTo(sourceTaskId: taskId))
                },
                onAddChild: {
                    if let task = viewModel.task {
                        createTaskMode = CreateTaskMode(kind: .quickChild(
                            parentTask: task,
                            parentProjects: viewModel.associatedProjects,
                            parentLabels: task.labels
                        ))
                    }
                },
                onNavigateToIssue: { target in
                    onNavigateToLinkedIssue?(target.id, target.type, target.title)
                },
                labelCountKeyPath: \.taskCount
            )
            .presentationDetents([.fraction(0.7), .large])
        }
        .sheet(isPresented: $showStatusPicker) {
            statusPickerSheet
                .presentationDetents([.medium])
        }
        .sheet(item: $createTaskMode) { mode in
            CreateTaskModal(
                mode: mode.kind,
                onCreated: { _ in
                    Task { await viewModel.loadTask() }
                },
                onDismiss: { createTaskMode = nil }
            )
            .presentationDetents([.large])
        }
        .sheet(isPresented: $showImagePicker) {
            ImagePicker(
                imageData: $pickedImageData,
                imageMimeType: $pickedMimeType,
                imageExtension: $pickedExtension
            )
        }
        .alert("Delete Task", isPresented: $showDeleteConfirm) {
            Button("Cancel", role: .cancel) {}
            Button("Delete", role: .destructive) {
                Task {
                    if await viewModel.deleteTask() {
                        dismiss()
                    }
                }
            }
        } message: {
            Text("Are you sure you want to delete this task? This action cannot be undone.")
        }
        .onChange(of: pickedImageData) { _, newData in
            guard newData != nil else { return }
            showSizePicker = true
        }
        .sheet(isPresented: $showSizePicker) {
            if let data = pickedImageData {
                ImageSizePickerSheet(
                    imageData: data,
                    mimeType: pickedMimeType,
                    ext: pickedExtension,
                    onSelect: { resizedData, mime, ext in
                        showSizePicker = false
                        pickedImageData = nil
                        isUploadingImage = true
                        HapticManager.impact(.medium)
                        Task { await uploadImageData(data: resizedData, mimeType: mime, ext: ext) }
                    },
                    onCancel: {
                        showSizePicker = false
                        pickedImageData = nil
                    }
                )
                .presentationDetents([.medium])
            }
        }
        .overlay {
            if viewModel.isLoading && viewModel.task == nil {
                ProgressView("Loading...")
                    .foregroundColor(.textSecondary)
            }
        }
        .task {
            viewModel.taskStore = taskStore
            await viewModel.loadTask()
        }
        } // GeometryReader
    }

    // MARK: - Toolbar title

    private var toolbarTitle: String {
        let title = viewModel.task?.title ?? initialTitle ?? "#\(String(taskId))"
        return title
    }

    // MARK: - Area card (glass effect, full width, no rounded corners)

    private func areaCard<Content: View>(@ViewBuilder content: () -> Content) -> some View {
        content()
            .frame(maxWidth: .infinity)
            .glassEffect(.regular, in: Rectangle())
    }

    // MARK: - Image upload

    private func uploadImageData(data: Data, mimeType: String, ext: String) async {
        isUploadingImage = true
        defer { isUploadingImage = false }

        let filename = "\(UUID().uuidString).\(ext)"
        let start = Date()

        do {
            let response = try await APIClient.shared.uploadImage(
                imageData: data, filename: filename, mimeType: mimeType
            )

            let elapsed = Date().timeIntervalSince(start)
            let remaining = 0.75 - elapsed
            if remaining > 0 {
                try? await Task.sleep(nanoseconds: UInt64(remaining * 1_000_000_000))
            }

            let ref = response.markdownRef
            if viewModel.replyBody.isEmpty {
                viewModel.replyBody = ref
            } else {
                viewModel.replyBody += "\n\(ref)"
            }
            HapticManager.notification(.success)
        } catch {
            HapticManager.notification(.error)
        }
    }

    // MARK: - Composer helpers

    private var composerPlaceholder: String {
        switch editingMode {
        case .title: return "Edit title..."
        case .body: return "Edit body..."
        case .comment: return "Edit..."
        case .none: return "Add a comment..."
        }
    }

    private var composerNotice: String? {
        switch editingMode {
        case .title: return "Editing title"
        case .body: return "Editing body"
        case .comment: return "Editing comment"
        case .none: return nil
        }
    }

    // MARK: - Section connector (line between areas)

    private var sectionConnector: some View {
        Rectangle()
            .fill(Color(.systemGray3))
            .frame(width: 2, height: 12)
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.leading, 24)
    }

    // MARK: - Status Picker Sheet

    private var statusPickerSheet: some View {
        let statuses: [TaskStatusFilter] = [
            .inbox, .open, .next, .waiting, .scheduled, .someday, .done, .canceled,
        ]

        return VStack(spacing: 0) {
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
                    ForEach(statuses, id: \.self) { status in
                        let isSelected = viewModel.task?.status == status.rawValue
                        Button(action: {
                            HapticManager.selection()
                            Task {
                                await viewModel.updateTask(status: status.rawValue)
                            }
                            showStatusPicker = false
                        }) {
                            HStack {
                                Text(status.displayLabel)
                                    .font(.system(size: 16))
                                    .foregroundColor(.textPrimary)
                                Spacer()
                                if isSelected {
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
}

import Combine
import PhotosUI
import SwiftUI

struct MemoListView: View {
    let onMenuTap: () -> Void
    @Binding var navigationPath: NavigationPath

    @EnvironmentObject var memoStore: MemoStore
    @EnvironmentObject var dataSources: DataSourceProvider
    @StateObject private var viewModel = MemoListViewModel()
    @State private var isSearching: Bool = false
    @State private var showLabelPicker: Bool = false
    @State private var selectedLabelNames: Set<String> = []
    @State private var showProjectPicker: Bool = false
    @State private var selectedProjectIds: Set<Int> = []
    @State private var selectedNoProject: Bool = false
    @State private var showDateRangePicker: Bool = false
    @State private var dateFrom: Date?
    @State private var dateTo: Date?
    @State private var showImagePicker: Bool = false
    @State private var showSizePicker: Bool = false
    @State private var isUploadingImage: Bool = false
    @State private var pickedImageData: Data? = nil
    @State private var pickedMimeType: String = "image/jpeg"
    @State private var pickedExtension: String = "jpg"
    @State private var showCopyDialog: Bool = false
    @State private var conflictToastMessage: String?
    @State private var conflictToastDismissTask: Task<Void, Never>?

    private var hasActiveFilters: Bool {
        !viewModel.searchQuery.isEmpty ||
        !viewModel.labelFilters.isEmpty ||
        !viewModel.projectFilters.isEmpty ||
        viewModel.includeNoProject ||
        viewModel.bookmarkFilter ||
        viewModel.createdFrom != nil ||
        viewModel.createdTo != nil
    }

    /// Standalone Storage Mode: keyword search runs on the local FTS index
    /// (offline support plan Phase 9), but semantic search needs the server's
    /// embedding stack, so the search-mode picker is hidden (keyword-only).
    private var isStandalone: Bool {
        Settings.shared.appMode == .standalone
    }

    /// LazyVStack under defaultScrollAnchor(.bottom) fails to materialize its
    /// cells when the view is CREATED with content already present (tab
    /// return; iOS 26 — the list stays blank until a scroll gesture forces a
    /// layout pass). First launch works because content arrives after the
    /// first empty layout. This flag reproduces that working order: the first
    /// frame renders empty, then `.task` flips it and the rows come in
    /// through the insertion path.
    @State private var renderContent = false

    private var reversedMemos: [Memo] {
        guard renderContent else { return [] }
        if viewModel.searchMode == .semantic && isSearching {
            return memoStore.memos
        }
        // Date filter fetches ascending from the API (see buildListQueryItems),
        // so the array already runs oldest → newest. Keep order; otherwise the
        // API's newest-first array gets reversed for the chat-style layout.
        if viewModel.isDateFiltered {
            return memoStore.memos
        }
        return memoStore.memos.reversed()
    }

    var body: some View {
        ScrollViewReader { proxy in
                ScrollView {
                    LazyVStack(spacing: 0) {
                        if renderContent && !memoStore.hasMore && !memoStore.memos.isEmpty {
                        Text("No older memos")
                            .font(.caption)
                            .foregroundColor(Color(.systemGray))
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 12)
                    }

                    ForEach(Array(reversedMemos.enumerated()), id: \.element.id) { index, memo in
                        let previousMemo = index > 0 ? reversedMemos[index - 1] : nil

                        let currentBucket = TimelineHelpers.getTimelineDateBucket(iso: memo.createdAt)
                        let previousBucket = previousMemo.map { TimelineHelpers.getTimelineDateBucket(iso: $0.createdAt) }
                        let bucketChanged = previousBucket == nil || currentBucket != previousBucket

                        if bucketChanged {
                            TimelineDateHeader(bucket: currentBucket)
                        }

                        let showTimestamp = bucketChanged || TimelineHelpers.shouldShowGapTimestamp(
                            previousIso: previousMemo?.createdAt,
                            currentIso: memo.createdAt
                        )

                        if showTimestamp {
                            TimelineTimestamp(text: TimelineHelpers.formatTimelineTime(iso: memo.createdAt))
                        }

                        Button(action: {
                            HapticManager.selection()
                            navigationPath.append(MemoRoute(memoId: memo.id, initialBody: memo.bodyMd))
                        }) {
                            VStack(alignment: .leading, spacing: 0) {
                                MemoTimelineItem(
                                    memo: memo,
                                    snippet: viewModel.searchMatchInfos[memo.id],
                                    searchQuery: viewModel.searchMode == .keyword && !viewModel.searchQuery.isEmpty ? viewModel.searchQuery : nil
                                )
                                if let score = viewModel.relevanceScores[memo.id] {
                                    RelevanceBar(score: score)
                                        .padding(.top, 4)
                                }
                            }
                        }
                        .buttonStyle(.plain)
                        .padding(.horizontal, 16)
                    }

                    Color.clear.frame(height: 1)
                        .id("bottom")
                }
            }
            .scrollDismissesKeyboard(.immediately)
            .scrollEdgeEffectStyle(.soft, for: .bottom)
            .defaultScrollAnchor(viewModel.isDateFiltered ? .top : .bottom)
            // Recreate the ScrollView when the filter mode toggles so the
            // initial scroll offset is taken from defaultScrollAnchor again
            // (.top for filtered → oldest at top; .bottom for the chat-style
            // unfiltered feed). Without this, the prior mode's pixel offset
            // bleeds into the new mode and lands the user mid-list.
            .id(viewModel.isDateFiltered ? "filtered" : "feed")
            .issueListRefreshable {
                // Sync trigger: pull-to-refresh (no-op while Offline Sync is off).
                dataSources.syncScheduler?.requestSync()

                if viewModel.isDateFiltered {
                    await viewModel.loadAllMemos()
                    return
                }

                let hasMore = memoStore.hasMore
                let response = hasMore
                    ? await viewModel.fetchOlderMemos()
                    : await viewModel.fetchMemos()

                if let response {
                    if hasMore {
                        viewModel.applyOlderMemos(response)
                    } else {
                        viewModel.applyMemos(response)
                    }
                }
            }
            .task {
                viewModel.store = memoStore
                viewModel.dataSources = dataSources
                // Memos render first: labels/projects only feed the filter
                // pickers, and awaiting them before the list fetch left the
                // screen blank for up to two 60s request timeouts whenever the
                // connection was re-establishing (e.g. Tailscale after app
                // relaunch). They now load concurrently after the list kicks
                // off.
                if memoStore.memos.isEmpty {
                    renderContent = true
                    await viewModel.loadMemos()
                    DispatchQueue.main.asyncAfter(deadline: .now() + 0.1) {
                        withAnimation {
                            proxy.scrollTo("bottom", anchor: .bottom)
                        }
                    }
                } else {
                    // Tab return with existing content: inject the rows AFTER
                    // the first (empty) layout pass so the LazyVStack takes
                    // the same insertion path as first launch (see
                    // renderContent), then re-anchor to the newest memo.
                    renderContent = true
                    DispatchQueue.main.asyncAfter(deadline: .now() + 0.1) {
                        proxy.scrollTo("bottom", anchor: .bottom)
                    }
                }
                async let labels: Void = viewModel.loadLabels()
                async let projects: Void = viewModel.loadProjects()
                _ = await (labels, projects)
            }
            .safeAreaBar(edge: .bottom) {
                FloatingComposer(
                    text: $viewModel.newMemoBody,
                    placeholder: "Write a memo...",
                    disabled: viewModel.isLoading,
                    submitting: viewModel.isCreating,
                    onAttachImage: { showImagePicker = true },
                    isUploadingImage: isUploadingImage,
                    onExpand: {
                        DispatchQueue.main.asyncAfter(deadline: .now() + 0.1) {
                            withAnimation { proxy.scrollTo("bottom", anchor: .bottom) }
                        }
                        DispatchQueue.main.asyncAfter(deadline: .now() + 0.35) {
                            withAnimation { proxy.scrollTo("bottom", anchor: .bottom) }
                        }
                    },
                    onSubmit: {
                        Task {
                            await viewModel.createMemo()
                            DispatchQueue.main.asyncAfter(deadline: .now() + 0.05) {
                                withAnimation {
                                    proxy.scrollTo("bottom", anchor: .bottom)
                                }
                            }
                        }
                    }
                )
                .padding(.horizontal, 16)
                .padding(.bottom, 10)
                .opacity(isSearching ? 0 : 1)
                .allowsHitTesting(!isSearching)
            }
        }
        .safeAreaInset(edge: .top) {
            VStack(spacing: 4) {
                // Standalone: semantic search is server-only, so the mode
                // picker is hidden and search stays on its keyword default.
                if isSearching && !isStandalone {
                    IssueSearchModePicker(
                        selection: $viewModel.searchMode,
                        verticalPadding: 0
                    ) {
                        if viewModel.isSearching {
                            viewModel.search()
                        }
                    }
                }

                IssueListFilterBar {
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
                        isActive: viewModel.createdFrom != nil || viewModel.createdTo != nil
                    ) {
                        dateFrom = viewModel.createdFrom
                        dateTo = viewModel.createdTo
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
        .toolbar {
            AppToolbar(
                title: "Memos",
                onMenuTap: onMenuTap,
                isSearching: $isSearching,
                searchQuery: $viewModel.searchQuery,
                searchPlaceholder: "Search memos...",
                onSearch: { viewModel.search() },
                searchBarAction: {
                    IssueListExportButton(
                        isVisible: !memoStore.memos.isEmpty && hasActiveFilters,
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
        .overlay(alignment: .top) {
            if let conflictToastMessage {
                FeedbackToast(message: conflictToastMessage)
            }
        }
        .animation(.easeInOut(duration: 0.2), value: conflictToastMessage)
        .onReceive(
            NotificationCenter.default
                .publisher(for: .syncEngineDidChangeData)
                .receive(on: DispatchQueue.main)
        ) { notification in
            // Conflict surfacing: a sync run whose push produced conflicted
            // copies announces the count via userInfo; the copies themselves
            // arrive through the run's pull and the regular list reload.
            guard let count = notification.userInfo?[SyncEngine.conflictCopiedUserInfoKey] as? Int,
                  count > 0 else { return }
            conflictToastMessage = count == 1
                ? "1 conflicted copy created"
                : "\(count) conflicted copies created"
            conflictToastDismissTask?.cancel()
            conflictToastDismissTask = Task {
                try? await Task.sleep(nanoseconds: 4_000_000_000)
                guard !Task.isCancelled else { return }
                conflictToastMessage = nil
            }
        }
        .navigationBarTitleDisplayMode(.inline)
        .onChange(of: memoStore.needsReload) { _, needsReload in
            if needsReload {
                memoStore.needsReload = false
                viewModel.reload()
            }
        }
        .issueListSearchLifecycle(isSearching: isSearching)
        .sheet(isPresented: $showLabelPicker, onDismiss: {
            viewModel.setLabelFilters(selectedLabelNames)
        }) {
            LabelPickerModal(
                allLabels: viewModel.allLabels,
                selectedNames: $selectedLabelNames,
                onDismiss: { showLabelPicker = false },
                showClear: true,
                countFor: { $0.memoCount },
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
        .sheet(isPresented: $showImagePicker) {
            ImagePicker(
                imageData: $pickedImageData,
                imageMimeType: $pickedMimeType,
                imageExtension: $pickedExtension
            )
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
            LoadingOverlay(
                isPresented: viewModel.isLoading && memoStore.memos.isEmpty,
                message: "Loading memos..."
            )
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
        DateFilterHelpers.displayLabel(from: viewModel.createdFrom, to: viewModel.createdTo)
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

            // Ensure uploading indicator is visible for at least 0.75s
            let elapsed = Date().timeIntervalSince(start)
            let remaining = 0.75 - elapsed
            if remaining > 0 {
                try? await Task.sleep(nanoseconds: UInt64(remaining * 1_000_000_000))
            }

            let ref = response.markdownRef
            if viewModel.newMemoBody.isEmpty {
                viewModel.newMemoBody = ref
            } else {
                viewModel.newMemoBody += "\n\(ref)"
            }
            HapticManager.notification(.success)
        } catch {
            HapticManager.notification(.error)
        }
    }
}

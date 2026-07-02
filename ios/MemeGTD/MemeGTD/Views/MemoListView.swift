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

    private var hasActiveFilters: Bool {
        !viewModel.searchQuery.isEmpty ||
        !viewModel.labelFilters.isEmpty ||
        !viewModel.projectFilters.isEmpty ||
        viewModel.includeNoProject ||
        viewModel.bookmarkFilter ||
        viewModel.createdFrom != nil ||
        viewModel.createdTo != nil
    }

    private var reversedMemos: [Memo] {
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
                        if !memoStore.hasMore && !memoStore.memos.isEmpty {
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
            .refreshable {
                await withCheckedContinuation { continuation in
                    Task { @MainActor in
                        HapticManager.impact(.medium)

                        let start = Date()

                        if viewModel.isDateFiltered {
                            // Schedule filter active: keep the full filtered
                            // range loaded instead of resetting to the newest
                            // page. loadAllMemos updates the store directly.
                            await viewModel.loadAllMemos()

                            let elapsed = Date().timeIntervalSince(start)
                            let remaining = 0.75 - elapsed
                            if remaining > 0 {
                                try? await Task.sleep(nanoseconds: UInt64(remaining * 1_000_000_000))
                            }
                            HapticManager.notification(.success)
                            continuation.resume()
                            return
                        }

                        let hasMore = memoStore.hasMore
                        let response: MemoListResponse?
                        if hasMore {
                            response = await viewModel.fetchOlderMemos()
                        } else {
                            response = await viewModel.fetchMemos()
                        }

                        let elapsed = Date().timeIntervalSince(start)
                        let remaining = 0.75 - elapsed
                        if remaining > 0 {
                            try? await Task.sleep(nanoseconds: UInt64(remaining * 1_000_000_000))
                        }

                        if let response = response {
                            if hasMore {
                                viewModel.applyOlderMemos(response)
                            } else {
                                viewModel.applyMemos(response)
                            }
                        }
                        HapticManager.notification(.success)
                        continuation.resume()
                    }
                }
            }
            .task {
                viewModel.store = memoStore
                viewModel.dataSources = dataSources
                await viewModel.loadLabels()
                await viewModel.loadProjects()
                if memoStore.memos.isEmpty {
                    await viewModel.loadMemos()
                    DispatchQueue.main.asyncAfter(deadline: .now() + 0.1) {
                        withAnimation {
                            proxy.scrollTo("bottom", anchor: .bottom)
                        }
                    }
                }
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
                if isSearching {
                    Picker("Search Mode", selection: $viewModel.searchMode) {
                        ForEach(SearchMode.allCases, id: \.self) { mode in
                            Text(mode.rawValue).tag(mode)
                        }
                    }
                    .pickerStyle(.segmented)
                    .background(.regularMaterial, in: Capsule())
                    .padding(.horizontal, 16)
                    .onChange(of: viewModel.searchMode) { _, _ in
                        if viewModel.isSearching {
                            viewModel.search()
                        }
                    }
                }

                HStack(spacing: 8) {
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
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.horizontal, 16)
            .padding(.vertical, 8)
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
                    if !memoStore.memos.isEmpty && hasActiveFilters {
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
        .onChange(of: memoStore.needsReload) { _, needsReload in
            if needsReload {
                memoStore.needsReload = false
                viewModel.reload()
            }
        }
        .onChange(of: isSearching) { _, newValue in
            if !newValue {
                UIApplication.shared.sendAction(#selector(UIResponder.resignFirstResponder), to: nil, from: nil, for: nil)
            }
        }
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
            if viewModel.isLoading && memoStore.memos.isEmpty {
                ProgressView("Loading memos...")
                    .foregroundColor(.textSecondary)
            }
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

import PhotosUI
import SwiftUI

struct MemoListView: View {
    let onMenuTap: () -> Void
    @Binding var navigationPath: NavigationPath

    @EnvironmentObject var memoStore: MemoStore
    @StateObject private var viewModel = MemoListViewModel()
    @State private var isSearching: Bool = false
    @State private var showLabelPicker: Bool = false
    @State private var selectedLabelNames: Set<String> = []
    @State private var showImagePicker: Bool = false
    @State private var showSizePicker: Bool = false
    @State private var isUploadingImage: Bool = false
    @State private var pickedImageData: Data? = nil
    @State private var pickedMimeType: String = "image/jpeg"
    @State private var pickedExtension: String = "jpg"

    private var reversedMemos: [Memo] {
        memoStore.memos.reversed()
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
                            MemoTimelineItem(memo: memo)
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
            .refreshable {
                await withCheckedContinuation { continuation in
                    Task { @MainActor in
                        HapticManager.impact(.medium)

                        let start = Date()
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
                await viewModel.loadLabels()
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
            HStack(spacing: 8) {
                filterPill(
                    label: labelFilterDisplayLabel,
                    isActive: !viewModel.labelFilters.isEmpty
                ) {
                    selectedLabelNames = viewModel.labelFilters
                    showLabelPicker = true
                }

                bookmarkPill

                Spacer()
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 8)
        }
        .toolbar {
            AppToolbar(
                title: "Memos",
                onMenuTap: onMenuTap,
                isSearching: $isSearching,
                searchQuery: $viewModel.searchQuery,
                searchPlaceholder: "Search memos...",
                onSearch: { viewModel.search() }
            )
        }
        .navigationBarTitleDisplayMode(.inline)
        .onChange(of: memoStore.needsReload) { _, needsReload in
            if needsReload {
                memoStore.needsReload = false
                Task { await viewModel.loadMemos() }
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
                countFor: { $0.memoCount }
            )
            .presentationDetents([.medium, .large])
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

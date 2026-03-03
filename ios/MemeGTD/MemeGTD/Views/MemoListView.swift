import SwiftUI

struct MemoListView: View {
    let onMenuTap: () -> Void
    @Binding var navigationPath: NavigationPath

    @StateObject private var viewModel = MemoListViewModel()
    @State private var showSearchFilter = false

    private var reversedMemos: [Memo] {
        viewModel.memos.reversed()
    }

    var body: some View {
        ScrollViewReader { proxy in
            ScrollView {
                LazyVStack(spacing: 0) {
                    // Active filter chips
                    if viewModel.filterState.hasActiveFilters {
                        activeFilterChips
                    }

                    if !viewModel.hasMore && !viewModel.memos.isEmpty {
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
                // .refreshable cancels its Task when the user lifts their finger,
                // which cancels URLSession requests. Use a detached continuation
                // to keep the network call alive.
                await withCheckedContinuation { continuation in
                    Task { @MainActor in
                        HapticManager.impact(.medium)

                        let start = Date()
                        let hasMore = viewModel.hasMore
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
            .onAppear {
                if viewModel.memos.isEmpty {
                    Task {
                        async let memosLoad: () = viewModel.loadMemos()
                        async let labelsLoad: () = viewModel.loadLabels()
                        _ = await (memosLoad, labelsLoad)
                        DispatchQueue.main.asyncAfter(deadline: .now() + 0.1) {
                            withAnimation {
                                proxy.scrollTo("bottom", anchor: .bottom)
                            }
                        }
                    }
                }
            }
            .safeAreaBar(edge: .bottom) {
                BottomBar(
                    memoText: $viewModel.newMemoBody,
                    isLoading: viewModel.isLoading,
                    isCreating: viewModel.isCreating,
                    hasActiveFilters: viewModel.filterState.hasActiveFilters,
                    onCreateMemo: {
                        Task {
                            await viewModel.createMemo()
                            DispatchQueue.main.asyncAfter(deadline: .now() + 0.05) {
                                withAnimation {
                                    proxy.scrollTo("bottom", anchor: .bottom)
                                }
                            }
                        }
                    },
                    onSearchTap: {
                        HapticManager.impact(.light)
                        showSearchFilter = true
                    }
                )
                .padding(.horizontal, 16)
                .padding(.bottom, 10)
            }
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
                Text("Memos")
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
            if viewModel.isLoading && viewModel.memos.isEmpty {
                ProgressView("Loading memos...")
                    .foregroundColor(.textSecondary)
            }
        }
        .sheet(isPresented: $showSearchFilter) {
            SearchFilterModal(
                config: SearchFilterConfig(showLabels: true, showDateFilter: true),
                allLabels: viewModel.allLabels,
                currentState: viewModel.filterState,
                onDismiss: { showSearchFilter = false },
                onApply: { newState in
                    viewModel.applyFilters(newState)
                    showSearchFilter = false
                }
            )
            .presentationDetents([.medium, .large])
        }
    }

    // MARK: - Active filter chips

    private var activeFilterChips: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 6) {
                let searchText = viewModel.filterState.searchText.trimmingCharacters(in: .whitespaces)
                if !searchText.isEmpty {
                    filterChip(
                        label: searchText,
                        icon: "magnifyingglass",
                        onRemove: { viewModel.removeSearchFilter() }
                    )
                }

                ForEach(viewModel.filterState.selectedLabels.sorted(), id: \.self) { label in
                    filterChip(
                        label: label,
                        bgColor: LabelColorHelper.bgColor(for: label),
                        fgColor: LabelColorHelper.textColor(for: label),
                        onRemove: { viewModel.removeLabelFilter(label) }
                    )
                }

                if let dateFrom = viewModel.filterState.dateFrom {
                    filterChip(
                        label: "From: \(dateFrom.formatted(.dateTime.month(.abbreviated).day()))",
                        icon: "calendar",
                        onRemove: { viewModel.removeDateFromFilter() }
                    )
                }

                if let dateTo = viewModel.filterState.dateTo {
                    filterChip(
                        label: "To: \(dateTo.formatted(.dateTime.month(.abbreviated).day()))",
                        icon: "calendar",
                        onRemove: { viewModel.removeDateToFilter() }
                    )
                }
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 8)
        }
    }

    private func filterChip(
        label: String,
        icon: String? = nil,
        bgColor: Color = Color(.systemGray5),
        fgColor: Color = .textPrimary,
        onRemove: @escaping () -> Void
    ) -> some View {
        HStack(spacing: 4) {
            if let icon = icon {
                Image(systemName: icon)
                    .font(.system(size: 10))
            }

            Text(label)
                .font(.system(size: 12, weight: .medium))
                .lineLimit(1)

            Button(action: {
                HapticManager.impact(.light)
                onRemove()
            }) {
                Image(systemName: "xmark")
                    .font(.system(size: 8, weight: .bold))
                    .padding(2)
            }
        }
        .padding(.horizontal, 8)
        .padding(.vertical, 5)
        .background(bgColor)
        .foregroundColor(fgColor)
        .clipShape(Capsule())
    }
}

// MARK: - Bottom Bar (simplified: always compose pill + search icon)

private struct BottomBar: View {
    @Binding var memoText: String
    let isLoading: Bool
    let isCreating: Bool
    let hasActiveFilters: Bool
    let onCreateMemo: () -> Void
    let onSearchTap: () -> Void

    @FocusState private var memoFocused: Bool

    private var canSubmitMemo: Bool {
        !memoText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty && !isLoading && !isCreating
    }

    private let pillRadius: CGFloat = 22

    var body: some View {
        HStack(alignment: .bottom, spacing: 10) {
            // Search icon button (with badge dot when filters active)
            searchButton

            // Compose pill (always visible)
            composePill
        }
    }

    // MARK: - Search button with badge

    private var searchButton: some View {
        Button(action: onSearchTap) {
            ZStack(alignment: .topTrailing) {
                Image(systemName: "magnifyingglass")
                    .font(.system(size: 17, weight: .medium))
                    .foregroundColor(hasActiveFilters ? .accent : Color(.systemGray))
                    .frame(width: 52, height: 52)

                if hasActiveFilters {
                    Circle()
                        .fill(Color.accent)
                        .frame(width: 8, height: 8)
                        .offset(x: -12, y: 14)
                }
            }
        }
        .modifier(PillSurface(radius: 26))
    }

    // MARK: - Compose pill

    private var composePill: some View {
        HStack(alignment: .center, spacing: 0) {
            TextField("Write a memo...", text: $memoText, axis: .vertical)
                .lineLimit(1...5)
                .textFieldStyle(.plain)
                .font(.system(size: 14))
                .tint(Color.accent)
                .textInputAutocapitalization(.never)
                .autocorrectionDisabled()
                .padding(.leading, 16)
                .padding(.trailing, 8)
                .padding(.top, 18)
                .padding(.bottom, 16)
                .focused($memoFocused)
                .disabled(isLoading || isCreating)
                .onSubmit {
                    if canSubmitMemo { onCreateMemo() }
                }

            Button(action: {
                if canSubmitMemo { onCreateMemo() }
            }) {
                Image(systemName: "arrow.up")
                    .font(.system(size: 14, weight: .bold))
                    .foregroundColor(.white)
                    .frame(width: 32, height: 32)
                    .background(canSubmitMemo ? Color.accent : Color(.systemGray4))
                    .clipShape(Circle())
            }
            .disabled(!canSubmitMemo)
            .padding(.trailing, 10)
        }
        .modifier(PillSurface(radius: pillRadius))
    }
}

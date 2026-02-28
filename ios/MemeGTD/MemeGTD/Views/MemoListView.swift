import SwiftUI

enum BottomBarMode {
    case compose
    case search
}

struct MemoListView: View {
    let onMenuTap: () -> Void
    @Binding var navigationPath: NavigationPath

    @StateObject private var viewModel = MemoListViewModel()
    @State private var barMode: BottomBarMode = .compose

    private var reversedMemos: [Memo] {
        viewModel.memos.reversed()
    }

    var body: some View {
        ScrollViewReader { proxy in
            ScrollView {
                LazyVStack(spacing: 0) {
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
                            navigationPath.append(memo.id)
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
                        // 1. トリガー到達ハプティクス
                        HapticManager.impact(.medium)

                        // データを裏で取得（UIには反映しない）
                        let start = Date()
                        let hasMore = viewModel.hasMore
                        let response: MemoListResponse?
                        if hasMore {
                            response = await viewModel.fetchOlderMemos()
                        } else {
                            response = await viewModel.fetchMemos()
                        }

                        // 最低1秒スピナー表示
                        let elapsed = Date().timeIntervalSince(start)
                        let remaining = 0.75 - elapsed
                        if remaining > 0 {
                            try? await Task.sleep(nanoseconds: UInt64(remaining * 1_000_000_000))
                        }

                        // 2. データをUIに反映 + 完了ハプティクス
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
                        await viewModel.loadMemos()
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
                    mode: $barMode,
                    memoText: $viewModel.newMemoBody,
                    searchText: $viewModel.searchQuery,
                    bookmarkFilter: $viewModel.bookmarkFilter,
                    isLoading: viewModel.isLoading,
                    isCreating: viewModel.isCreating,
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
                    onSearch: { viewModel.search() }
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
    }
}

// MARK: - Bottom Bar with animated expand/collapse

private struct BottomBar: View {
    @Binding var mode: BottomBarMode
    @Binding var memoText: String
    @Binding var searchText: String
    @Binding var bookmarkFilter: Bool
    let isLoading: Bool
    let isCreating: Bool
    let onCreateMemo: () -> Void
    let onSearch: () -> Void

    @FocusState private var memoFocused: Bool
    @FocusState private var searchFocused: Bool

    private var isCompose: Bool { mode == .compose }

    private var canSubmitMemo: Bool {
        !memoText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty && !isLoading && !isCreating
    }

    private let pillRadius: CGFloat = 22

    var body: some View {
        HStack(alignment: .bottom, spacing: 10) {
            // Left: search icon (compose mode) OR search pill (search mode)
            if isCompose {
                // Collapsed search icon
                circleButton(systemName: "magnifyingglass") {
                    HapticManager.impact(.light)
                    withAnimation(.spring(response: 0.35, dampingFraction: 0.8)) {
                        mode = .search
                    }
                    DispatchQueue.main.asyncAfter(deadline: .now() + 0.35) {
                        searchFocused = true
                    }
                }
                .transition(.scale.combined(with: .opacity))
            } else {
                // Expanded search pill
                searchPill
                    .transition(.asymmetric(
                        insertion: .scale(scale: 0.5, anchor: .leading).combined(with: .opacity),
                        removal: .scale(scale: 0.5, anchor: .leading).combined(with: .opacity)
                    ))
            }

            // Right: compose pill (compose mode) OR new-memo icon (search mode)
            if isCompose {
                // Expanded compose pill
                composePill
                    .transition(.asymmetric(
                        insertion: .scale(scale: 0.5, anchor: .trailing).combined(with: .opacity),
                        removal: .scale(scale: 0.5, anchor: .trailing).combined(with: .opacity)
                    ))
            } else {
                // Collapsed new-memo icon (accent colored)
                composeButton {
                    HapticManager.impact(.light)
                    withAnimation(.spring(response: 0.35, dampingFraction: 0.8)) {
                        mode = .compose
                    }
                    DispatchQueue.main.asyncAfter(deadline: .now() + 0.35) {
                        memoFocused = true
                    }
                }
                .transition(.scale.combined(with: .opacity))
            }
        }
        .animation(.spring(response: 0.35, dampingFraction: 0.8), value: mode)
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

    // MARK: - Search pill

    private var searchPill: some View {
        HStack(spacing: 8) {
            Image(systemName: "magnifyingglass")
                .font(.system(size: 13))
                .foregroundColor(Color(.systemGray))

            TextField("Search memos...", text: $searchText)
                .textFieldStyle(.plain)
                .font(.system(size: 14))
                .tint(Color.accent)
                .textInputAutocapitalization(.never)
                .autocorrectionDisabled()
                .focused($searchFocused)
                .onSubmit { onSearch() }

            if !searchText.isEmpty {
                Button(action: {
                    searchText = ""
                    onSearch()
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
        .modifier(PillSurface(radius: pillRadius))
    }

    // MARK: - Collapsed search icon button

    private func circleButton(systemName: String, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Image(systemName: systemName)
                .font(.system(size: 17, weight: .medium))
                .foregroundColor(Color(.systemGray))
                .frame(width: 52, height: 52)
        }
        .modifier(PillSurface(radius: 26))
    }

    // MARK: - Accent-colored compose button

    private func composeButton(action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Image(systemName: "doc.text")
                .font(.system(size: 19, weight: .semibold))
                .foregroundColor(.white)
                .frame(width: 52, height: 52)
                .background(Color.accent)
                .clipShape(Circle())
                .shadow(color: Color.accent.opacity(0.3), radius: 6, x: 0, y: 2)
                .shadow(color: .black.opacity(0.06), radius: 2, x: 0, y: 1)
        }
    }
}


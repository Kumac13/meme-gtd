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

    // Memos displayed in reversed order (newest at bottom, like chat)
    private var reversedMemos: [Memo] {
        viewModel.memos.reversed()
    }

    var body: some View {
        ZStack(alignment: .bottom) {
            // Layer 1: Scrollable content
            ScrollViewReader { proxy in
                ScrollView {
                    LazyVStack(spacing: 0) {
                        // "No older memos" indicator
                        if !viewModel.hasMore && !viewModel.memos.isEmpty {
                            Text("No older memos")
                                .font(.caption)
                                .foregroundColor(Color(.systemGray))
                                .frame(maxWidth: .infinity)
                                .padding(.vertical, 12)
                        }

                        // Timeline content
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
                                Text(TimelineHelpers.formatTimelineTime(iso: memo.createdAt))
                                    .font(.system(size: 11))
                                    .foregroundColor(Color(.systemGray))
                                    .frame(maxWidth: .infinity, alignment: .leading)
                                    .padding(.horizontal, 16)
                                    .padding(.top, 8)
                                    .padding(.bottom, 2)
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

                        // Bottom inset for floating bar
                        Color.clear.frame(height: 90)
                            .id("bottom")
                    }
                }
                .scrollDismissesKeyboard(.interactively)
                .refreshable {
                    if viewModel.hasMore {
                        await viewModel.loadOlderMemos()
                    } else {
                        await viewModel.loadMemos()
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
            }

            // Layer 2: Floating bottom bar (switches between compose / search)
            BottomBar(
                mode: $barMode,
                memoText: $viewModel.newMemoBody,
                searchText: $viewModel.searchQuery,
                bookmarkFilter: $viewModel.bookmarkFilter,
                isLoading: viewModel.isLoading,
                isCreating: viewModel.isCreating,
                onCreateMemo: { Task { await viewModel.createMemo() } },
                onSearch: { viewModel.search() }
            )
            .padding(.horizontal, 16)
            .padding(.bottom, 10)
        }
        .background(Color(.systemBackground))
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
                if viewModel.bookmarkFilter {
                    Button(action: {
                        HapticManager.impact(.light)
                        viewModel.toggleBookmarkFilter()
                    }) {
                        Image(systemName: "bookmark.fill")
                            .foregroundColor(.accent)
                    }
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

// MARK: - Bottom Bar (compose/search switch)

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

    private var canSubmitMemo: Bool {
        !memoText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty && !isLoading && !isCreating
    }

    // Shared pill style
    private let pillRadius: CGFloat = 22
    private let pillStroke: CGFloat = 0.5

    var body: some View {
        HStack(alignment: .bottom, spacing: 10) {
            switch mode {
            case .compose:
                // Search icon (collapsed)
                iconButton(systemName: "magnifyingglass") {
                    HapticManager.impact(.light)
                    withAnimation(.easeInOut(duration: 0.25)) {
                        mode = .search
                    }
                    DispatchQueue.main.asyncAfter(deadline: .now() + 0.3) {
                        searchFocused = true
                    }
                }

                // Memo input (expanded)
                composePill

            case .search:
                // Search input (expanded)
                searchPill

                // New memo icon (collapsed)
                iconButton(systemName: "square.and.pencil") {
                    HapticManager.impact(.light)
                    withAnimation(.easeInOut(duration: 0.25)) {
                        mode = .compose
                    }
                    DispatchQueue.main.asyncAfter(deadline: .now() + 0.3) {
                        memoFocused = true
                    }
                }
            }
        }
    }

    // MARK: - Compose pill

    private var composePill: some View {
        ZStack(alignment: .bottomTrailing) {
            TextField("Write a memo...", text: $memoText, axis: .vertical)
                .lineLimit(1...5)
                .textFieldStyle(.plain)
                .font(.system(size: 14))
                .padding(.leading, 16)
                .padding(.trailing, 46)
                .padding(.top, 13)
                .padding(.bottom, 10)
                .focused($memoFocused)
                .disabled(isLoading || isCreating)
                .onSubmit {
                    if canSubmitMemo { onCreateMemo() }
                }

            Button(action: {
                if canSubmitMemo { onCreateMemo() }
            }) {
                Image(systemName: "arrow.up")
                    .font(.system(size: 13, weight: .bold))
                    .foregroundColor(.white)
                    .frame(width: 28, height: 28)
                    .background(canSubmitMemo ? Color.accent : Color(.systemGray4))
                    .clipShape(Circle())
            }
            .disabled(!canSubmitMemo)
            .padding(.trailing, 8)
            .padding(.bottom, 7)
        }
        .modifier(PillSurface(radius: pillRadius, strokeWidth: pillStroke))
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

            // Bookmark filter toggle
            Button(action: {
                HapticManager.impact(.light)
                bookmarkFilter.toggle()
                onSearch()
            }) {
                Image(systemName: bookmarkFilter ? "bookmark.fill" : "bookmark")
                    .font(.system(size: 14))
                    .foregroundColor(bookmarkFilter ? .accent : Color(.systemGray))
            }
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 12)
        .modifier(PillSurface(radius: pillRadius, strokeWidth: pillStroke))
    }

    // MARK: - Icon button

    private func iconButton(systemName: String, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Image(systemName: systemName)
                .font(.system(size: 15, weight: .medium))
                .foregroundColor(Color(.systemGray))
                .frame(width: 44, height: 44)
                .background(Color(.systemBackground))
                .clipShape(Circle())
                .overlay(
                    Circle()
                        .stroke(Color(.separator).opacity(0.4), lineWidth: 0.5)
                )
                .shadow(color: .black.opacity(0.08), radius: 8, x: 0, y: 2)
                .shadow(color: .black.opacity(0.04), radius: 2, x: 0, y: 1)
        }
    }
}

// MARK: - Shared pill surface modifier

private struct PillSurface: ViewModifier {
    let radius: CGFloat
    let strokeWidth: CGFloat

    func body(content: Content) -> some View {
        content
            .background(Color(.systemBackground))
            .clipShape(RoundedRectangle(cornerRadius: radius))
            .overlay(
                RoundedRectangle(cornerRadius: radius)
                    .stroke(Color(.separator).opacity(0.4), lineWidth: strokeWidth)
            )
            .shadow(color: .black.opacity(0.08), radius: 8, x: 0, y: 2)
            .shadow(color: .black.opacity(0.04), radius: 2, x: 0, y: 1)
    }
}

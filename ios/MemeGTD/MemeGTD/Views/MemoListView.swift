import SwiftUI

struct MemoListView: View {
    let onMenuTap: () -> Void
    @Binding var navigationPath: NavigationPath

    @StateObject private var viewModel = MemoListViewModel()
    @State private var isSearchExpanded: Bool = false

    // Memos displayed in reversed order (newest at bottom, like chat)
    private var reversedMemos: [Memo] {
        viewModel.memos.reversed()
    }

    var body: some View {
        ZStack(alignment: .bottom) {
            // Content layer
            ScrollViewReader { proxy in
                ScrollView {
                    LazyVStack(spacing: 0) {
                        // Load more indicator
                        if viewModel.hasMore {
                            Button(action: {
                                Task { await viewModel.loadOlderMemos() }
                            }) {
                                if viewModel.isLoadingMore {
                                    ProgressView()
                                        .padding()
                                } else {
                                    Text("Load older memos")
                                        .font(.caption)
                                        .foregroundColor(.textSecondary)
                                        .padding()
                                }
                            }
                        }

                        // Timeline content
                        ForEach(Array(reversedMemos.enumerated()), id: \.element.id) { index, memo in
                            let previousMemo = index > 0 ? reversedMemos[index - 1] : nil

                            // Date bucket header
                            let currentBucket = TimelineHelpers.getTimelineDateBucket(iso: memo.createdAt)
                            let previousBucket = previousMemo.map { TimelineHelpers.getTimelineDateBucket(iso: $0.createdAt) }
                            if previousBucket == nil || currentBucket != previousBucket {
                                TimelineDateHeader(bucket: currentBucket)
                            }

                            // Memo item
                            let showGap = TimelineHelpers.shouldShowGapTimestamp(
                                previousIso: previousMemo?.createdAt,
                                currentIso: memo.createdAt
                            )

                            Button(action: {
                                HapticManager.selection()
                                navigationPath.append(memo.id)
                            }) {
                                MemoTimelineItem(
                                    memo: memo,
                                    showTimestamp: showGap,
                                    timestampText: TimelineHelpers.formatTimelineTime(iso: memo.createdAt)
                                )
                            }
                            .buttonStyle(.plain)

                            Divider()
                                .padding(.leading, 16)
                        }

                        // Bottom spacer for floating composer
                        Color.clear.frame(height: 80)
                            .id("bottom")
                    }
                }
                .refreshable {
                    await viewModel.loadMemos()
                }
                .onAppear {
                    if viewModel.memos.isEmpty {
                        Task {
                            await viewModel.loadMemos()
                            // Scroll to bottom after initial load
                            DispatchQueue.main.asyncAfter(deadline: .now() + 0.1) {
                                withAnimation {
                                    proxy.scrollTo("bottom", anchor: .bottom)
                                }
                            }
                        }
                    }
                }
            }

            // Overlay layer: Search + Composer
            VStack(spacing: 0) {
                Spacer()

                HStack(alignment: .bottom, spacing: 8) {
                    // Search button
                    if !isSearchExpanded {
                        Button(action: {
                            HapticManager.impact(.light)
                            withAnimation(.easeOut(duration: 0.2)) {
                                isSearchExpanded = true
                            }
                        }) {
                            Image(systemName: "magnifyingglass")
                                .font(.system(size: 18))
                                .foregroundColor(.textSecondary)
                                .frame(width: 40, height: 40)
                                .background(Color(.systemBackground))
                                .clipShape(Circle())
                                .shadow(color: .black.opacity(0.1), radius: 4, y: 2)
                        }
                        .padding(.leading, 12)
                        .padding(.bottom, 4)
                    }

                    // Composer
                    if !isSearchExpanded {
                        FloatingComposer(
                            text: $viewModel.newMemoBody,
                            placeholder: "Write a memo...",
                            disabled: viewModel.isLoading,
                            submitting: viewModel.isCreating,
                            onSubmit: {
                                Task { await viewModel.createMemo() }
                            }
                        )
                    }
                }

                // Expanded search bar
                if isSearchExpanded {
                    SearchOverlay(
                        searchQuery: $viewModel.searchQuery,
                        bookmarkFilter: $viewModel.bookmarkFilter,
                        onSearch: { viewModel.search() },
                        onDismiss: {
                            withAnimation(.easeOut(duration: 0.2)) {
                                isSearchExpanded = false
                            }
                        }
                    )
                }
            }
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

// MARK: - Search Overlay

private struct SearchOverlay: View {
    @Binding var searchQuery: String
    @Binding var bookmarkFilter: Bool
    let onSearch: () -> Void
    let onDismiss: () -> Void

    @FocusState private var isFocused: Bool

    var body: some View {
        VStack(spacing: 8) {
            Divider()
            HStack(spacing: 8) {
                // Search field
                HStack(spacing: 8) {
                    Image(systemName: "magnifyingglass")
                        .foregroundColor(.textSecondary)
                        .font(.system(size: 14))

                    TextField("Search memos...", text: $searchQuery)
                        .font(.system(size: 15))
                        .focused($isFocused)
                        .onSubmit { onSearch() }

                    if !searchQuery.isEmpty {
                        Button(action: {
                            searchQuery = ""
                            onSearch()
                        }) {
                            Image(systemName: "xmark.circle.fill")
                                .foregroundColor(.textSecondary)
                                .font(.system(size: 14))
                        }
                    }
                }
                .padding(.horizontal, 10)
                .padding(.vertical, 8)
                .background(Color(.systemGray6))
                .cornerRadius(10)

                // Bookmark filter
                Button(action: {
                    HapticManager.impact(.light)
                    bookmarkFilter.toggle()
                    onSearch()
                }) {
                    Image(systemName: bookmarkFilter ? "bookmark.fill" : "bookmark")
                        .font(.system(size: 16))
                        .foregroundColor(bookmarkFilter ? .accent : .textSecondary)
                }

                // Close
                Button(action: onDismiss) {
                    Text("Cancel")
                        .font(.system(size: 15))
                        .foregroundColor(.accent)
                }
            }
            .padding(.horizontal, 12)
            .padding(.bottom, 8)
        }
        .background(Color(.systemBackground))
        .onAppear { isFocused = true }
    }
}

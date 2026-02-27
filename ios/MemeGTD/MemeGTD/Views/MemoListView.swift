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

                            // Date bucket header
                            let currentBucket = TimelineHelpers.getTimelineDateBucket(iso: memo.createdAt)
                            let previousBucket = previousMemo.map { TimelineHelpers.getTimelineDateBucket(iso: $0.createdAt) }
                            let bucketChanged = previousBucket == nil || currentBucket != previousBucket

                            if bucketChanged {
                                TimelineDateHeader(bucket: currentBucket)
                            }

                            // Timestamp: show when bucket changes OR when gap > 1 hour
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

                            // Memo item
                            Button(action: {
                                HapticManager.selection()
                                navigationPath.append(memo.id)
                            }) {
                                MemoTimelineItem(memo: memo)
                            }
                            .buttonStyle(.plain)
                            .padding(.horizontal, 16)
                        }

                        // Bottom inset: input bar height + safe area + extra margin
                        // This ensures the last memo doesn't hide behind the floating input
                        Color.clear.frame(height: 90)
                            .id("bottom")
                    }
                }
                .scrollDismissesKeyboard(.interactively)
                .refreshable {
                    // Pull-to-refresh at top of reversed list = load older memos
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

            // Layer 2: Floating input bar (overlay, NOT inside ScrollView)
            // The wrapper is transparent — only the FloatingComposer has its own surface
            VStack(spacing: 0) {
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
                } else {
                    HStack(alignment: .bottom, spacing: 10) {
                        // Search icon button
                        Button(action: {
                            HapticManager.impact(.light)
                            withAnimation(.easeOut(duration: 0.2)) {
                                isSearchExpanded = true
                            }
                        }) {
                            Image(systemName: "magnifyingglass")
                                .font(.system(size: 15, weight: .medium))
                                .foregroundColor(Color(.systemGray))
                                .frame(width: 34, height: 34)
                                .background(Color(.systemBackground))
                                .clipShape(Circle())
                                .overlay(
                                    Circle()
                                        .stroke(Color(.separator).opacity(0.4), lineWidth: 0.5)
                                )
                                .shadow(color: .black.opacity(0.06), radius: 4, x: 0, y: 1)
                        }

                        // Floating composer — has its own surface (bg + shadow + rounded)
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
                    .padding(.horizontal, 16)
                    .padding(.bottom, 10)
                }
            }
            // No background on the wrapper — transparent so content scrolls behind
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
        HStack(spacing: 8) {
            HStack(spacing: 8) {
                Image(systemName: "magnifyingglass")
                    .foregroundColor(Color(.systemGray))
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
                            .foregroundColor(Color(.systemGray))
                            .font(.system(size: 14))
                    }
                }
            }
            .padding(.horizontal, 10)
            .padding(.vertical, 8)
            .background(Color(.systemGray6))
            .cornerRadius(10)

            Button(action: {
                HapticManager.impact(.light)
                bookmarkFilter.toggle()
                onSearch()
            }) {
                Image(systemName: bookmarkFilter ? "bookmark.fill" : "bookmark")
                    .font(.system(size: 16))
                    .foregroundColor(bookmarkFilter ? .accent : Color(.systemGray))
            }

            Button(action: onDismiss) {
                Text("Cancel")
                    .font(.system(size: 15))
                    .foregroundColor(.accent)
            }
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 10)
        .background(
            Color(.systemBackground)
                .shadow(color: .black.opacity(0.06), radius: 4, y: -2)
        )
        .onAppear { isFocused = true }
    }
}

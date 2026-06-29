import PhotosUI
import SwiftUI

struct MemoDetailView: View {
    let memoId: Int
    let initialBody: String?
    let onMenuTap: () -> Void
    var onNavigateToLinkedIssue: ((Int, String, String) -> Void)?

    @EnvironmentObject var memoStore: MemoStore
    @StateObject private var viewModel: MemoDetailViewModel
    @Environment(\.dismiss) private var dismiss
    @State private var showDeleteConfirm: Bool = false
    @State private var showInfoSheet: Bool = false
    @State private var showCopiedFeedback: Bool = false
    @State private var editingMemo: Bool = false
    @State private var editingCommentId: Int? = nil
    @State private var showImagePicker: Bool = false
    @State private var showSizePicker: Bool = false
    @State private var isUploadingImage: Bool = false
    @State private var pickedImageData: Data? = nil
    @State private var pickedMimeType: String = "image/jpeg"
    @State private var pickedExtension: String = "jpg"
    @State private var createTaskMode: CreateTaskMode? = nil

    init(memoId: Int, initialBody: String? = nil, onMenuTap: @escaping () -> Void, onNavigateToLinkedIssue: ((Int, String, String) -> Void)? = nil) {
        self.memoId = memoId
        self.initialBody = initialBody
        self.onMenuTap = onMenuTap
        self.onNavigateToLinkedIssue = onNavigateToLinkedIssue
        self._viewModel = StateObject(wrappedValue: MemoDetailViewModel(memoId: memoId))
    }

    var body: some View {
        ScrollViewReader { proxy in
            ScrollView {
                LazyVStack(spacing: 0) {
                    if let memo = viewModel.memo {
                        let allItems = buildTimelineItems(memo: memo, comments: viewModel.comments)

                        ForEach(Array(allItems.enumerated()), id: \.element.id) { index, item in
                            let previousItem = index > 0 ? allItems[index - 1] : nil

                            let currentBucket = TimelineHelpers.getTimelineDateBucket(iso: item.createdAt)
                            let previousBucket = previousItem.map { TimelineHelpers.getTimelineDateBucket(iso: $0.createdAt) }
                            let bucketChanged = previousBucket == nil || currentBucket != previousBucket

                            if bucketChanged {
                                TimelineDateHeader(bucket: currentBucket)
                            }

                            let showTimestamp = bucketChanged || TimelineHelpers.shouldShowGapTimestamp(
                                previousIso: previousItem?.createdAt,
                                currentIso: item.createdAt
                            )

                            if showTimestamp {
                                TimelineTimestamp(text: TimelineHelpers.formatTimelineTime(iso: item.createdAt))
                            }

                            ThreadItem(
                                bodyMd: item.bodyMd,
                                labels: nil,
                                onEdit: {
                                    viewModel.replyBody = item.bodyMd
                                    if item.isOriginal {
                                        editingMemo = true
                                        editingCommentId = nil
                                    } else {
                                        editingMemo = false
                                        editingCommentId = item.commentId
                                    }
                                },
                                onDelete: {
                                    if item.isOriginal {
                                        showDeleteConfirm = true
                                    } else {
                                        Task { await viewModel.deleteComment(item.commentId!) }
                                    }
                                },
                                onCopy: {
                                    UIPasteboard.general.string = item.bodyMd
                                    HapticManager.notification(.success)
                                },
                                onIssueTap: { id, type in
                                    onNavigateToLinkedIssue?(id, type, "")
                                }
                            )
                        }
                    }

                    Color.clear.frame(height: 1)
                        .id("threadBottom")
                }
            }
            .scrollDismissesKeyboard(.immediately)
            .scrollEdgeEffectStyle(.soft, for: .bottom)
            .refreshable {
                await withCheckedContinuation { continuation in
                    Task { @MainActor in
                        HapticManager.impact(.medium)

                        let start = Date()
                        let result = await viewModel.fetchMemo()

                        let elapsed = Date().timeIntervalSince(start)
                        let remaining = 0.75 - elapsed
                        if remaining > 0 {
                            try? await Task.sleep(nanoseconds: UInt64(remaining * 1_000_000_000))
                        }

                        if let (memo, comments) = result {
                            viewModel.applyMemo(memo, comments: comments)
                        }
                        HapticManager.notification(.success)
                        continuation.resume()
                    }
                }
            }
            .onChange(of: viewModel.comments.count) { _ in
                withAnimation {
                    proxy.scrollTo("threadBottom", anchor: .bottom)
                }
            }
            .safeAreaBar(edge: .bottom) {
                FloatingComposer(
                    text: $viewModel.replyBody,
                    placeholder: (editingMemo || editingCommentId != nil) ? "Edit..." : "Add a comment...",
                    disabled: viewModel.isLoading,
                    submitting: viewModel.isSubmittingReply,
                    notice: editingMemo ? "Editing this memo" : editingCommentId != nil ? "Editing this comment" : nil,
                    onDismissNotice: {
                        editingMemo = false
                        editingCommentId = nil
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
                        if editingMemo {
                            Task {
                                await viewModel.updateMemo(bodyMd: viewModel.replyBody)
                                editingMemo = false
                                viewModel.replyBody = ""
                            }
                        } else if let commentId = editingCommentId {
                            Task {
                                await viewModel.updateComment(commentId, bodyMd: viewModel.replyBody)
                                editingCommentId = nil
                                viewModel.replyBody = ""
                            }
                        } else {
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
                title: memoTitlePreview,
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
                onPromoteToTask: {
                    let fallback = viewModel.memo?.bodyMd ?? ""
                    Task { @MainActor in
                        var resolvedBody = fallback
                        var initialLabelNames: [String] = []
                        var initialProjectIds: [Int] = []
                        var carriedLinks: [PendingLink] = []
                        do {
                            let preview: PromotePreviewResponse = try await APIClient.shared.get(
                                path: "/api/memos/\(memoId)/promote-preview"
                            )
                            resolvedBody = preview.bodyMd
                            initialLabelNames = preview.labels
                            initialProjectIds = preview.projectIds
                            carriedLinks = preview.linkedIssues.compactMap { link in
                                guard let linkType = LinkType(rawValue: link.linkType) else { return nil }
                                return PendingLink(
                                    targetIssueId: link.targetIssue.id,
                                    linkType: linkType,
                                    title: link.targetIssue.title
                                )
                            }
                        } catch {
                            // Fall back to raw memo body on preview failure
                        }
                        // Show the derived_from link to the source memo as a regular pending link
                        // so it appears in the Links picker alongside the carried-over links.
                        let memoTitleSnippet: String = {
                            let body = viewModel.memo?.bodyMd ?? resolvedBody
                            let stripped = body.replacingOccurrences(of: #"\s+"#, with: " ", options: .regularExpression).trimmingCharacters(in: .whitespaces)
                            let snippet = String(stripped.prefix(80))
                            return snippet.isEmpty ? "Memo #\(memoId)" : snippet
                        }()
                        let derivedFromLink = PendingLink(
                            targetIssueId: memoId,
                            linkType: .derivedFrom,
                            title: memoTitleSnippet
                        )
                        createTaskMode = CreateTaskMode(kind: .promoteFromMemo(
                            memoId: memoId,
                            memoBody: resolvedBody,
                            initialLabelNames: initialLabelNames,
                            initialProjectIds: initialProjectIds,
                            initialLinks: [derivedFromLink] + carriedLinks
                        ))
                    }
                },
                onNavigateToIssue: { target in
                    onNavigateToLinkedIssue?(target.id, target.type, target.title)
                }
            )
            .presentationDetents([.fraction(0.6), .large])
        }
        .sheet(item: $createTaskMode) { mode in
            CreateTaskModal(
                mode: mode.kind,
                onCreated: { _ in
                    createTaskMode = nil
                    Task { await viewModel.loadMemo() }
                },
                onDismiss: { createTaskMode = nil }
            )
            .presentationDetents([.large])
        }
        .alert("Delete Memo", isPresented: $showDeleteConfirm) {
            Button("Cancel", role: .cancel) {}
            Button("Delete", role: .destructive) {
                Task {
                    if await viewModel.deleteMemo() {
                        dismiss()
                    }
                }
            }
        } message: {
            Text("Are you sure you want to delete this memo? This action cannot be undone.")
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
            if viewModel.isLoading && viewModel.memo == nil {
                ProgressView("Loading...")
                    .foregroundColor(.textSecondary)
            }
        }
        .task {
            viewModel.memoStore = memoStore
            await viewModel.loadMemo()
        }
    }

    // MARK: - Title preview

    private var memoTitlePreview: String {
        let body = viewModel.memo?.bodyMd ?? initialBody
        guard let body else { return "Memo" }
        guard let firstLine = body
            .components(separatedBy: "\n")
            .first(where: { !$0.trimmingCharacters(in: .whitespaces).isEmpty })
        else { return "Memo" }
        let stripped = firstLine.replacingOccurrences(
            of: #"^#{1,6}\s+"#, with: "", options: .regularExpression
        )
        return stripped.isEmpty ? "Memo" : stripped
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

    // MARK: - Build unified timeline items

    private func buildTimelineItems(memo: Memo, comments: [Comment]) -> [ThreadTimelineItem] {
        var items: [ThreadTimelineItem] = []

        items.append(ThreadTimelineItem(
            id: "memo-\(memo.id)",
            bodyMd: memo.bodyMd,
            createdAt: memo.createdAt,
            labels: memo.labels,
            isOriginal: true,
            commentId: nil
        ))

        for comment in comments {
            items.append(ThreadTimelineItem(
                id: "comment-\(comment.id)",
                bodyMd: comment.bodyMd,
                createdAt: comment.createdAt,
                labels: nil,
                isOriginal: false,
                commentId: comment.id
            ))
        }

        return items
    }
}

// MARK: - Thread timeline item

private struct ThreadTimelineItem: Identifiable {
    let id: String
    let bodyMd: String
    let createdAt: String
    let labels: [String]?
    let isOriginal: Bool
    let commentId: Int?
}

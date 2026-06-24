import Combine
import SwiftUI
import SwiftData

@MainActor
class MemoStore: ObservableObject {
    @Published var memos: [Memo] = []
    @Published var total: Int = 0
    @Published var needsReload: Bool = false
    /// Number of operations queued for offline send. Drives the
    /// "Offline · N pending" badge in the top banner.
    @Published var pendingCount: Int = 0
    /// Number of memos currently flagged as conflicts. Drives the red
    /// "Sync paused — Tap to resolve" banner.
    @Published var conflictCount: Int = 0

    /// SwiftData context for offline cache reads. Injected by the App once
    /// at launch; before injection the store works in pure-memory mode for
    /// backwards compatibility with existing tests.
    private var modelContext: ModelContext?

    var hasMore: Bool { memos.count < total }

    func setItems(_ items: [Memo], total: Int) {
        self.memos = items
        self.total = total
    }

    func appendItems(_ items: [Memo], total: Int) {
        self.memos.append(contentsOf: items)
        self.total = total
    }

    func insertItem(_ memo: Memo, at index: Int = 0) {
        memos.insert(memo, at: index)
        total += 1
    }

    func updateItem(_ updated: Memo) {
        if let index = memos.firstIndex(where: { $0.id == updated.id }) {
            memos[index] = updated
        }
    }

    func removeItem(_ id: Int) {
        memos.removeAll { $0.id == id }
        total = max(0, total - 1)
    }

    /// Normalizes `total` to the actually-loaded count. Used after a paginated
    /// "load all" exits early because the server reported more items than it
    /// returned, so `hasMore` correctly becomes false.
    func sealTotal() {
        total = memos.count
    }

    // MARK: - SwiftData cache hookup

    func setModelContext(_ context: ModelContext) {
        self.modelContext = context
    }

    // NOTE: bindToSyncEngine was removed deliberately. Subscribing to
    // SyncEngine.didFinishSyncStep made every background pull/push call
    // refreshFromCache(), which sets `@Published var memos` and triggers
    // a re-render of MemoListView. When initial hydration was still in
    // flight, those re-renders interrupted the toolbar search field's
    // open / close animation. Refresh now happens at well-defined points:
    // app launch (end of MemeGTDApp.task), each list view's `.task`, and
    // explicit user mutations through the enqueueXxx methods below.

    /// Replace the in-memory list with whatever the local SwiftData cache
    /// currently holds (newest-first, both synced and pending rows). Safe
    /// to call when no context has been injected — it becomes a no-op.
    func refreshFromCache() {
        guard let modelContext else { return }
        let repo = LocalMemoRepository(context: modelContext)
        let outbox = OutboxRepository(context: modelContext)
        let locals = repo.fetchMemos()
        self.memos = locals.map { $0.toMemo() }
        self.total = repo.memoCount
        self.pendingCount = outbox.count
        self.conflictCount = locals.filter { $0.syncState == .conflict }.count
    }

    /// Write server-fresh memos into the local cache so they remain visible
    /// the next time the app launches offline. No-op until a context has
    /// been injected.
    func persistToCache(_ items: [Memo]) {
        guard let modelContext else { return }
        let repo = LocalMemoRepository(context: modelContext)
        for memo in items {
            repo.upsertFromServer(memo)
        }
        try? repo.save()
    }

    /// Remove a memo from the local cache (after a server-side delete).
    func removeFromCache(remoteId: Int) {
        guard let modelContext else { return }
        let repo = LocalMemoRepository(context: modelContext)
        if let local = repo.fetchMemo(byRemoteId: remoteId) {
            modelContext.delete(local)
            try? repo.save()
        }
    }

    /// Pull a memo and its cached comments from SwiftData. Accepts either a
    /// positive server-assigned ID or the negative stableLocalId we
    /// synthesize for pending rows, so freshly-created offline memos can be
    /// opened in the detail view before they have a remoteId.
    func cachedDetail(memoId: Int) -> (memo: Memo, comments: [Comment])? {
        guard let modelContext else { return nil }
        let repo = LocalMemoRepository(context: modelContext)
        guard let local = repo.fetchMemo(byAnyId: memoId) else { return nil }
        let comments = repo.fetchComments(forMemo: local).map { $0.toComment() }
        return (local.toMemo(), comments)
    }

    /// Persist a server-fresh memo detail (body + comments) for offline reuse.
    func persistDetailToCache(memo: Memo, comments: [Comment]) {
        guard let modelContext else { return }
        let repo = LocalMemoRepository(context: modelContext)
        let local = repo.upsertFromServer(memo)
        repo.replaceComments(comments, for: local)
        try? repo.save()
    }

    // MARK: - Offline-capable writes (Outbox-backed)
    //
    // The methods below write to the SwiftData cache immediately and enqueue
    // an OutboxOperation. The in-memory `memos` array is refreshed from the
    // cache afterwards so SwiftUI re-renders with the optimistic state. The
    // SyncEngine is kicked to push the queue in the background.

    /// Create a memo locally and enqueue a server POST. Returns the DTO for
    /// the new (locally-only) row — the caller can insert it into the UI.
    @discardableResult
    func enqueueCreateMemo(body: String) -> Memo? {
        guard let modelContext else { return nil }
        let memos = LocalMemoRepository(context: modelContext)
        let outbox = OutboxRepository(context: modelContext)
        let now = Date()
        let clientUuid = UUID().lowercasedString
        let local = LocalMemo(
            clientUuid: clientUuid,
            bodyMd: body,
            createdAt: now,
            updatedAt: now,
            syncState: .pendingCreate
        )
        modelContext.insert(local)
        outbox.enqueueCreateMemo(memoLocalId: local.localId, clientUuid: clientUuid, bodyMd: body, at: now)
        try? memos.save()
        refreshFromCache()
        SyncEngine.shared.kick()
        return local.toMemo()
    }

    /// Update a memo's body locally and enqueue a server PATCH. Returns the
    /// updated DTO so the caller can replace the in-memory copy.
    @discardableResult
    func enqueueUpdateMemoBody(memoId: Int, body: String) -> Memo? {
        guard let modelContext else { return nil }
        let memos = LocalMemoRepository(context: modelContext)
        let outbox = OutboxRepository(context: modelContext)
        guard let local = memos.fetchMemo(byAnyId: memoId) else { return nil }
        local.bodyMd = body
        local.updatedAt = Date()
        if local.syncState != .pendingCreate {
            local.syncState = .pendingUpdate
        }
        outbox.enqueueUpdateMemo(memoLocalId: local.localId, bodyMd: body, at: Date())
        try? memos.save()
        refreshFromCache()
        SyncEngine.shared.kick()
        return local.toMemo()
    }

    /// Delete a memo locally and enqueue a server DELETE (or remove both
    /// the create and delete ops if the memo was never sent yet).
    func enqueueDeleteMemo(memoId: Int) {
        guard let modelContext else { return }
        let memos = LocalMemoRepository(context: modelContext)
        let outbox = OutboxRepository(context: modelContext)
        guard let local = memos.fetchMemo(byAnyId: memoId) else { return }
        let cancelled = outbox.enqueueDeleteMemo(memoLocalId: local.localId, at: Date())
        if cancelled {
            modelContext.delete(local)
        } else {
            local.isDeleted = true
            local.syncState = .pendingDelete
            local.updatedAt = Date()
        }
        try? memos.save()
        refreshFromCache()
        removeItem(memoId)
        SyncEngine.shared.kick()
    }

    /// Append a comment locally and enqueue a server POST. Returns the DTO
    /// (with a synthesized negative id) so the detail view can show it.
    @discardableResult
    func enqueueCreateComment(memoId: Int, body: String) -> Comment? {
        guard let modelContext else { return nil }
        let memos = LocalMemoRepository(context: modelContext)
        let outbox = OutboxRepository(context: modelContext)
        guard let parent = memos.fetchMemo(byAnyId: memoId) else { return nil }
        let now = Date()
        let clientUuid = UUID().lowercasedString
        let local = LocalComment(
            clientUuid: clientUuid,
            bodyMd: body,
            createdAt: now,
            updatedAt: now,
            syncState: .pendingCreate,
            memo: parent
        )
        modelContext.insert(local)
        parent.commentCount += 1
        outbox.enqueueCreateComment(
            memoLocalId: parent.localId,
            commentLocalId: local.localId,
            clientUuid: clientUuid,
            bodyMd: body,
            at: now
        )
        try? memos.save()
        refreshPending()
        SyncEngine.shared.kick()
        return local.toComment()
    }

    /// Update a comment body locally and enqueue a PATCH.
    @discardableResult
    func enqueueUpdateComment(memoId: Int, commentId: Int, body: String) -> Comment? {
        guard let modelContext else { return nil }
        let memos = LocalMemoRepository(context: modelContext)
        let outbox = OutboxRepository(context: modelContext)
        guard let parent = memos.fetchMemo(byAnyId: memoId),
              let local = memos.fetchComment(byAnyId: commentId, in: parent) else { return nil }
        local.bodyMd = body
        local.updatedAt = Date()
        if local.syncState != .pendingCreate {
            local.syncState = .pendingUpdate
        }
        outbox.enqueueUpdateComment(
            memoLocalId: parent.localId,
            commentLocalId: local.localId,
            bodyMd: body,
            at: Date()
        )
        try? memos.save()
        refreshPending()
        SyncEngine.shared.kick()
        return local.toComment()
    }

    /// Remove a comment locally and enqueue a DELETE (or cancel the create
    /// when the comment never reached the server).
    func enqueueDeleteComment(memoId: Int, commentId: Int) {
        guard let modelContext else { return }
        let memos = LocalMemoRepository(context: modelContext)
        let outbox = OutboxRepository(context: modelContext)
        guard let parent = memos.fetchMemo(byAnyId: memoId),
              let local = memos.fetchComment(byAnyId: commentId, in: parent) else { return }
        let cancelled = outbox.enqueueDeleteComment(
            memoLocalId: parent.localId,
            commentLocalId: local.localId,
            at: Date()
        )
        if cancelled {
            modelContext.delete(local)
        } else {
            local.isDeleted = true
            local.syncState = .pendingDelete
            local.updatedAt = Date()
        }
        parent.commentCount = max(0, parent.commentCount - 1)
        try? memos.save()
        refreshPending()
        SyncEngine.shared.kick()
    }

    /// Recompute the pending-operation count from SwiftData. Called by sync
    /// callbacks and after each Outbox mutation.
    func refreshPending() {
        guard let modelContext else { return }
        self.pendingCount = OutboxRepository(context: modelContext).count
    }

    // MARK: - Conflict resolution

    /// All non-deleted memos in `.conflict` state. Drives the red banner.
    func conflictMemos() -> [Memo] {
        guard let modelContext else { return [] }
        let repo = LocalMemoRepository(context: modelContext)
        return repo.fetchMemos()
            .filter { $0.syncState == .conflict }
            .map { $0.toMemo() }
    }

    /// "Keep local copy": the server-side row is gone, but the user wants
    /// the local edit preserved. Re-create the memo on the server with a
    /// fresh clientUuid so it appears as a new row. Returns true if the
    /// reset succeeded.
    @discardableResult
    func resolveConflictKeepLocal(memoId: Int) -> Bool {
        guard let modelContext else { return false }
        let repo = LocalMemoRepository(context: modelContext)
        let outbox = OutboxRepository(context: modelContext)
        guard let local = repo.fetchMemo(byAnyId: memoId), local.syncState == .conflict else {
            return false
        }
        local.remoteId = nil
        local.clientUuid = UUID().lowercasedString
        local.syncState = .pendingCreate
        local.lastSyncError = nil
        outbox.enqueueCreateMemo(
            memoLocalId: local.localId,
            clientUuid: local.clientUuid,
            bodyMd: local.bodyMd,
            at: Date()
        )
        try? repo.save()
        refreshFromCache()
        SyncEngine.shared.kick()
        return true
    }

    /// "Discard local copy": throw away the local row entirely. The server
    /// truth (deleted) wins.
    func resolveConflictDiscard(memoId: Int) {
        guard let modelContext else { return }
        let repo = LocalMemoRepository(context: modelContext)
        guard let local = repo.fetchMemo(byAnyId: memoId), local.syncState == .conflict else { return }
        modelContext.delete(local)
        try? repo.save()
        refreshFromCache()
    }

    // MARK: - Outbox detail view support

    /// Snapshot of the Outbox queue for the OutboxStatusSheet. Includes the
    /// body excerpt of each op's target so the user can recognise which
    /// memo / comment is stuck.
    struct OutboxRow: Identifiable, Hashable {
        let id: UUID            // OutboxOperation.id
        let kind: String        // raw value of OutboxKindRaw
        let targetType: String
        let preview: String     // body excerpt
        let retryCount: Int
        let lastError: String?
        let lastTriedAt: Date?
        let enqueuedAt: Date
    }

    func outboxRows() -> [OutboxRow] {
        guard let modelContext else { return [] }
        let outbox = OutboxRepository(context: modelContext)
        let memos = LocalMemoRepository(context: modelContext)
        return outbox.pendingOperations().map { op in
            let preview = previewFor(op: op, memos: memos)
            return OutboxRow(
                id: op.id,
                kind: op.kindRaw,
                targetType: op.targetType,
                preview: preview,
                retryCount: op.retryCount,
                lastError: op.lastError,
                lastTriedAt: op.lastTriedAt,
                enqueuedAt: op.enqueuedAt
            )
        }
    }

    private func previewFor(op: OutboxOperation, memos: LocalMemoRepository) -> String {
        if op.targetType == "comment", let commentId = op.commentLocalId,
           let c = memos.fetchComment(byAnyLocalId: commentId) {
            return excerpt(c.bodyMd)
        }
        if let m = memos.fetchMemo(byLocalId: op.memoLocalId) {
            return excerpt(m.bodyMd)
        }
        return "(no preview)"
    }

    private func excerpt(_ body: String) -> String {
        let trimmed = body.trimmingCharacters(in: .whitespacesAndNewlines)
        if trimmed.count <= 80 { return trimmed }
        return String(trimmed.prefix(80)) + "…"
    }

    /// Drop a single Outbox row and roll the LocalMemo / LocalComment back
    /// to the sync state appropriate for whatever the server last knew.
    func discardOutboxRow(id: UUID) {
        guard let modelContext else { return }
        let outbox = OutboxRepository(context: modelContext)
        let memos = LocalMemoRepository(context: modelContext)
        guard let op = outbox.pendingOperations().first(where: { $0.id == id }) else { return }
        outbox.discard(op, memos: memos)
        try? memos.save()
        refreshFromCache()
    }

    /// Drop every Outbox row. Local memos / comments are rolled back as
    /// `discardOutboxRow(id:)` does.
    func discardAllOutbox() {
        guard let modelContext else { return }
        let outbox = OutboxRepository(context: modelContext)
        let memos = LocalMemoRepository(context: modelContext)
        for op in outbox.pendingOperations() {
            outbox.discard(op, memos: memos)
        }
        try? memos.save()
        refreshFromCache()
    }
}

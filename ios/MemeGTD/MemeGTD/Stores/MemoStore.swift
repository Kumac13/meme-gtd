import Combine
import SwiftUI
import SwiftData

@MainActor
class MemoStore: ObservableObject {
    @Published var memos: [Memo] = []
    @Published var total: Int = 0
    @Published var needsReload: Bool = false

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

    /// Replace the in-memory list with whatever the local SwiftData cache
    /// currently holds (newest-first, synced rows only). Safe to call when
    /// no context has been injected — it becomes a no-op.
    func refreshFromCache() {
        guard let modelContext else { return }
        let repo = LocalMemoRepository(context: modelContext)
        let locals = repo.fetchMemos().filter { $0.remoteId != nil }
        self.memos = locals.map { $0.toMemo() }
        self.total = repo.memoCount
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

    /// Pull a memo and its cached comments from SwiftData. Returns nil when
    /// no context is available or the row is unknown locally.
    func cachedDetail(remoteId: Int) -> (memo: Memo, comments: [Comment])? {
        guard let modelContext else { return nil }
        let repo = LocalMemoRepository(context: modelContext)
        guard let local = repo.fetchMemo(byRemoteId: remoteId) else { return nil }
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
}

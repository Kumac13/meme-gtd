import Combine
import SwiftUI

@MainActor
class MemoStore: ObservableObject {
    @Published var memos: [Memo] = []
    @Published var total: Int = 0
    @Published var needsReload: Bool = false

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

    /// Swaps an optimistically-inserted pending memo (negative synthetic id)
    /// for its server-confirmed counterpart in place, so the row keeps its
    /// list position and the user can tap it without seeing a 404. If the
    /// pending row is no longer in the list (e.g. the user already navigated
    /// away or pulled to refresh), this is a no-op.
    func replacePendingMemo(localId: String, with serverMemo: Memo) {
        let syntheticId = LocalMemo.syntheticDisplayId(forLocalId: localId)
        if let index = memos.firstIndex(where: { $0.id == syntheticId }) {
            memos[index] = serverMemo
        }
    }

    func removeItem(_ id: Int) {
        memos.removeAll { $0.id == id }
        total = max(0, total - 1)
    }
}

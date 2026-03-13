import Combine
import SwiftUI

@MainActor
class MemoStore: ObservableObject {
    @Published var memos: [Memo] = []
    @Published var total: Int = 0

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
}

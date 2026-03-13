import Combine
import SwiftUI

@MainActor
class TaskStore: ObservableObject {
    @Published var tasks: [TaskItem] = []
    @Published var total: Int = 0
    @Published var needsReload: Bool = false

    var hasMore: Bool { tasks.count < total }

    func setItems(_ items: [TaskItem], total: Int) {
        self.tasks = items
        self.total = total
    }

    func appendItems(_ items: [TaskItem], total: Int) {
        self.tasks.append(contentsOf: items)
        self.total = total
    }

    func updateItem(_ updated: TaskItem) {
        if let index = tasks.firstIndex(where: { $0.id == updated.id }) {
            tasks[index] = updated
        }
    }

    func removeItem(_ id: Int) {
        tasks.removeAll { $0.id == id }
        total = max(0, total - 1)
    }
}

import Combine
import SwiftUI

@MainActor
class TemplateStore: ObservableObject {
    @Published var templates: [Template] = []
    @Published var total: Int = 0
    @Published var needsReload: Bool = false

    var hasMore: Bool { templates.count < total }

    func setItems(_ items: [Template], total: Int) {
        self.templates = items
        self.total = total
    }

    func appendItems(_ items: [Template], total: Int) {
        self.templates.append(contentsOf: items)
        self.total = total
    }

    func updateItem(_ updated: Template) {
        if let index = templates.firstIndex(where: { $0.id == updated.id }) {
            templates[index] = updated
        }
    }

    func removeItem(_ id: Int) {
        templates.removeAll { $0.id == id }
        total = max(0, total - 1)
    }
}

import Combine
import SwiftUI

@MainActor
class ArticleStore: ObservableObject {
    @Published var articles: [ArticleResponse] = []
    @Published var total: Int = 0
    @Published var needsReload: Bool = false

    var hasMore: Bool { articles.count < total }

    func setItems(_ items: [ArticleResponse], total: Int) {
        self.articles = items
        self.total = total
    }

    func appendItems(_ items: [ArticleResponse], total: Int) {
        self.articles.append(contentsOf: items)
        self.total = total
    }

    func updateItem(_ updated: ArticleResponse) {
        if let index = articles.firstIndex(where: { $0.id == updated.id }) {
            articles[index] = updated
        }
    }

    func removeItem(_ id: Int) {
        articles.removeAll { $0.id == id }
        total = max(0, total - 1)
    }
}

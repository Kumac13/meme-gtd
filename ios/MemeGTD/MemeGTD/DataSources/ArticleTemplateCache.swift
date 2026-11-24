import Foundation

/// 作成画面に必要な全ページを取得できた時だけ、接続先のスナップショットを更新する。
@MainActor
final class ArticleTemplateCache {
    static let shared = ArticleTemplateCache()
    private var refreshTask: Task<[Template], Error>?
    private var refreshingServer: String?

    var cached: [Template]? {
        guard let data = UserDefaults.standard.data(forKey: key) else { return nil }
        return try? JSONDecoder().decode([Template].self, from: data)
    }

    private var key: String { "articleTemplates." + Settings.shared.effectiveApiUrl }

    func refresh() async throws -> [Template] {
        let server = key
        if let refreshTask, refreshingServer == server { return try await refreshTask.value }
        refreshingServer = server
        let task = Task {
            let templates = try await Self.fetchAll { offset in
                guard Settings.shared.appMode == .server, server == key else { throw CancellationError() }
                return try await RemoteTemplateDataSource().listTemplates(queryItems: [
                    URLQueryItem(name: "target", value: "article"),
                    URLQueryItem(name: "limit", value: "100"),
                    URLQueryItem(name: "offset", value: String(offset))
                ])
            }
            guard server == key else { throw CancellationError() }
            UserDefaults.standard.set(try JSONEncoder().encode(templates), forKey: server)
            return templates
        }
        refreshTask = task
        defer { if refreshingServer == server { refreshTask = nil } }
        return try await task.value
    }

    static func fetchAll(page: (Int) async throws -> TemplateListResponse) async throws -> [Template] {
        var templates: [Template] = []
        var total: Int
        repeat {
            let response = try await page(templates.count)
            total = response.total
            guard response.offset == templates.count,
                  !response.data.isEmpty || templates.count == total else { throw URLError(.cannotParseResponse) }
            templates += response.data
        } while templates.count < total
        guard templates.count == total, Set(templates.map(\.id)).count == total else { throw URLError(.cannotParseResponse) }
        return templates
    }
}

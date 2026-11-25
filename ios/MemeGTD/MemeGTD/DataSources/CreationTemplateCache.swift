import Foundation

/// 作成画面に必要な全ページを取得できた時だけ、接続先のスナップショットを更新する。
@MainActor
final class CreationTemplateCache {
    static let shared = CreationTemplateCache()
    private let defaults: UserDefaults
    private var refreshTasks: [String: Task<[Template], Error>] = [:]

    init(defaults: UserDefaults = .standard) {
        self.defaults = defaults
    }

    func cached(_ target: TemplateCreationTarget, endpoint: String = Settings.shared.effectiveApiUrl) -> [Template]? {
        guard let data = defaults.data(forKey: key(target, endpoint)) else { return nil }
        return try? JSONDecoder().decode([Template].self, from: data)
    }

    func refresh(_ target: TemplateCreationTarget) async throws -> [Template] {
        let endpoint = Settings.shared.effectiveApiUrl
        let source = RemoteTemplateDataSource(client: APIClient(baseUrl: endpoint))
        return try await refresh(target, endpoint: endpoint) { offset in
            guard Settings.shared.appMode == .server, Settings.shared.effectiveApiUrl == endpoint else {
                throw CancellationError()
            }
            return try await source.listTemplates(queryItems: [
                URLQueryItem(name: "target", value: target.rawValue),
                URLQueryItem(name: "limit", value: "100"),
                URLQueryItem(name: "offset", value: String(offset))
            ])
        }
    }

    func refreshAll() async {
        async let tasks: Void = refreshIfAvailable(.task)
        async let articles: Void = refreshIfAvailable(.article)
        _ = await (tasks, articles)
    }

    private func refreshIfAvailable(_ target: TemplateCreationTarget) async {
        _ = try? await refresh(target)
    }

    func refresh(_ target: TemplateCreationTarget, endpoint: String,
                 page: @escaping (Int) async throws -> TemplateListResponse) async throws -> [Template] {
        let key = key(target, endpoint)
        if let task = refreshTasks[key] { return try await task.value }
        let task = Task {
            let templates = try await Self.fetchAll(page: page)
            defaults.set(try JSONEncoder().encode(templates), forKey: key)
            return templates
        }
        refreshTasks[key] = task
        defer { refreshTasks[key] = nil }
        return try await task.value
    }

    private func key(_ target: TemplateCreationTarget, _ endpoint: String) -> String {
        "\(target.rawValue)Templates.\(endpoint)"
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

import Foundation

/// Issue link picker向けの横断検索。
/// リソース別ViewModelには、除外するIssue IDだけを残す。
@MainActor
struct IssuePickerSearchService {
    typealias Search = ([URLQueryItem]) async -> [IssuePickerItem]

    private let searchTasks: Search
    private let searchMemos: Search
    private let searchArticles: Search

    init(dataSources: DataSourceProvider) {
        searchTasks = { queryItems in
            do {
                let response = try await dataSources.tasks.searchTasks(queryItems: queryItems)
                return response.data.map {
                    IssuePickerItem(
                        id: $0.id,
                        type: "task",
                        title: $0.title,
                        status: $0.status,
                        updatedAt: $0.updatedAt
                    )
                }
            } catch {
                return []
            }
        }
        searchMemos = { queryItems in
            do {
                let response = try await dataSources.memos.listMemos(queryItems: queryItems)
                return response.data.map {
                    let firstLine = $0.bodyMd.components(separatedBy: "\n")
                        .first(where: { !$0.trimmingCharacters(in: .whitespaces).isEmpty }) ?? $0.bodyMd
                    return IssuePickerItem(
                        id: $0.id,
                        type: "memo",
                        title: String(firstLine.prefix(50)),
                        status: nil,
                        updatedAt: $0.updatedAt
                    )
                }
            } catch {
                return []
            }
        }
        searchArticles = { queryItems in
            do {
                let response = try await dataSources.articles.searchArticles(queryItems: queryItems)
                return response.data.map {
                    let title = $0.title.count > 50
                        ? String($0.title.prefix(50)) + "..."
                        : $0.title
                    return IssuePickerItem(
                        id: $0.id,
                        type: "article",
                        title: title,
                        status: nil,
                        updatedAt: $0.updatedAt
                    )
                }
            } catch {
                return []
            }
        }
    }

    init(
        searchTasks: @escaping Search,
        searchMemos: @escaping Search,
        searchArticles: @escaping Search
    ) {
        self.searchTasks = searchTasks
        self.searchMemos = searchMemos
        self.searchArticles = searchArticles
    }

    func search(
        query: String,
        excludingIDs: Set<Int> = [],
        limit: Int = 10
    ) async -> [IssuePickerItem] {
        let trimmed = query.trimmingCharacters(in: .whitespacesAndNewlines)
        let queryItems = trimmed.isEmpty
            ? []
            : [URLQueryItem(name: "search", value: trimmed)]

        async let tasks = searchTasks(queryItems)
        async let memos = searchMemos(queryItems)
        async let articles = searchArticles(queryItems)
        let results = await tasks + memos + articles

        return results
            .filter { !excludingIDs.contains($0.id) }
            .sorted { $0.updatedAt > $1.updatedAt }
            .prefix(limit)
            .map { $0 }
    }
}

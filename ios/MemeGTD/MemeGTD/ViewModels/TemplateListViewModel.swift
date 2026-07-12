import Combine
import os
import SwiftUI

private let logger = Logger(subsystem: "name.kumac.MemeGTD", category: "TemplateList")

/// Target filter for the templates list (issues.template_target).
enum TemplateTargetFilter: String, CaseIterable {
    case all
    case task
    case article

    var displayLabel: String {
        switch self {
        case .all: return "All"
        case .task: return "Task"
        case .article: return "Article"
        }
    }
}

@MainActor
class TemplateListViewModel: ObservableObject {
    @Published var isLoading: Bool = false
    @Published var isLoadingMore: Bool = false
    @Published var error: String?

    // Search (server-side ?search= on /api/templates)
    @Published var searchQuery: String = ""

    // Target filter (?target=)
    @Published var targetFilter: TemplateTargetFilter = .all

    var store: TemplateStore?

    /// Data source seam. Views overwrite this with the app-wide provider from
    /// the environment (same wiring point as `store`).
    var dataSources = DataSourceProvider()

    private let pageSize = 20

    // MARK: - Query building

    private func buildListQueryItems(offset: Int) -> [URLQueryItem] {
        var items = [
            URLQueryItem(name: "limit", value: String(pageSize)),
            URLQueryItem(name: "offset", value: String(offset)),
        ]
        if !searchQuery.isEmpty {
            items.append(URLQueryItem(name: "search", value: searchQuery))
        }
        if targetFilter != .all {
            items.append(URLQueryItem(name: "target", value: targetFilter.rawValue))
        }
        return items
    }

    // MARK: - Load

    func loadTemplates() async {
        logger.info("loadTemplates called")
        isLoading = true
        error = nil

        do {
            let response = try await dataSources.templates.listTemplates(
                queryItems: buildListQueryItems(offset: 0)
            )
            store?.setItems(response.data, total: response.total)
            logger.info("loadTemplates done: count=\(response.data.count), total=\(response.total)")
        } catch {
            self.error = error.localizedDescription
            logger.error("loadTemplates error: \(error.localizedDescription)")
        }

        isLoading = false
    }

    // MARK: - Fetch without UI update (for pull-to-refresh)

    func fetchTemplates() async -> TemplateListResponse? {
        do {
            return try await dataSources.templates.listTemplates(
                queryItems: buildListQueryItems(offset: 0)
            )
        } catch {
            self.error = error.localizedDescription
            return nil
        }
    }

    func applyTemplates(_ response: TemplateListResponse) {
        store?.setItems(response.data, total: response.total)
    }

    func loadOlderTemplates() async {
        guard let store else { return }
        guard store.hasMore, !isLoadingMore else { return }
        isLoadingMore = true

        do {
            let response = try await dataSources.templates.listTemplates(
                queryItems: buildListQueryItems(offset: store.templates.count)
            )
            store.appendItems(response.data, total: response.total)
        } catch is CancellationError {
            logger.info("loadOlderTemplates cancelled")
        } catch {
            self.error = error.localizedDescription
            logger.error("loadOlderTemplates error: \(error.localizedDescription)")
        }

        isLoadingMore = false
    }

    // MARK: - Search / filter

    func search() {
        Task { await loadTemplates() }
    }

    func setTargetFilter(_ filter: TemplateTargetFilter) {
        targetFilter = filter
        Task { await loadTemplates() }
    }
}

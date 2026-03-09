import Combine
import os
import SwiftUI

private let logger = Logger(subsystem: "name.kumac.MemeGTD", category: "TaskList")

@MainActor
class TaskListViewModel: ObservableObject {
    @Published var tasks: [TaskItem] = []
    @Published var total: Int = 0
    @Published var isLoading: Bool = false
    @Published var isLoadingMore: Bool = false
    @Published var error: String?

    // Filters
    @Published var statusFilter: TaskStatusFilter = .next
    @Published var labelFilters: Set<String> = []
    @Published var projectFilters: Set<Int> = []
    @Published var includeNoProject: Bool = false
    @Published var bookmarkFilter: Bool = false
    @Published var searchQuery: String = ""

    // Labels for picker
    @Published var allLabels: [IssueLabel] = []

    // Projects for picker
    @Published var allProjects: [Project] = []

    private let pageSize = 20

    var hasMore: Bool { tasks.count < total }

    // MARK: - Query building

    private func buildQueryItems(offset: Int) -> [URLQueryItem] {
        var items: [URLQueryItem] = [
            URLQueryItem(name: "limit", value: String(pageSize)),
            URLQueryItem(name: "offset", value: String(offset)),
        ]
        if let apiValue = statusFilter.apiValue {
            items.append(URLQueryItem(name: "status", value: apiValue))
        }
        if !labelFilters.isEmpty {
            items.append(URLQueryItem(name: "label", value: labelFilters.joined(separator: ",")))
        }
        if !projectFilters.isEmpty || includeNoProject {
            var parts: [String] = []
            if includeNoProject { parts.append("none") }
            parts.append(contentsOf: projectFilters.map(String.init))
            items.append(URLQueryItem(name: "projectId", value: parts.joined(separator: ",")))
        }
        if bookmarkFilter {
            items.append(URLQueryItem(name: "bookmarked", value: "true"))
        }
        if !searchQuery.isEmpty {
            items.append(URLQueryItem(name: "search", value: searchQuery))
        }
        return items
    }

    // MARK: - Load

    func loadTasks() async {
        logger.info("loadTasks called")
        isLoading = true
        error = nil

        do {
            let response: TaskListResponse = try await APIClient.shared.get(
                path: "/api/tasks",
                queryItems: buildQueryItems(offset: 0)
            )
            tasks = response.data
            total = response.total
            logger.info("loadTasks done: count=\(response.data.count), total=\(response.total)")
        } catch {
            self.error = error.localizedDescription
            logger.error("loadTasks error: \(error.localizedDescription)")
        }

        isLoading = false
    }

    // MARK: - Fetch without UI update (for pull-to-refresh)

    func fetchTasks() async -> TaskListResponse? {
        do {
            return try await APIClient.shared.get(
                path: "/api/tasks",
                queryItems: buildQueryItems(offset: 0)
            )
        } catch {
            self.error = error.localizedDescription
            return nil
        }
    }

    func fetchOlderTasks() async -> TaskListResponse? {
        guard hasMore, !isLoadingMore else { return nil }
        do {
            return try await APIClient.shared.get(
                path: "/api/tasks",
                queryItems: buildQueryItems(offset: tasks.count)
            )
        } catch is CancellationError {
            return nil
        } catch {
            self.error = error.localizedDescription
            return nil
        }
    }

    func applyTasks(_ response: TaskListResponse) {
        tasks = response.data
        total = response.total
    }

    func applyOlderTasks(_ response: TaskListResponse) {
        tasks.append(contentsOf: response.data)
        total = response.total
    }

    func loadOlderTasks() async {
        logger.info("loadOlderTasks: hasMore=\(self.hasMore), isLoadingMore=\(self.isLoadingMore), count=\(self.tasks.count), total=\(self.total)")
        guard hasMore, !isLoadingMore else {
            logger.info("loadOlderTasks skipped")
            return
        }
        isLoadingMore = true

        do {
            let response: TaskListResponse = try await APIClient.shared.get(
                path: "/api/tasks",
                queryItems: buildQueryItems(offset: tasks.count)
            )
            tasks.append(contentsOf: response.data)
            total = response.total
            logger.info("loadOlderTasks done: count=\(self.tasks.count), total=\(self.total)")
        } catch is CancellationError {
            logger.info("loadOlderTasks cancelled")
        } catch {
            self.error = error.localizedDescription
            logger.error("loadOlderTasks error: \(error.localizedDescription)")
        }

        isLoadingMore = false
    }

    // MARK: - Load labels for filter picker

    func loadLabels() async {
        do {
            allLabels = try await APIClient.shared.get(path: "/api/labels")
        } catch {
            logger.error("loadLabels error: \(error.localizedDescription)")
        }
    }

    // MARK: - Load projects for filter picker

    func loadProjects() async {
        do {
            allProjects = try await APIClient.shared.get(path: "/api/projects")
        } catch {
            logger.error("loadProjects error: \(error.localizedDescription)")
        }
    }

    // MARK: - Filter actions

    func setStatusFilter(_ status: TaskStatusFilter) {
        statusFilter = status
        Task { await loadTasks() }
    }

    func setLabelFilters(_ labels: Set<String>) {
        labelFilters = labels
        Task { await loadTasks() }
    }

    func setProjectFilters(_ projectIds: Set<Int>, includeNone: Bool) {
        projectFilters = projectIds
        includeNoProject = includeNone
        Task { await loadTasks() }
    }

    func toggleBookmarkFilter() {
        bookmarkFilter.toggle()
        Task { await loadTasks() }
    }

    func search() {
        Task { await loadTasks() }
    }
}

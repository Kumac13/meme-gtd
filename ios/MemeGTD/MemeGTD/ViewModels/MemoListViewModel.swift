import Combine
import os
import SwiftUI

private let logger = Logger(subsystem: "name.kumac.MemeGTD", category: "MemoList")

private let dateFormatter: DateFormatter = {
    let f = DateFormatter()
    f.dateFormat = "yyyy-MM-dd"
    f.locale = Locale(identifier: "en_US_POSIX")
    return f
}()

@MainActor
class MemoListViewModel: ObservableObject {
    @Published var memos: [Memo] = []
    @Published var total: Int = 0
    @Published var isLoading: Bool = false
    @Published var isLoadingMore: Bool = false
    @Published var error: String?
    @Published var newMemoBody: String = ""
    @Published var isCreating: Bool = false
    @Published var bookmarkFilter: Bool = false
    @Published var filterState = SearchFilterState()
    @Published var allLabels: [IssueLabel] = []

    private let pageSize = 20

    var hasMore: Bool { memos.count < total }

    // MARK: - Query building

    private func buildQueryItems(offset: Int) -> [URLQueryItem] {
        var queryItems: [URLQueryItem] = [
            URLQueryItem(name: "limit", value: String(pageSize)),
            URLQueryItem(name: "offset", value: String(offset)),
        ]
        if bookmarkFilter {
            queryItems.append(URLQueryItem(name: "bookmarked", value: "true"))
        }
        if !filterState.selectedLabels.isEmpty {
            queryItems.append(URLQueryItem(name: "label", value: filterState.selectedLabels.sorted().joined(separator: ",")))
        }
        let searchText = filterState.searchText.trimmingCharacters(in: .whitespaces)
        if !searchText.isEmpty {
            queryItems.append(URLQueryItem(name: "search", value: searchText))
        }
        if let dateFrom = filterState.dateFrom {
            queryItems.append(URLQueryItem(name: "createdFrom", value: dateFormatter.string(from: dateFrom)))
        }
        if let dateTo = filterState.dateTo {
            queryItems.append(URLQueryItem(name: "createdTo", value: dateFormatter.string(from: dateTo)))
        }
        return queryItems
    }

    // MARK: - Load

    func loadMemos() async {
        logger.info("loadMemos called")
        isLoading = true
        error = nil

        do {
            let response: MemoListResponse = try await APIClient.shared.get(
                path: "/api/memos",
                queryItems: buildQueryItems(offset: 0)
            )
            memos = response.data
            total = response.total
            logger.info("loadMemos done: count=\(response.data.count), total=\(response.total)")
        } catch {
            self.error = error.localizedDescription
            logger.error("loadMemos error: \(error.localizedDescription)")
        }

        isLoading = false
    }

    // MARK: - Fetch without UI update (for pull-to-refresh)

    func fetchMemos() async -> MemoListResponse? {
        do {
            return try await APIClient.shared.get(
                path: "/api/memos",
                queryItems: buildQueryItems(offset: 0)
            )
        } catch {
            self.error = error.localizedDescription
            return nil
        }
    }

    func fetchOlderMemos() async -> MemoListResponse? {
        guard hasMore, !isLoadingMore else { return nil }
        do {
            return try await APIClient.shared.get(
                path: "/api/memos",
                queryItems: buildQueryItems(offset: memos.count)
            )
        } catch is CancellationError {
            return nil
        } catch {
            self.error = error.localizedDescription
            return nil
        }
    }

    func applyMemos(_ response: MemoListResponse) {
        memos = response.data
        total = response.total
    }

    func applyOlderMemos(_ response: MemoListResponse) {
        memos.append(contentsOf: response.data)
        total = response.total
    }

    func loadOlderMemos() async {
        logger.info("loadOlderMemos: hasMore=\(self.hasMore), isLoadingMore=\(self.isLoadingMore), count=\(self.memos.count), total=\(self.total)")
        guard hasMore, !isLoadingMore else {
            logger.info("loadOlderMemos skipped")
            return
        }
        isLoadingMore = true

        do {
            let response: MemoListResponse = try await APIClient.shared.get(
                path: "/api/memos",
                queryItems: buildQueryItems(offset: memos.count)
            )
            memos.append(contentsOf: response.data)
            total = response.total
            logger.info("loadOlderMemos done: count=\(self.memos.count), total=\(self.total)")
        } catch is CancellationError {
            logger.info("loadOlderMemos cancelled")
        } catch {
            self.error = error.localizedDescription
            logger.error("loadOlderMemos error: \(error.localizedDescription)")
        }

        isLoadingMore = false
    }

    func createMemo() async {
        let body = newMemoBody.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !body.isEmpty else { return }

        isCreating = true

        do {
            let request = CreateMemoRequest(bodyMd: body)
            let memo: Memo = try await APIClient.shared.post(
                path: "/api/memos",
                body: request
            )
            memos.insert(memo, at: 0)
            total += 1
            newMemoBody = ""
            HapticManager.notification(.success)
        } catch {
            self.error = error.localizedDescription
            HapticManager.notification(.error)
        }

        isCreating = false
    }

    func deleteMemo(_ id: Int) async {
        do {
            try await APIClient.shared.delete(path: "/api/memos/\(id)")
            memos.removeAll { $0.id == id }
            total -= 1
        } catch {
            self.error = error.localizedDescription
        }
    }

    func toggleBookmarkFilter() {
        bookmarkFilter.toggle()
        Task { await loadMemos() }
    }

    // MARK: - Filter operations

    func applyFilters(_ newState: SearchFilterState) {
        filterState = newState
        Task { await loadMemos() }
    }

    func removeSearchFilter() {
        filterState.searchText = ""
        Task { await loadMemos() }
    }

    func removeLabelFilter(_ label: String) {
        filterState.selectedLabels.remove(label)
        Task { await loadMemos() }
    }

    func removeDateFromFilter() {
        filterState.dateFrom = nil
        Task { await loadMemos() }
    }

    func removeDateToFilter() {
        filterState.dateTo = nil
        Task { await loadMemos() }
    }

    // MARK: - Labels

    func loadLabels() async {
        do {
            allLabels = try await APIClient.shared.get(path: "/api/labels")
        } catch {
            // Non-critical
            logger.error("loadLabels error: \(error.localizedDescription)")
        }
    }
}

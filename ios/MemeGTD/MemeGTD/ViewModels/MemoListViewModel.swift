import Combine
import SwiftUI

@MainActor
class MemoListViewModel: ObservableObject {
    @Published var memos: [Memo] = []
    @Published var total: Int = 0
    @Published var isLoading: Bool = false
    @Published var isLoadingMore: Bool = false
    @Published var error: String?
    @Published var newMemoBody: String = ""
    @Published var isCreating: Bool = false
    @Published var searchQuery: String = ""
    @Published var bookmarkFilter: Bool = false

    private let pageSize = 20

    var hasMore: Bool { memos.count < total }

    func loadMemos() async {
        isLoading = true
        error = nil

        do {
            var queryItems: [URLQueryItem] = [
                URLQueryItem(name: "limit", value: String(pageSize)),
                URLQueryItem(name: "offset", value: "0"),
            ]
            if bookmarkFilter {
                queryItems.append(URLQueryItem(name: "bookmarked", value: "true"))
            }
            if !searchQuery.isEmpty {
                queryItems.append(URLQueryItem(name: "search", value: searchQuery))
            }

            let response: MemoListResponse = try await APIClient.shared.get(
                path: "/api/memos",
                queryItems: queryItems
            )
            memos = response.data
            total = response.total
        } catch {
            self.error = error.localizedDescription
        }

        isLoading = false
    }

    func loadOlderMemos() async {
        print("[MemoList] loadOlderMemos called: hasMore=\(hasMore), isLoadingMore=\(isLoadingMore), memos.count=\(memos.count), total=\(total)")
        guard hasMore, !isLoadingMore else {
            print("[MemoList] loadOlderMemos skipped")
            return
        }
        isLoadingMore = true

        do {
            var queryItems: [URLQueryItem] = [
                URLQueryItem(name: "limit", value: String(pageSize)),
                URLQueryItem(name: "offset", value: String(memos.count)),
            ]
            if bookmarkFilter {
                queryItems.append(URLQueryItem(name: "bookmarked", value: "true"))
            }
            if !searchQuery.isEmpty {
                queryItems.append(URLQueryItem(name: "search", value: searchQuery))
            }

            let response: MemoListResponse = try await APIClient.shared.get(
                path: "/api/memos",
                queryItems: queryItems
            )
            memos.append(contentsOf: response.data)
            total = response.total
        } catch {
            self.error = error.localizedDescription
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

    func search() {
        Task { await loadMemos() }
    }
}

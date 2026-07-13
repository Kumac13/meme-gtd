import XCTest
@testable import MemeGTD

@MainActor
final class IssuePickerSearchServiceTests: XCTestCase {
    func testSearchMergesSortsFiltersAndLimitsAllSources() async {
        let task = item(id: 1, type: "task", updatedAt: "2026-01-01T00:00:00Z")
        let memo = item(id: 2, type: "memo", updatedAt: "2026-03-01T00:00:00Z")
        let article = item(id: 3, type: "article", updatedAt: "2026-02-01T00:00:00Z")
        let service = IssuePickerSearchService(
            searchTasks: { _ in [task] },
            searchMemos: { _ in [memo] },
            searchArticles: { _ in [article] }
        )

        let results = await service.search(query: "query", excludingIDs: [2], limit: 1)

        XCTAssertEqual(results.map(\.id), [3])
    }

    func testSearchTrimsQueryBeforeForwarding() async {
        let recorder = QueryRecorder()
        let capture: IssuePickerSearchService.Search = { queryItems in
            await recorder.record(queryItems.first?.value)
            return []
        }
        let service = IssuePickerSearchService(
            searchTasks: capture,
            searchMemos: capture,
            searchArticles: capture
        )

        _ = await service.search(query: "  needle  ")

        let receivedValues = await recorder.values
        XCTAssertEqual(receivedValues.count, 3)
        XCTAssertEqual(Set(receivedValues.compactMap { $0 }), ["needle"])
    }

    private func item(id: Int, type: String, updatedAt: String) -> IssuePickerItem {
        IssuePickerItem(
            id: id,
            type: type,
            title: "Issue \(id)",
            status: nil,
            updatedAt: updatedAt
        )
    }
}

private actor QueryRecorder {
    private(set) var values: [String?] = []

    func record(_ value: String?) {
        values.append(value)
    }
}

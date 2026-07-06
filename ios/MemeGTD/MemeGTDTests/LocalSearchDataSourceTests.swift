import XCTest
import GRDB
@testable import MemeGTD

/// Phase 9 coverage: the Standalone-mode `LocalSearchDataSource` answering
/// keyword search with the server's LIKE-based semantics
/// (searchRepository.searchByKeyword): substring matching (the reason the
/// server avoids FTS5 — unicode61 cannot tokenize Japanese), comment bodies
/// included, one result per issue with grouped matches.
final class LocalSearchDataSourceTests: XCTestCase {
    private var database: AppDatabase!
    private var search: LocalSearchDataSource!
    private var memos: LocalMemoDataSource!
    private var tasks: LocalTaskDataSource!

    override func setUpWithError() throws {
        database = try AppDatabase.makeInMemory()
        search = LocalSearchDataSource(database: database)
        memos = LocalMemoDataSource(database: database)
        tasks = LocalTaskDataSource(database: database)
    }

    // MARK: - Helpers

    private func keyword(_ q: String, extra: [URLQueryItem] = []) async throws -> KeywordSearchResponse {
        try await search.keywordSearch(
            queryItems: [URLQueryItem(name: "q", value: q)] + extra
        )
    }

    private func makeTask(_ title: String, bodyMd: String? = nil, status: String? = nil) async throws -> TaskItem {
        try await tasks.createTask(CreateTaskRequest(
            title: title,
            bodyMd: bodyMd,
            status: status,
            taskKind: nil,
            scheduledStart: nil,
            scheduledEnd: nil,
            isAllDay: nil
        ))
    }

    // MARK: - Cross-type hits

    func testKeywordSearchHitsMemosAndTasks() async throws {
        let memo = try await memos.createMemo(CreateMemoRequest(bodyMd: "banana smoothie recipe"))
        let task = try await makeTask("Buy bananas", bodyMd: "from the market")
        _ = try await memos.createMemo(CreateMemoRequest(bodyMd: "unrelated note"))

        let response = try await keyword("banana")
        XCTAssertEqual(Set(response.results.map { $0.id }), Set([memo.id, task.id]))
        XCTAssertEqual(response.total, 2, "Server shape: total is the returned page length")

        let memoHit = try XCTUnwrap(response.results.first(where: { $0.id == memo.id }))
        XCTAssertEqual(memoHit.type, "memo")
        XCTAssertEqual(memoHit.bodyMd, "banana smoothie recipe")
        XCTAssertEqual(memoHit.matches.count, 1)
        XCTAssertEqual(memoHit.matches[0].field, "issue")
        XCTAssertNil(memoHit.matches[0].commentId)

        let taskHit = try XCTUnwrap(response.results.first(where: { $0.id == task.id }))
        XCTAssertEqual(taskHit.type, "task")
        XCTAssertEqual(taskHit.title, "Buy bananas")
    }

    func testTypesFilterRestrictsToOneType() async throws {
        _ = try await memos.createMemo(CreateMemoRequest(bodyMd: "apple pie"))
        let task = try await makeTask("apple harvest")

        let response = try await keyword("apple", extra: [
            URLQueryItem(name: "types", value: "task"),
        ])
        XCTAssertEqual(response.results.map { $0.id }, [task.id])
    }

    func testStatusLabelAndBookmarkFilters() async throws {
        let open = try await makeTask("meeting notes", status: "open")
        let done = try await makeTask("meeting minutes", status: "done")
        _ = try await tasks.bookmarkTask(id: done.id)

        // Status filter.
        var response = try await keyword("meeting", extra: [
            URLQueryItem(name: "status", value: "open"),
        ])
        XCTAssertEqual(response.results.map { $0.id }, [open.id])

        // Bookmarked filter.
        response = try await keyword("meeting", extra: [
            URLQueryItem(name: "bookmarked", value: "true"),
        ])
        XCTAssertEqual(response.results.map { $0.id }, [done.id])

        // Label filter (OR over names) + labels surface on the result.
        let labels = LocalLabelDataSource(database: database)
        let label = try await labels.createLabel(CreateLabelRequest(name: "standup", description: nil))
        _ = try await labels.assignLabel(issueId: open.id, AssignLabelRequest(labelId: label.id))
        response = try await keyword("meeting", extra: [
            URLQueryItem(name: "label", value: "standup,unused"),
        ])
        XCTAssertEqual(response.results.map { $0.id }, [open.id])
        XCTAssertEqual(response.results[0].labels, ["standup"])
    }

    // MARK: - Japanese (the reason for LIKE)

    func testJapaneseKeywordHitsIncludingMidString() async throws {
        let memo = try await memos.createMemo(CreateMemoRequest(bodyMd: "日本語テストのメモ"))
        let task = try await makeTask("日本語のタスク")
        _ = try await memos.createMemo(CreateMemoRequest(bodyMd: "English only"))

        // Leading substring.
        var response = try await keyword("日本語")
        XCTAssertEqual(Set(response.results.map { $0.id }), Set([memo.id, task.id]))

        // Mid-string substring — the case FTS5/unicode61 cannot answer
        // (a CJK run is one token) and the reason the server uses LIKE.
        response = try await keyword("メモ")
        XCTAssertEqual(response.results.map { $0.id }, [memo.id])
    }

    // MARK: - Matched text (server shape: title when the title hit, else body)

    func testMatchedTextIsTitleWhenTitleHitsElseBody() async throws {
        let titleHit = try await makeTask("needle in title", bodyMd: "plain body")
        let bodyHit = try await memos.createMemo(CreateMemoRequest(bodyMd: "a needle in the body"))

        let response = try await keyword("needle")
        let titleResult = try XCTUnwrap(response.results.first(where: { $0.id == titleHit.id }))
        XCTAssertEqual(titleResult.matches.first?.text, "needle in title")
        let bodyResult = try XCTUnwrap(response.results.first(where: { $0.id == bodyHit.id }))
        XCTAssertEqual(bodyResult.matches.first?.text, "a needle in the body")
    }

    // MARK: - Comment matches

    func testCommentBodyMatchIsGroupedUnderItsIssue() async throws {
        let memo = try await memos.createMemo(CreateMemoRequest(bodyMd: "plain memo"))
        let comment = try await memos.createComment(
            memoId: memo.id,
            CreateCommentRequest(bodyMd: "the keyword hides in a comment")
        )

        let response = try await keyword("hides")
        XCTAssertEqual(response.results.map { $0.id }, [memo.id], "one result per issue")
        let match = try XCTUnwrap(response.results[0].matches.first)
        XCTAssertEqual(match.field, "comment")
        XCTAssertEqual(match.commentId, comment.id)
        XCTAssertEqual(match.text, "the keyword hides in a comment")
    }

    // MARK: - Search follows writes

    func testSearchFollowsInsertUpdateAndDelete() async throws {
        let memo = try await memos.createMemo(CreateMemoRequest(bodyMd: "first draft"))

        var response = try await keyword("draft")
        XCTAssertEqual(response.results.map { $0.id }, [memo.id])

        // Update: the new term hits, the old term no longer does.
        _ = try await memos.updateMemo(
            id: memo.id,
            UpdateMemoRequest(bodyMd: "final version", isBookmarked: nil)
        )
        response = try await keyword("version")
        XCTAssertEqual(response.results.map { $0.id }, [memo.id])
        response = try await keyword("draft")
        XCTAssertTrue(response.results.isEmpty)

        // Delete (hard in Standalone): nothing hits.
        try await memos.deleteMemo(id: memo.id)
        response = try await keyword("version")
        XCTAssertTrue(response.results.isEmpty)
    }

    func testTaskTitleUpdateIsSearchable() async throws {
        let task = try await makeTask("old headline")
        _ = try await tasks.updateTask(
            id: task.id,
            UpdateTaskRequest(title: "fresh headline", bodyMd: nil, status: nil)
        )

        let response = try await keyword("fresh")
        XCTAssertEqual(response.results.map { $0.id }, [task.id])
    }

    // MARK: - Query hygiene

    func testQuotesInQueryMatchAsPlainSubstring() async throws {
        _ = try await memos.createMemo(CreateMemoRequest(bodyMd: #"say "hello" AND goodbye"#))

        // LIKE has no query syntax: quotes and AND arrive as literal text.
        let response = try await keyword(#""hello" AND"#)
        XCTAssertEqual(response.results.count, 1)

        let empty = try await keyword("   ")
        XCTAssertTrue(empty.results.isEmpty)
    }

    func testPaginationEchoesLimitAndOffset() async throws {
        for index in 0..<3 {
            let memo = try await memos.createMemo(CreateMemoRequest(bodyMd: "pagetest item \(index)"))
            try await database.dbWriter.write { db in
                try db.execute(
                    sql: "UPDATE issues SET updated_at = ? WHERE rowid = ?",
                    arguments: ["2026-06-0\(index + 1)T00:00:00.000Z", -memo.id]
                )
            }
        }

        let response = try await keyword("pagetest", extra: [
            URLQueryItem(name: "limit", value: "1"),
            URLQueryItem(name: "offset", value: "1"),
        ])
        XCTAssertEqual(response.results.count, 1)
        XCTAssertEqual(response.limit, 1)
        XCTAssertEqual(response.offset, 1)
        // updated_at DESC: offset 1 of [item 2, item 1, item 0] is item 1.
        XCTAssertEqual(response.results[0].bodyMd, "pagetest item 1")
    }

    // MARK: - Semantic / export stand-ins

    func testSemanticSearchAnswersEmpty() async throws {
        let response = try await search.semanticSearch(queryItems: [
            URLQueryItem(name: "q", value: "anything"),
        ])
        XCTAssertTrue(response.results.isEmpty)
        XCTAssertEqual(response.meta.query, "anything")
    }

    func testExportIsRefused() async throws {
        let request = SearchExportRequest(
            type: "memos",
            filters: SearchExportFilters(),
            itemIds: [],
            matchedComments: nil,
            matchedScores: nil,
            includeComments: false
        )
        do {
            _ = try await search.exportSearchResults(request)
            XCTFail("Expected StandaloneUnavailableError")
        } catch is StandaloneUnavailableError {
            // expected
        }
    }
}

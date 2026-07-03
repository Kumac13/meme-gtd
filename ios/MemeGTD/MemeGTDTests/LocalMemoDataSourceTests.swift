import XCTest
import GRDB
@testable import MemeGTD

/// Phase 8 coverage: the Standalone-mode `LocalMemoDataSource` (pure local
/// CRUD, NO outbox, NO network) and the Standalone label source.
///
/// Unlike the offline-first tests there is no remote double at all: the data
/// source has no remote to fall back to, so every path must be answered by
/// the local database or fail with a local error. Each write test also
/// asserts the outbox stays empty — standalone writes must never enqueue
/// anything for a sync engine that is not running.
final class LocalMemoDataSourceTests: XCTestCase {
    private var database: AppDatabase!
    private var dataSource: LocalMemoDataSource!

    override func setUpWithError() throws {
        database = try AppDatabase.makeInMemory()
        dataSource = LocalMemoDataSource(database: database)
    }

    // MARK: - Helpers

    private func outboxCount() async throws -> Int {
        try await database.dbWriter.read { db in
            try Int.fetchOne(db, sql: "SELECT COUNT(*) FROM pending_operations") ?? -1
        }
    }

    private func listMemos(_ items: [URLQueryItem] = []) async throws -> MemoListResponse {
        try await dataSource.listMemos(queryItems: items)
    }

    /// Pins a local-only memo's created_at (its protocol id is -rowid).
    private func setCreatedAt(_ createdAt: String, memoId: Int) async throws {
        try await database.dbWriter.write { db in
            try db.execute(
                sql: "UPDATE issues SET created_at = ? WHERE rowid = ?",
                arguments: [createdAt, -memoId]
            )
        }
    }

    // MARK: - Memo CRUD lifecycle

    func testMemoCrudLifecycleKeepsOutboxEmpty() async throws {
        let created = try await dataSource.createMemo(CreateMemoRequest(bodyMd: "standalone memo"))
        XCTAssertLessThan(created.id, 0, "Rows without a server identity surface negative local ids")
        XCTAssertEqual(created.bodyMd, "standalone memo")
        XCTAssertFalse(created.isBookmarked)

        var page = try await listMemos()
        XCTAssertEqual(page.data.map(\.id), [created.id])
        XCTAssertEqual(page.total, 1)

        let fetched = try await dataSource.getMemo(id: created.id)
        XCTAssertEqual(fetched.bodyMd, "standalone memo")

        let updated = try await dataSource.updateMemo(
            id: created.id,
            UpdateMemoRequest(bodyMd: "edited", isBookmarked: nil)
        )
        XCTAssertEqual(updated.id, created.id)
        XCTAssertEqual(updated.bodyMd, "edited")

        let bookmarked = try await dataSource.bookmarkMemo(id: created.id)
        XCTAssertTrue(bookmarked.isBookmarked)
        XCTAssertEqual(bookmarked.bodyMd, "edited", "Bookmarking must not clobber the body")

        let unbookmarked = try await dataSource.unbookmarkMemo(id: created.id)
        XCTAssertFalse(unbookmarked.isBookmarked)

        try await dataSource.deleteMemo(id: created.id)
        page = try await listMemos()
        XCTAssertTrue(page.data.isEmpty)
        XCTAssertEqual(page.total, 0)

        let issueRows = try await database.dbWriter.read { db in
            try Int.fetchOne(db, sql: "SELECT COUNT(*) FROM issues") ?? -1
        }
        XCTAssertEqual(issueRows, 0, "Standalone deletes are hard deletes: nothing ever syncs, so no tombstone is needed")

        let outbox = try await outboxCount()
        XCTAssertEqual(outbox, 0, "Standalone writes never touch the outbox")
    }

    func testGetMemoThrowsForUnknownIdInsteadOfDelegating() async throws {
        // Positive (server-looking) ids must be answered locally too: there
        // is no remote in standalone mode, so an unknown id is simply gone.
        do {
            _ = try await dataSource.getMemo(id: 12345)
            XCTFail("Expected LocalMemoError.memoNotFound")
        } catch let error as LocalMemoError {
            XCTAssertEqual(error, .memoNotFound)
        }
    }

    // MARK: - Comment CRUD

    func testCommentCrudKeepsOutboxEmpty() async throws {
        let memo = try await dataSource.createMemo(CreateMemoRequest(bodyMd: "parent"))

        let comment = try await dataSource.createComment(
            memoId: memo.id,
            CreateCommentRequest(bodyMd: "first")
        )
        XCTAssertLessThan(comment.id, 0)
        XCTAssertEqual(comment.issueId, memo.id)
        XCTAssertEqual(comment.bodyMd, "first")

        var comments = try await dataSource.listComments(memoId: memo.id)
        XCTAssertEqual(comments.map(\.bodyMd), ["first"])

        let withCount = try await dataSource.getMemo(id: memo.id)
        XCTAssertEqual(withCount.commentCount, 1)

        let updated = try await dataSource.updateComment(
            memoId: memo.id,
            commentId: comment.id,
            UpdateCommentRequest(bodyMd: "edited")
        )
        XCTAssertEqual(updated.id, comment.id)
        XCTAssertEqual(updated.bodyMd, "edited")

        try await dataSource.deleteComment(memoId: memo.id, commentId: comment.id)
        comments = try await dataSource.listComments(memoId: memo.id)
        XCTAssertTrue(comments.isEmpty)

        let commentRows = try await database.dbWriter.read { db in
            try Int.fetchOne(db, sql: "SELECT COUNT(*) FROM comments") ?? -1
        }
        XCTAssertEqual(commentRows, 0, "Standalone comment deletes are hard deletes")

        let outbox = try await outboxCount()
        XCTAssertEqual(outbox, 0, "Standalone comment writes never touch the outbox")
    }

    func testDeleteMemoDropsItsComments() async throws {
        let memo = try await dataSource.createMemo(CreateMemoRequest(bodyMd: "parent"))
        _ = try await dataSource.createComment(memoId: memo.id, CreateCommentRequest(bodyMd: "child"))

        try await dataSource.deleteMemo(id: memo.id)

        let commentRows = try await database.dbWriter.read { db in
            try Int.fetchOne(db, sql: "SELECT COUNT(*) FROM comments") ?? -1
        }
        XCTAssertEqual(commentRows, 0)
    }

    // MARK: - List filters

    func testListFiltersBookmarkLabelSearchAndCreatedDates() async throws {
        let a = try await dataSource.createMemo(CreateMemoRequest(bodyMd: "alpha apple"))
        let b = try await dataSource.createMemo(CreateMemoRequest(bodyMd: "beta banana"))
        let c = try await dataSource.createMemo(CreateMemoRequest(bodyMd: "gamma cherry"))
        _ = try await dataSource.bookmarkMemo(id: b.id)

        // Pin created_at to distinct days, each > 1 day away from the filter
        // bounds so the DATE(..., 'localtime') conversion cannot move a memo
        // across a boundary regardless of the machine's timezone.
        try await setCreatedAt("2026-06-01T12:00:00.000Z", memoId: a.id)
        try await setCreatedAt("2026-06-10T12:00:00.000Z", memoId: b.id)
        try await setCreatedAt("2026-06-20T12:00:00.000Z", memoId: c.id)

        // Label 'work' on a and b (assignment itself is out of scope in
        // standalone; rows mimic previously pulled data).
        try await database.dbWriter.write { db in
            try db.execute(sql: """
                INSERT INTO labels (name, server_id, description, created_at)
                VALUES ('work', 1, NULL, '2026-01-01T00:00:00.000Z')
                """)
            for id in [a.id, b.id] {
                try db.execute(
                    sql: """
                        INSERT INTO issue_labels (issue_uuid, label_name)
                        SELECT uuid, 'work' FROM issues WHERE rowid = ?
                        """,
                    arguments: [-id]
                )
            }
        }

        // Bookmarked only.
        var page = try await listMemos([URLQueryItem(name: "bookmarked", value: "true")])
        XCTAssertEqual(page.data.map(\.id), [b.id])
        XCTAssertEqual(page.total, 1)

        // Label filter (OR semantics over the given names).
        page = try await listMemos([URLQueryItem(name: "label", value: "work")])
        XCTAssertEqual(Set(page.data.map(\.id)), Set([a.id, b.id]))
        XCTAssertEqual(page.data.first?.labels, ["work"], "Assigned labels surface on the model")

        // Plain LIKE substring search.
        page = try await listMemos([URLQueryItem(name: "search", value: "banana")])
        XCTAssertEqual(page.data.map(\.id), [b.id])

        // Created date range.
        page = try await listMemos([
            URLQueryItem(name: "createdFrom", value: "2026-06-05"),
            URLQueryItem(name: "createdTo", value: "2026-06-15"),
        ])
        XCTAssertEqual(page.data.map(\.id), [b.id])
    }

    func testListOrderLimitAndOffset() async throws {
        let a = try await dataSource.createMemo(CreateMemoRequest(bodyMd: "oldest"))
        let b = try await dataSource.createMemo(CreateMemoRequest(bodyMd: "middle"))
        let c = try await dataSource.createMemo(CreateMemoRequest(bodyMd: "newest"))
        try await setCreatedAt("2026-06-01T12:00:00.000Z", memoId: a.id)
        try await setCreatedAt("2026-06-02T12:00:00.000Z", memoId: b.id)
        try await setCreatedAt("2026-06-03T12:00:00.000Z", memoId: c.id)

        // Default order: created_at DESC.
        var page = try await listMemos()
        XCTAssertEqual(page.data.map(\.id), [c.id, b.id, a.id])

        // Ascending, one page of one starting at offset 1.
        page = try await listMemos([
            URLQueryItem(name: "order", value: "asc"),
            URLQueryItem(name: "limit", value: "1"),
            URLQueryItem(name: "offset", value: "1"),
        ])
        XCTAssertEqual(page.data.map(\.id), [b.id])
        XCTAssertEqual(page.total, 3)
        XCTAssertEqual(page.limit, 1)
        XCTAssertEqual(page.offset, 1)
    }

    func testProjectFilterAnswersEmptyPage() async throws {
        _ = try await dataSource.createMemo(CreateMemoRequest(bodyMd: "unfiltered"))

        // Project membership has no full local mirror: the honest standalone
        // answer to a project-filtered list is an empty page, never an error.
        let page = try await listMemos([
            URLQueryItem(name: "projectId", value: "3"),
            URLQueryItem(name: "limit", value: "20"),
        ])
        XCTAssertTrue(page.data.isEmpty)
        XCTAssertEqual(page.total, 0)
        XCTAssertEqual(page.limit, 20)
    }

    // MARK: - Promote

    func testPromotePreviewThrowsStandaloneUnavailable() async throws {
        do {
            _ = try await dataSource.promotePreview(memoId: 1)
            XCTFail("Expected StandaloneUnavailableError")
        } catch let error as StandaloneUnavailableError {
            XCTAssertEqual(
                error.localizedDescription,
                "Promote is not available in Standalone mode."
            )
        }
    }
}

/// Phase 8 coverage: `LocalLabelDataSource` serves the label-filter picker
/// from the local mirror in Standalone mode. (Label writes became local
/// operations in Phase 9 — see LocalLabelWritesTests.)
final class LocalLabelDataSourceTests: XCTestCase {
    private var database: AppDatabase!
    private var dataSource: LocalLabelDataSource!

    override func setUpWithError() throws {
        database = try AppDatabase.makeInMemory()
        dataSource = LocalLabelDataSource(database: database)
    }

    func testListLabelsReturnsLocalMirrorWithUsageCounts() async throws {
        // One synced label, one memo using it (deleted issues must not count).
        try await database.dbWriter.write { db in
            try db.execute(sql: """
                INSERT INTO labels (name, server_id, description, created_at)
                VALUES ('work', 7, 'Work stuff', '2026-01-01T00:00:00.000Z')
                """)
            for (uuid, deleted) in [("m-1", false), ("m-2", true)] {
                try db.execute(
                    sql: """
                        INSERT INTO issues (uuid, type, body_md, is_deleted, created_at, updated_at)
                        VALUES (?, 'memo', 'body', ?, '2026-06-01T00:00:00.000Z', '2026-06-01T00:00:00.000Z')
                        """,
                    arguments: [uuid, deleted]
                )
                try db.execute(
                    sql: "INSERT INTO issue_labels (issue_uuid, label_name) VALUES (?, 'work')",
                    arguments: [uuid]
                )
            }
        }

        let labels = try await dataSource.listLabels()
        XCTAssertEqual(labels.count, 1)
        XCTAssertEqual(labels[0].id, 7, "Synced labels surface their server id")
        XCTAssertEqual(labels[0].name, "work")
        XCTAssertEqual(labels[0].description, "Work stuff")
        XCTAssertEqual(labels[0].memoCount, 1, "Deleted issues are excluded from usage counts")
        XCTAssertEqual(labels[0].taskCount, 0)
        XCTAssertEqual(labels[0].articleCount, 0)
    }

}

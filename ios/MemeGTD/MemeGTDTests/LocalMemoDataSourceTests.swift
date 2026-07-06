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

    // MARK: - Promote preview (Phase 11: local port of the server logic)

    /// Port of packages/db/test/memoRepository.test.ts
    /// "promote preview returns memo body and labels".
    func testPromotePreviewReturnsBodyAndLabels() async throws {
        let memo = try await dataSource.createMemo(CreateMemoRequest(bodyMd: "draft task"))
        try await assignLabels(["idea"], memoId: memo.id)

        let preview = try await dataSource.promotePreview(memoId: memo.id)
        XCTAssertEqual(preview.bodyMd, "draft task")
        XCTAssertEqual(preview.labels, ["idea"])
        XCTAssertEqual(preview.projectIds, [])
        XCTAssertTrue(preview.linkedIssues.isEmpty)
    }

    /// Port of packages/api/test/integration/memos.test.ts
    /// "should return memo body with comments inlined": same inputs, and the
    /// exact body string is anchored to real TS `buildPromoteBody` output.
    func testPromotePreviewInlinesCommentsInCreatedAtOrder() async throws {
        let memo = try await dataSource.createMemo(CreateMemoRequest(bodyMd: "Preview memo body"))
        let first = try await dataSource.createComment(
            memoId: memo.id, CreateCommentRequest(bodyMd: "thought A")
        )
        let second = try await dataSource.createComment(
            memoId: memo.id, CreateCommentRequest(bodyMd: "thought B")
        )
        // Pin comment timestamps so the created_at ASC order is deterministic
        // even if both inserts land in the same millisecond.
        try await setCommentCreatedAt("2026-07-01T10:00:00.000Z", commentId: first.id)
        try await setCommentCreatedAt("2026-07-01T11:30:00.000Z", commentId: second.id)

        let preview = try await dataSource.promotePreview(memoId: memo.id)
        XCTAssertEqual(
            preview.bodyMd,
            "Preview memo body\n\n---\n## コメント\n\n### 2026-07-01T10:00:00.000Z\nthought A\n\n### 2026-07-01T11:30:00.000Z\nthought B"
        )
    }

    /// Port of "should return just memo body when there are no comments" —
    /// including the case where a comment existed but was deleted.
    func testPromotePreviewExcludesDeletedComments() async throws {
        let memo = try await dataSource.createMemo(CreateMemoRequest(bodyMd: "Lonely memo"))
        let comment = try await dataSource.createComment(
            memoId: memo.id, CreateCommentRequest(bodyMd: "gone")
        )
        try await dataSource.deleteComment(memoId: memo.id, commentId: comment.id)

        let preview = try await dataSource.promotePreview(memoId: memo.id)
        XCTAssertEqual(preview.bodyMd, "Lonely memo")
    }

    /// Port of "should return 404 for a non-existent memo" (the local error
    /// takes the place of the HTTP status).
    func testPromotePreviewThrowsForUnknownMemo() async throws {
        do {
            _ = try await dataSource.promotePreview(memoId: 99999)
            XCTFail("Expected LocalMemoError.memoNotFound")
        } catch let error as LocalMemoError {
            XCTAssertEqual(error, .memoNotFound)
        }
    }

    /// Port of "should include memo labels in preview", tightened to assert
    /// the TS `listMemoLabels` ORDER BY name (the API test only checks
    /// membership).
    func testPromotePreviewLabelsAreSortedByName() async throws {
        let memo = try await dataSource.createMemo(CreateMemoRequest(bodyMd: "Labelled memo"))
        try await assignLabels(["urgent", "review"], memoId: memo.id)

        let preview = try await dataSource.promotePreview(memoId: memo.id)
        XCTAssertEqual(preview.labels, ["review", "urgent"])
    }

    /// Port of "should include outgoing and incoming links with target issue
    /// info", driven through the real Standalone link source.
    func testPromotePreviewIncludesLinksWithTargetInfo() async throws {
        let other = try await dataSource.createMemo(CreateMemoRequest(bodyMd: "Other memo body"))
        let memo = try await dataSource.createMemo(CreateMemoRequest(bodyMd: "Source memo"))
        let links = LocalIssueRelationsDataSource(database: database)
        _ = try await links.createLink(
            CreateLinkRequest(sourceIssueId: memo.id, targetIssueId: other.id, linkType: .relates)
        )

        let preview = try await dataSource.promotePreview(memoId: memo.id)
        XCTAssertEqual(preview.linkedIssues.count, 1)
        let link = try XCTUnwrap(preview.linkedIssues.first)
        XCTAssertEqual(link.direction, "outgoing")
        XCTAssertEqual(link.linkType, "relates")
        XCTAssertEqual(link.targetIssue.id, other.id)
        XCTAssertEqual(link.targetIssue.type, "memo")
        XCTAssertEqual(link.targetIssue.title, "Other memo body",
                       "Memos have no title: the collapsed body is the fallback")

        // The incoming side of the same link, seen from the other memo.
        let reverse = try await dataSource.promotePreview(memoId: other.id)
        XCTAssertEqual(reverse.linkedIssues.count, 1)
        XCTAssertEqual(reverse.linkedIssues.first?.direction, "incoming")
        XCTAssertEqual(reverse.linkedIssues.first?.targetIssue.id, memo.id)
    }

    /// Deleting the counterpart drops the link from the preview — the same
    /// observable behavior as the server's soft-delete exclusion (locally
    /// the delete is hard, so the dangling row is skipped).
    func testPromotePreviewExcludesLinksToDeletedIssues() async throws {
        let other = try await dataSource.createMemo(CreateMemoRequest(bodyMd: "doomed"))
        let memo = try await dataSource.createMemo(CreateMemoRequest(bodyMd: "survivor"))
        let links = LocalIssueRelationsDataSource(database: database)
        _ = try await links.createLink(
            CreateLinkRequest(sourceIssueId: memo.id, targetIssueId: other.id, linkType: .relates)
        )
        try await dataSource.deleteMemo(id: other.id)

        let preview = try await dataSource.promotePreview(memoId: memo.id)
        XCTAssertTrue(preview.linkedIssues.isEmpty)
    }

    /// Port of "should return empty arrays when memo has no labels,
    /// projects, or links".
    func testPromotePreviewEmptyArraysForBareMemo() async throws {
        let memo = try await dataSource.createMemo(CreateMemoRequest(bodyMd: "Bare memo"))

        let preview = try await dataSource.promotePreview(memoId: memo.id)
        XCTAssertEqual(preview.labels, [])
        XCTAssertEqual(preview.projectIds, [])
        XCTAssertTrue(preview.linkedIssues.isEmpty)
    }

    /// Standalone policy: projects are server-only, so even a stale
    /// `project_items` cache row (left over from Server-mode browsing) must
    /// not leak into the preview.
    func testPromotePreviewIgnoresCachedProjectItems() async throws {
        // A synced memo (positive server id) with a cached membership row.
        try await database.dbWriter.write { db in
            try db.execute(sql: """
                INSERT INTO issues (uuid, server_id, type, body_md, created_at, updated_at)
                VALUES ('m-synced', 42, 'memo', 'synced memo', '2026-06-01T00:00:00.000Z', '2026-06-01T00:00:00.000Z')
                """)
            try db.execute(sql: "INSERT INTO project_items (project_id, issue_id) VALUES (5, 42)")
        }

        let preview = try await dataSource.promotePreview(memoId: 42)
        XCTAssertEqual(preview.projectIds, [])
    }

    // MARK: - Promote preview helpers

    /// Assigns labels directly (label CRUD has its own coverage; the preview
    /// tests only need the rows to exist).
    private func assignLabels(_ names: [String], memoId: Int) async throws {
        try await database.dbWriter.write { db in
            for name in names {
                try db.execute(
                    sql: """
                        INSERT INTO labels (name, server_id, description, created_at)
                        VALUES (?, NULL, NULL, '2026-01-01T00:00:00.000Z')
                        """,
                    arguments: [name]
                )
                try db.execute(
                    sql: """
                        INSERT INTO issue_labels (issue_uuid, label_name)
                        SELECT uuid, ? FROM issues WHERE rowid = ?
                        """,
                    arguments: [name, -memoId]
                )
            }
        }
    }

    /// Pins a local-only comment's created_at (its protocol id is -rowid).
    private func setCommentCreatedAt(_ createdAt: String, commentId: Int) async throws {
        try await database.dbWriter.write { db in
            try db.execute(
                sql: "UPDATE comments SET created_at = ? WHERE rowid = ?",
                arguments: [createdAt, -commentId]
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

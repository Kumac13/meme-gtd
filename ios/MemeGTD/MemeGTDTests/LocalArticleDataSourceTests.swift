import XCTest
import GRDB
@testable import MemeGTD

/// Phase 10 coverage: the Standalone-mode `LocalArticleDataSource` plus the
/// `LocalArticleStore.insertArticle` path the Share Extension uses to save
/// extracted articles into the App Group database.
///
/// Semantics asserted against the server reference implementation
/// (packages/db/src/articleRepository.ts / articleSchemas.ts): the meta JSON
/// shape ({ originalUrl, siteName, archivedAt } with archivedAt ==
/// created_at, siteName omitted when absent), the title-required validation,
/// the title-OR-body LIKE search, created_at DESC ordering with pagination,
/// and the Standalone hard-delete cleanup.
final class LocalArticleDataSourceTests: XCTestCase {
    private var database: AppDatabase!
    private var dataSource: LocalArticleDataSource!

    override func setUpWithError() throws {
        database = try AppDatabase.makeInMemory()
        dataSource = LocalArticleDataSource(database: database)
    }

    // MARK: - Helpers

    /// Inserts through the exact code path the Share Extension runs
    /// (ShareViewController.saveLocally) and returns the row's uuid.
    @discardableResult
    private func insertArticle(
        title: String,
        bodyMd: String = "archived body",
        originalUrl: String = "https://example.com/post",
        siteName: String? = "Example",
        now: String = ISO8601Millis.now()
    ) async throws -> String {
        let uuid = UUIDv7.generate()
        try await database.dbWriter.write { db in
            try LocalArticleStore.insertArticle(
                db,
                uuid: uuid,
                title: title,
                bodyMd: bodyMd,
                originalUrl: originalUrl,
                siteName: siteName,
                now: now
            )
        }
        return uuid
    }

    private func issueCount() async throws -> Int {
        try await database.dbWriter.read { db in
            try Int.fetchOne(db, sql: "SELECT COUNT(*) FROM issues") ?? -1
        }
    }

    // MARK: - Insert (Share Extension path) + read round trip

    func testManualArticleListResponseDecodesWithoutOriginalURL() throws {
        let json = #"""
        {
          "data": [{
            "id": 42,
            "type": "article",
            "title": "Manual article",
            "bodyMd": "- Name: Manual article",
            "origin": "manual",
            "meta": {"archivedAt": "2026-07-12T00:00:00.000Z"},
            "createdAt": "2026-07-12T00:00:00.000Z",
            "updatedAt": "2026-07-12T00:00:00.000Z",
            "isBookmarked": false,
            "isDeleted": false,
            "labels": ["Book"],
            "commentCount": 0
          }],
          "total": 1,
          "limit": 20,
          "offset": 0
        }
        """#.data(using: .utf8)!

        let response = try JSONDecoder().decode(ArticleListResponse.self, from: json)

        XCTAssertEqual(response.data.count, 1)
        XCTAssertEqual(response.data[0].origin, .manual)
        XCTAssertNil(response.data[0].meta?.originalUrl)
    }

    func testInsertRoundTripsMetaThroughListAndGet() async throws {
        let now = "2026-07-04T01:23:45.678Z"
        try await insertArticle(
            title: "Interesting article",
            bodyMd: "long archived content",
            originalUrl: "https://example.com/post",
            siteName: "Example",
            now: now
        )

        let list = try await dataSource.listArticles(queryItems: [])
        XCTAssertEqual(list.total, 1)
        XCTAssertEqual(list.data.count, 1)

        let listed = try XCTUnwrap(list.data.first)
        XCTAssertLessThan(listed.id, 0, "Rows without a server identity surface negative local ids")
        XCTAssertEqual(listed.type, "article")
        XCTAssertEqual(listed.title, "Interesting article")
        XCTAssertEqual(listed.bodyMd, "long archived content")
        XCTAssertEqual(listed.createdAt, now)
        XCTAssertEqual(listed.updatedAt, now)
        XCTAssertFalse(listed.isBookmarked)
        XCTAssertFalse(listed.isDeleted)
        XCTAssertEqual(listed.labels, [])
        XCTAssertEqual(listed.commentCount, 0)

        let meta = try XCTUnwrap(listed.meta)
        XCTAssertEqual(meta.originalUrl, "https://example.com/post")
        XCTAssertEqual(meta.siteName, "Example")
        XCTAssertEqual(meta.archivedAt, now, "Server stamps archivedAt with the creation time")

        let fetched = try await dataSource.getArticle(id: listed.id)
        XCTAssertEqual(fetched.id, listed.id)
        XCTAssertEqual(fetched.meta?.originalUrl, meta.originalUrl)
        XCTAssertEqual(fetched.meta?.siteName, meta.siteName)
        XCTAssertEqual(fetched.meta?.archivedAt, meta.archivedAt)
    }

    func testMetaJSONMatchesServerShape() async throws {
        // With a siteName: the flat three-key object the server stores.
        let withSite = try LocalArticleStore.metaJSON(ArticleMeta(
            originalUrl: "https://example.com/a?b=1",
            siteName: "Example",
            archivedAt: "2026-07-04T00:00:00.000Z"
        ))
        XCTAssertEqual(
            withSite,
            #"{"archivedAt":"2026-07-04T00:00:00.000Z","originalUrl":"https://example.com/a?b=1","siteName":"Example"}"#,
            "Slashes stay unescaped and keys are stable (sorted)"
        )

        // Without a siteName the key is omitted, like JSON.stringify drops
        // undefined on the server.
        let withoutSite = try LocalArticleStore.metaJSON(ArticleMeta(
            originalUrl: "https://example.com/a",
            siteName: nil,
            archivedAt: "2026-07-04T00:00:00.000Z"
        ))
        XCTAssertFalse(withoutSite.contains("siteName"))

        // Both decode back through the same helper the read path uses.
        let decoded = try XCTUnwrap(LocalArticleStore.articleMeta(from: withoutSite))
        XCTAssertEqual(decoded.originalUrl, "https://example.com/a")
        XCTAssertNil(decoded.siteName)
        XCTAssertEqual(decoded.archivedAt, "2026-07-04T00:00:00.000Z")
    }

    func testInsertRejectsEmptyTitle() async throws {
        // Mirrors articleSchemas.ts: title min length 1.
        do {
            try await insertArticle(title: "")
            XCTFail("Expected titleRequired")
        } catch let error as LocalArticleError {
            XCTAssertEqual(error, .titleRequired)
        }
        let count = try await issueCount()
        XCTAssertEqual(count, 0)
    }

    // MARK: - List / search

    func testListOrdersByCreatedAtDescAndPaginates() async throws {
        try await insertArticle(title: "Oldest", now: "2026-07-01T00:00:00.000Z")
        try await insertArticle(title: "Middle", now: "2026-07-02T00:00:00.000Z")
        try await insertArticle(title: "Newest", now: "2026-07-03T00:00:00.000Z")

        let all = try await dataSource.listArticles(queryItems: [])
        XCTAssertEqual(all.data.map { $0.title }, ["Newest", "Middle", "Oldest"])
        XCTAssertEqual(all.total, 3)

        let page = try await dataSource.listArticles(queryItems: [
            URLQueryItem(name: "limit", value: "1"),
            URLQueryItem(name: "offset", value: "1"),
        ])
        XCTAssertEqual(page.data.map { $0.title }, ["Middle"])
        XCTAssertEqual(page.total, 3, "total ignores pagination, like the server")
        XCTAssertEqual(page.limit, 1)
        XCTAssertEqual(page.offset, 1)
    }

    func testSearchMatchesTitleOrBody() async throws {
        try await insertArticle(title: "Swift Concurrency", bodyMd: "actors everywhere")
        try await insertArticle(title: "Cooking notes", bodyMd: "swift weeknight pasta")
        try await insertArticle(title: "Gardening", bodyMd: "tomatoes")

        // LIKE substring over title OR body (articleRepository.listArticles).
        let hits = try await dataSource.listArticles(queryItems: [
            URLQueryItem(name: "search", value: "swift")
        ])
        XCTAssertEqual(hits.total, 2)
        XCTAssertEqual(
            Set(hits.data.map { $0.title }),
            ["Swift Concurrency", "Cooking notes"]
        )

        let miss = try await dataSource.listArticles(queryItems: [
            URLQueryItem(name: "search", value: "no-match")
        ])
        XCTAssertEqual(miss.total, 0)
        XCTAssertTrue(miss.data.isEmpty)

        // The slim link-picker shape answers the same rows.
        let slim = try await dataSource.searchArticles(queryItems: [
            URLQueryItem(name: "search", value: "tomatoes")
        ])
        XCTAssertEqual(slim.data.map { $0.title }, ["Gardening"])
        XCTAssertEqual(slim.data.first?.type, "article")
    }

    // MARK: - Delete

    func testDeleteHardDeletesRowAndRelated() async throws {
        let uuid = try await insertArticle(title: "Doomed")
        try await database.dbWriter.write { db in
            try CommentRecord(
                uuid: "comment-1",
                serverId: nil,
                issueUuid: uuid,
                bodyMd: "note",
                createdAt: "2026-07-04T00:00:00.000Z",
                updatedAt: "2026-07-04T00:00:00.000Z",
                serverUpdatedAt: nil
            ).insert(db)
            try db.execute(
                sql: "INSERT INTO labels (name, created_at) VALUES ('tech', '2026-07-04T00:00:00.000Z')"
            )
            try db.execute(
                sql: "INSERT INTO issue_labels (issue_uuid, label_name) VALUES (?, 'tech')",
                arguments: [uuid]
            )
        }

        let list = try await dataSource.listArticles(queryItems: [])
        let id = try XCTUnwrap(list.data.first?.id)

        try await dataSource.deleteArticle(id: id)

        let leftovers = try await database.dbWriter.read { db in
            (
                issues: try Int.fetchOne(db, sql: "SELECT COUNT(*) FROM issues") ?? -1,
                comments: try Int.fetchOne(db, sql: "SELECT COUNT(*) FROM comments") ?? -1,
                assignments: try Int.fetchOne(db, sql: "SELECT COUNT(*) FROM issue_labels") ?? -1
            )
        }
        XCTAssertEqual(leftovers.issues, 0, "Standalone delete is a hard delete")
        XCTAssertEqual(leftovers.comments, 0)
        XCTAssertEqual(leftovers.assignments, 0)

        // A second delete reports not-found, as does a get.
        do {
            try await dataSource.deleteArticle(id: id)
            XCTFail("Expected articleNotFound")
        } catch let error as LocalArticleError {
            XCTAssertEqual(error, .articleNotFound)
        }
        do {
            _ = try await dataSource.getArticle(id: id)
            XCTFail("Expected articleNotFound")
        } catch let error as LocalArticleError {
            XCTAssertEqual(error, .articleNotFound)
        }
    }
}

import XCTest
@testable import MemeGTD

@MainActor
final class ArticleCopyContentsTests: XCTestCase {
    func testCopyAllContentsIncludesTitleSourceBodyAndComments() {
        let viewModel = ArticleDetailViewModel(articleId: 42)
        viewModel.article = Article(
            id: 42,
            type: "article",
            title: "Testing Swift",
            bodyMd: "Article body",
            origin: .web,
            meta: ArticleMeta(
                originalUrl: "https://example.com/article",
                siteName: "Example",
                archivedAt: "2026-07-28T00:00:00.000Z"
            ),
            createdAt: "2026-07-28T00:00:00.000Z",
            updatedAt: "2026-07-28T00:00:00.000Z",
            isBookmarked: false,
            isDeleted: false,
            labels: [],
            commentCount: 2
        )
        viewModel.comments = [
            Comment(
                id: 1,
                issueId: 42,
                bodyMd: "First comment",
                createdAt: "2026-07-28T01:00:00.000Z",
                updatedAt: "2026-07-28T01:00:00.000Z"
            ),
            Comment(
                id: 2,
                issueId: 42,
                bodyMd: "Second comment",
                createdAt: "2026-07-28T02:00:00.000Z",
                updatedAt: "2026-07-28T02:00:00.000Z"
            ),
        ]

        XCTAssertEqual(
            viewModel.copyAllContentsText,
            """
            # Testing Swift

            Source: https://example.com/article

            Article body

            ## Comments

            First comment

            ---

            Second comment
            """
        )
    }

    func testCopyAllContentsJSONPreservesArticleAndCommentDates() throws {
        let viewModel = ArticleDetailViewModel(articleId: 42)
        viewModel.article = Article(
            id: 42,
            type: "article",
            title: "Testing Swift",
            bodyMd: "Article body",
            origin: .web,
            meta: ArticleMeta(
                originalUrl: "https://example.com/article",
                siteName: "Example",
                archivedAt: "2026-08-06T00:00:00.000Z"
            ),
            createdAt: "2026-08-06T01:00:00.000Z",
            updatedAt: "2026-08-06T02:00:00.000Z",
            isBookmarked: false,
            isDeleted: false,
            labels: [],
            commentCount: 1
        )
        viewModel.comments = [
            Comment(
                id: 1,
                issueId: 42,
                bodyMd: "Comment body",
                createdAt: "2026-08-06T03:00:00.000Z",
                updatedAt: "2026-08-06T04:00:00.000Z"
            ),
        ]

        let json = try XCTUnwrap(viewModel.copyAllContentsJSONText)
        let data = try XCTUnwrap(json.data(using: .utf8))
        let payload = try XCTUnwrap(
            JSONSerialization.jsonObject(with: data) as? [String: Any]
        )
        let item = try XCTUnwrap(payload["item"] as? [String: Any])
        let comments = try XCTUnwrap(payload["comments"] as? [[String: Any]])

        XCTAssertEqual(item["createdAt"] as? String, "2026-08-06T01:00:00.000Z")
        XCTAssertEqual(item["updatedAt"] as? String, "2026-08-06T02:00:00.000Z")
        XCTAssertEqual(comments.first?["createdAt"] as? String, "2026-08-06T03:00:00.000Z")
        XCTAssertEqual(comments.first?["updatedAt"] as? String, "2026-08-06T04:00:00.000Z")
    }
}

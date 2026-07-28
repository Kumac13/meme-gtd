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
}

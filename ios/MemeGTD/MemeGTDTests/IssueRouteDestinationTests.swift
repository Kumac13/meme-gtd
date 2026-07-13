import XCTest

@testable import MemeGTD

final class IssueRouteDestinationTests: XCTestCase {
    func testResolvesEverySupportedIssueType() {
        XCTAssertEqual(
            IssueRouteDestination(id: 1, type: "memo", title: "Memo"),
            .memo(MemoRoute(memoId: 1, initialBody: "Memo"))
        )
        XCTAssertEqual(
            IssueRouteDestination(id: 2, type: "task", title: "Task"),
            .task(TaskRoute(taskId: 2, initialTitle: "Task"))
        )
        XCTAssertEqual(
            IssueRouteDestination(id: 3, type: "article", title: "Article"),
            .article(ArticleRoute(articleId: 3, initialTitle: "Article"))
        )
        XCTAssertEqual(
            IssueRouteDestination(id: 4, type: "template", title: "Template"),
            .template(TemplateRoute(templateId: 4, initialTitle: "Template"))
        )
    }

    func testUnknownOrMissingTypeDoesNotFallBackToTask() {
        XCTAssertNil(IssueRouteDestination(id: 5, type: "unknown", title: "Unknown"))
        XCTAssertNil(IssueRouteDestination(id: 6, type: nil, title: "Missing"))
    }
}

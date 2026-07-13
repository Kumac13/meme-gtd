import XCTest

@testable import MemeGTD

@MainActor
final class CreationPresentationTests: XCTestCase {
    func testArticleCreationModeHasFreshIdentityAndCapturesTemplate() {
        let template = Template(
            id: 42,
            type: "template",
            templateTarget: "article",
            title: "Reading notes",
            bodyMd: "## Summary",
            createdAt: "2026-07-13T00:00:00Z",
            updatedAt: "2026-07-13T00:00:00Z",
            isBookmarked: false,
            isDeleted: false,
            labels: ["reading"],
            projectIds: [7]
        )

        let first = CreateArticleMode(template: template)
        let second = CreateArticleMode(template: template)

        XCTAssertNotEqual(first.id, second.id)
        XCTAssertEqual(first.template?.id, 42)
        XCTAssertEqual(first.template?.bodyMd, "## Summary")
        XCTAssertEqual(first.template?.labels, ["reading"])
        XCTAssertEqual(first.template?.projectIds, [7])
    }
}

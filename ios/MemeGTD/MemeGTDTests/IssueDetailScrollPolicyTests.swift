import XCTest

@testable import MemeGTD

final class IssueDetailScrollPolicyTests: XCTestCase {
    func testTopInitialPositionDoesNotScrollWhenContentLoads() {
        let policy = IssueDetailScrollPolicy(initialPosition: .top)

        XCTAssertFalse(policy.shouldScrollToBottom(for: .initialContent))
    }

    func testBottomInitialPositionScrollsWhenContentLoads() {
        let policy = IssueDetailScrollPolicy(initialPosition: .bottom)

        XCTAssertTrue(policy.shouldScrollToBottom(for: .initialContent))
    }

    func testExplicitComposerAndSubmissionActionsAlwaysScroll() {
        for initialPosition in [IssueDetailInitialPosition.top, .bottom] {
            let policy = IssueDetailScrollPolicy(initialPosition: initialPosition)

            XCTAssertTrue(policy.shouldScrollToBottom(for: .composerExpanded))
            XCTAssertTrue(policy.shouldScrollToBottom(for: .submissionCompleted))
        }
    }
}

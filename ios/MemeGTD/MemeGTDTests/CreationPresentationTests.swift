import XCTest

@testable import MemeGTD

@MainActor
final class CreationPresentationTests: XCTestCase {
    private enum ExpectedFailure: Error {
        case failed
    }

    func testRepeatedTemplateSelectionsProduceFreshFormIdentity() {
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

        let coordinator = CreationPresentationCoordinator<Template?>()

        coordinator.beginChoosing()
        coordinator.choose(template)
        coordinator.chooserDidDismiss()
        let first = coordinator.activeRequest

        coordinator.dismissForm()
        coordinator.beginChoosing()
        coordinator.choose(template)
        coordinator.chooserDidDismiss()
        let second = coordinator.activeRequest

        XCTAssertNotEqual(first?.id, second?.id)
        XCTAssertEqual(first?.payload?.id, 42)
        XCTAssertEqual(second?.payload?.bodyMd, "## Summary")
        XCTAssertEqual(second?.payload?.labels, ["reading"])
        XCTAssertEqual(second?.payload?.projectIds, [7])
    }

    func testBlankOptionalPayloadIsPresentedAfterChooserDismissal() {
        let coordinator = CreationPresentationCoordinator<Template?>()

        coordinator.beginChoosing()
        coordinator.choose(nil)

        XCTAssertNil(coordinator.activeRequest)
        coordinator.chooserDidDismiss()
        XCTAssertNotNil(coordinator.activeRequest)
        XCTAssertNil(coordinator.activeRequest?.payload)
    }

    func testCancelDoesNotPresentAFormOrLeakPreviousSelection() {
        let coordinator = CreationPresentationCoordinator<String>()

        coordinator.beginChoosing()
        coordinator.choose("first")
        coordinator.cancelChooser()
        coordinator.chooserDidDismiss()

        XCTAssertNil(coordinator.activeRequest)

        coordinator.beginChoosing()
        coordinator.choose("second")
        coordinator.chooserDidDismiss()
        XCTAssertEqual(coordinator.activeRequest?.payload, "second")
    }

    func testMetadataOptionsKeepLabelsWhenProjectsFail() async {
        let label = IssueLabel(
            id: 1,
            name: "ios",
            description: nil,
            createdAt: "2026-07-13T00:00:00Z",
            memoCount: 0,
            taskCount: 1,
            articleCount: 2
        )

        let options = await CreateIssueMetadataOptionsLoader.load(
            labels: { [label] },
            projects: { throw ExpectedFailure.failed }
        )

        XCTAssertEqual(options.labels?.map(\.name), ["ios"])
        XCTAssertNil(options.projects)
    }

    func testMetadataOptionsKeepProjectsWhenLabelsFail() async {
        let project = Project(
            id: 7,
            name: "Shared UI",
            description: nil,
            status: "active",
            startDate: nil,
            endDate: nil,
            createdAt: "2026-07-13T00:00:00Z"
        )

        let options = await CreateIssueMetadataOptionsLoader.load(
            labels: { throw ExpectedFailure.failed },
            projects: { [project] }
        )

        XCTAssertNil(options.labels)
        XCTAssertEqual(options.projects?.map(\.name), ["Shared UI"])
    }

    func testDeferredSheetActionRunsOnlyAfterDismissal() {
        let coordinator = DeferredSheetActionCoordinator<String>()
        var navigatedTo: String?

        coordinator.present()
        coordinator.requestAfterDismiss("linked-task")

        XCTAssertFalse(coordinator.isPresented)
        XCTAssertNil(navigatedTo)

        coordinator.performPending { navigatedTo = $0 }
        XCTAssertEqual(navigatedTo, "linked-task")

        navigatedTo = nil
        coordinator.performPending { navigatedTo = $0 }
        XCTAssertNil(navigatedTo)
    }
}

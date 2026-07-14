import XCTest
@testable import MemeGTD

@MainActor
final class IssueMetadataServiceTests: XCTestCase {
    func testLoadOptionsKeepsSuccessfulSourcesWhenAnotherFails() async {
        let service = makeService(
            loadLabels: { [self.label(id: 1, name: "ios")] },
            loadAssociatedProjects: { throw ExpectedFailure.failed },
            loadAllProjects: { [self.project(id: 7)] }
        )

        let options = await service.loadOptions()

        XCTAssertEqual(options.labels?.map(\.name), ["ios"])
        XCTAssertNil(options.associatedProjects)
        XCTAssertEqual(options.allProjects?.map(\.id), [7])
    }

    func testApplyLabelsUsesOnlySelectionDiff() async throws {
        var assignedIds: [Int] = []
        var removedIds: [Int] = []
        let service = makeService(
            assignLabel: { assignedIds.append($0) },
            removeLabel: { removedIds.append($0) }
        )

        try await service.applyLabels(
            selectedNames: ["keep", "new"],
            currentNames: ["keep", "old"],
            allLabels: [
                label(id: 1, name: "keep"),
                label(id: 2, name: "new"),
                label(id: 3, name: "old"),
            ]
        )

        XCTAssertEqual(assignedIds, [2])
        XCTAssertEqual(removedIds, [3])
    }

    func testApplyProjectsContinuesAfterOneOperationFails() async {
        var addedIds: [Int] = []
        var removedIds: [Int] = []
        let service = makeService(
            addProject: { id in
                addedIds.append(id)
                if id == 2 { throw ExpectedFailure.failed }
            },
            removeProject: { removedIds.append($0) }
        )

        do {
            try await service.applyProjects(selectedIds: [2, 3], currentIds: [1])
            XCTFail("Expected the first operation error to be reported")
        } catch {
            XCTAssertEqual(addedIds, [2, 3])
            XCTAssertEqual(removedIds, [1])
        }
    }

    func testReconcileAddsNewLabelOnce() {
        let service = makeService()
        let existing = label(id: 1, name: "ios")
        let added = label(id: 2, name: "shared")

        let once = service.reconciling([existing], with: added)
        let twice = service.reconciling(once, with: added)

        XCTAssertEqual(twice.map(\.name), ["ios", "shared"])
    }

    private func makeService(
        loadLabels: @escaping IssueMetadataService.LoadLabels = { [] },
        loadAssociatedProjects: @escaping IssueMetadataService.LoadProjects = { [] },
        loadAllProjects: @escaping IssueMetadataService.LoadProjects = { [] },
        assignLabel: @escaping IssueMetadataService.AssignLabel = { _ in },
        removeLabel: @escaping IssueMetadataService.RemoveLabel = { _ in },
        addProject: @escaping IssueMetadataService.AddProject = { _ in },
        removeProject: @escaping IssueMetadataService.RemoveProject = { _ in }
    ) -> IssueMetadataService {
        IssueMetadataService(
            loadLabels: loadLabels,
            loadAssociatedProjects: loadAssociatedProjects,
            loadAllProjects: loadAllProjects,
            assignLabel: assignLabel,
            removeLabel: removeLabel,
            addProject: addProject,
            removeProject: removeProject
        )
    }

    private func label(id: Int, name: String) -> IssueLabel {
        IssueLabel(
            id: id,
            name: name,
            description: nil,
            createdAt: "2026-07-14T00:00:00Z",
            memoCount: 0,
            taskCount: 0,
            articleCount: 0
        )
    }

    private func project(id: Int) -> Project {
        Project(
            id: id,
            name: "Project \(id)",
            description: nil,
            status: "active",
            startDate: nil,
            endDate: nil,
            createdAt: "2026-07-14T00:00:00Z"
        )
    }
}

private enum ExpectedFailure: Error {
    case failed
}

import XCTest
@testable import MemeGTD

final class TaskHierarchyTests: XCTestCase {
    private func shape(_ ids: [Int], _ parentIds: [Int: [Int]]) -> [[Int]] {
        TaskHierarchy.arrange(ids, id: { $0 }, parentIds: parentIds).map { [$0.item, $0.depth] }
    }

    func testParentIdReadsBothStoredDirections() {
        XCTAssertEqual(TaskHierarchy.parentId(of: 2, sourceIssueId: 2, targetIssueId: 1, linkType: "child"), 1)
        XCTAssertEqual(TaskHierarchy.parentId(of: 2, sourceIssueId: 1, targetIssueId: 2, linkType: "parent"), 1)
    }

    func testParentIdIsNilForParentSideAndOtherLinkTypes() {
        XCTAssertNil(TaskHierarchy.parentId(of: 1, sourceIssueId: 2, targetIssueId: 1, linkType: "child"))
        XCTAssertNil(TaskHierarchy.parentId(of: 1, sourceIssueId: 1, targetIssueId: 2, linkType: "parent"))
        XCTAssertNil(TaskHierarchy.parentId(of: 2, sourceIssueId: 2, targetIssueId: 1, linkType: "relates"))
    }

    func testKeepsOrderWhenNoTaskHasShownParent() {
        XCTAssertEqual(shape([3, 2, 1], [:]), [[3, 0], [2, 0], [1, 0]])
    }

    func testMovesChildDirectlyUnderParent() {
        XCTAssertEqual(shape([2, 9, 1], [2: [1]]), [[9, 0], [1, 0], [2, 1]])
    }

    func testLeavesChildInPlaceWhenParentIsNotInList() {
        XCTAssertEqual(shape([9, 3], [3: [1]]), [[9, 0], [3, 0]])
    }

    func testIndentsGrandchildUnderItsOwnParent() {
        XCTAssertEqual(shape([3, 2, 1], [2: [1], 3: [2]]), [[1, 0], [2, 1], [3, 2]])
    }

    func testDoesNotAttachGrandchildWhenMiddleTaskIsMissing() {
        XCTAssertEqual(shape([3, 1], [3: [2], 2: [1]]), [[3, 0], [1, 0]])
    }

    func testKeepsSiblingsInListOrder() {
        XCTAssertEqual(shape([5, 1, 4], [5: [1], 4: [1]]), [[1, 0], [5, 1], [4, 1]])
    }

    func testUsesFirstShownParentWhenTaskHasSeveralParents() {
        XCTAssertEqual(shape([3, 2, 1], [3: [7, 2, 1]]), [[2, 0], [3, 1], [1, 0]])
    }

    func testShowsEveryTaskOnceWhenParentLinksFormCycle() {
        let rows = TaskHierarchy.arrange([1, 2], id: { $0 }, parentIds: [1: [2], 2: [1]])
        XCTAssertEqual(rows.map(\.item).sorted(), [1, 2])
    }
}

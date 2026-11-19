import SwiftUI
import XCTest
@testable import MemeGTD

@MainActor
final class IssueInfoSheetLayoutTests: XCTestCase {
    /// すべての操作があるTaskを、小さなsheetと大きな文字設定でも表示領域内に収める。
    func testAllTaskActionsFitConstrainedSheetHeight() {
        let vm = TaskDetailViewModel(taskId: -1)
        for height: CGFloat in [400, 550, 800] {
            let sheet = IssueInfoSheet(
                viewModel: vm, showCopiedFeedback: .constant(false),
                bookmarkProvider: vm, linkProvider: vm, copyProvider: vm, jsonCopyProvider: vm,
                onEditTitle: {}, onDelete: {}, onNewTask: {}, onAddChild: {},
                onArchiveToArticle: {}, onTransferToMemo: {}, onNavigateToIssue: { _ in }
            )
            .environment(\.dynamicTypeSize, .accessibility3)
            let host = UIHostingController(rootView: sheet)
            let measured = host.sizeThatFits(in: CGSize(width: 320, height: height))
            XCTAssertLessThanOrEqual(measured.height, height + 1,
                                     "Sheet must scroll its contents instead of overflowing its container")
        }
    }
}

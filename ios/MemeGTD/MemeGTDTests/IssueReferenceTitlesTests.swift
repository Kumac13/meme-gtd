import GRDB
import XCTest
@testable import MemeGTD

@MainActor
final class IssueReferenceTitlesTests: XCTestCase {
    private func link(
        _ id: Int, type: String = "task", title: String, direction: LinkDirection = .outgoing, status: String? = nil
    ) -> IssueLink {
        IssueLink(
            id: id, sourceIssueId: direction == .outgoing ? 1 : id,
            targetIssueId: direction == .outgoing ? id : 1,
            linkType: .relates, createdAt: "", direction: direction,
            targetIssue: TargetIssue(id: id, type: type, title: title, status: status)
        )
    }

    func testTitlesFollowLinksAndPreserveTheURLAcrossTheWholeLabel() {
        let task = link(12, title: "Symbols **[draft]** <span> & /")
        let memo = link(13, type: "memo", title: "A multi-line note\nwith a long title.")
        let article = link(9001, type: "article", title: "An article", direction: .incoming)
        let others = (30..<3130).map { link($0, title: "Other") }
        let titles = IssueReferenceTitles(links: [task, task, memo] + others + [article])
        let rendered = renderInlineMarkdown(
            "[#12](/tasks/12)[#12](/tasks/12) [#13](/memos/13) [#9001](/articles/9001)",
            issueReferenceTitles: titles
        )
        XCTAssertEqual(
            String(rendered.characters),
            "#12: \(task.targetIssue.displayTitle)#12: \(task.targetIssue.displayTitle) #13: \(memo.targetIssue.displayTitle) #9001: An article"
        )
        let articleText = rendered.runs.filter { $0.link?.absoluteString == "/articles/9001" }
            .map { String(rendered[$0.range].characters) }.joined()
        XCTAssertEqual(articleText, "#9001: An article")
    }

    func testFallbacksAndOtherMarkdownRetainExistingLabels() {
        let titles = IssueReferenceTitles(links: [
            link(12, title: "A task"),
            link(14, title: "  "),
            link(15, title: "Issue #15"),
        ])
        let markdown = "[#14](/tasks/14) [#15](/tasks/15) [#17](/tasks/17) "
            + "[#12](/memos/12) [#99](/tasks/12) [#12 **custom**](/tasks/12) "
            + "[#12](https://example.com/tasks/12) `[#12](/tasks/12)`"
        let original = renderInlineMarkdown(markdown)
        let withTitles = renderInlineMarkdown(markdown, issueReferenceTitles: titles)
        XCTAssertEqual(String(withTitles.characters), String(original.characters))
        XCTAssertEqual(
            String(renderInlineMarkdown("[#12](/tasks/12)").characters), "#12"
        )
    }

    func testLegitimateTitlesThatResembleMissingTargetsAreDisplayed() {
        let titles = IssueReferenceTitles(links: [
            link(21, title: "Issue #21", status: "open"),
            link(22, type: "memo", title: "Preview (deleted)"),
            link(23, type: "memo", title: "Issue #23"),
            link(24, type: "article", title: "Issue #24"),
            link(25, type: "article", title: "Article (deleted)"),
        ])
        let markdown = "[#21](/tasks/21) [#22](/memos/22) [#23](/memos/23) [#24](/articles/24) [#25](/articles/25)"
        let rendered = renderInlineMarkdown(markdown, issueReferenceTitles: titles)
        XCTAssertEqual(
            String(rendered.characters),
            "#21: Issue #21 #22: Preview (deleted) #23: Issue #23 #24: Issue #24 #25: Article (deleted)"
        )
    }

    func testMemoReloadsSyncedBodyAndLinksThroughInjectedSources() async throws {
        let database = try AppDatabase.makeInMemory()
        let memos = LocalMemoDataSource(database: database)
        let relations = ReferenceRelationsStub()
        let draft = try await memos.createMemo(CreateMemoRequest(bodyMd: "Original"))
        let viewModel = MemoDetailViewModel(memoId: draft.id)
        viewModel.dataSources = DataSourceProvider(memos: memos, issueRelations: relations)
        viewModel.memo = draft

        let saved = await viewModel.updateMemo(bodyMd: "Reference #12")
        XCTAssertTrue(saved)
        XCTAssertEqual(viewModel.memo?.bodyMd, "Reference #12")

        // 同期で入るサーバー側の本文と、詳細 API が返す関係を差し替える。
        relations.links = [link(12, title: "A task")]
        _ = try await memos.updateMemo(id: draft.id, UpdateMemoRequest(bodyMd: "Reference [#12](/tasks/12)", isBookmarked: nil))
        await viewModel.reloadSyncedBody()

        let rendered = renderInlineMarkdown(viewModel.memo?.bodyMd ?? "", issueReferenceTitles: viewModel.issueReferenceTitles)
        XCTAssertEqual(String(rendered.characters), "Reference #12: A task")
    }

    func testDeliveredCommentReloadsLinksAfterTheLocalPendingState() async {
        let relations = ReferenceRelationsStub()
        let viewModel = TaskDetailViewModel(taskId: 1)
        viewModel.dataSources = DataSourceProvider(issueRelations: relations)
        let pending = Comment(id: 5, issueId: 1, bodyMd: "#12", createdAt: "", updatedAt: "")
        let pendingSnapshot = ThreadDelivery(pendingComments: [5], comments: [pending])
        await viewModel.refreshIssueLinksAfterCommentDelivery(from: ThreadDelivery(), to: pendingSnapshot)
        XCTAssertEqual(relations.requestedIDs, [])

        relations.links = [link(12, title: "A task")]
        let delivered = Comment(id: 5, issueId: 1, bodyMd: "[#12](/tasks/12)", createdAt: "", updatedAt: "")
        await viewModel.refreshIssueLinksAfterCommentDelivery(from: pendingSnapshot, to: ThreadDelivery(comments: [delivered]))
        XCTAssertEqual(relations.requestedIDs, [1])
        XCTAssertEqual(viewModel.issueReferenceTitles[12, "task"], "A task")
    }
}

@MainActor
private final class ReferenceRelationsStub: IssueRelationsDataSource {
    var links: [IssueLink] = []
    var requestedIDs: [Int] = []

    private struct UnexpectedRequest: Error {}

    func listLinks(issueId: Int) async throws -> [IssueLink] {
        requestedIDs.append(issueId)
        return links
    }

    func createLink(_ request: CreateLinkRequest) async throws -> CreateLinkResponse { throw UnexpectedRequest() }
    func deleteLink(linkId: Int) async throws { throw UnexpectedRequest() }
    func listUrlLinks(issueId: Int) async throws -> [UrlLink] { [] }
    func createUrlLink(issueId: Int, _ request: CreateUrlLinkRequest) async throws -> UrlLink { throw UnexpectedRequest() }
    func deleteUrlLink(urlLinkId: Int) async throws { throw UnexpectedRequest() }
    func listActivityLog(issueId: Int) async throws -> [ActivityLogEntry] { [] }
}

import XCTest
import GRDB
@testable import MemeGTD

/// Phase 9 coverage: the Standalone-mode `LocalIssueRelationsDataSource`
/// serving issue-to-issue links and URL links from the local `links` /
/// `url_links` tables (migration 003_links). Activity log stays empty.
final class LocalIssueRelationsDataSourceTests: XCTestCase {
    private var database: AppDatabase!
    private var relations: LocalIssueRelationsDataSource!
    private var tasks: LocalTaskDataSource!
    private var memos: LocalMemoDataSource!

    override func setUpWithError() throws {
        database = try AppDatabase.makeInMemory()
        relations = LocalIssueRelationsDataSource(database: database)
        tasks = LocalTaskDataSource(database: database)
        memos = LocalMemoDataSource(database: database)
    }

    private func makeTask(_ title: String) async throws -> TaskItem {
        try await tasks.createTask(CreateTaskRequest(
            title: title,
            bodyMd: nil,
            status: nil,
            taskKind: nil,
            scheduledStart: nil,
            scheduledEnd: nil,
            isAllDay: nil
        ))
    }

    // MARK: - Issue links

    func testCreateAndListLinksFromBothSides() async throws {
        let source = try await makeTask("source task")
        let target = try await makeTask("target task")

        let created = try await relations.createLink(CreateLinkRequest(
            sourceIssueId: source.id,
            targetIssueId: target.id,
            linkType: .relates
        ))
        XCTAssertLessThan(created.id, 0, "Locally created links surface negative ids")
        XCTAssertEqual(created.sourceIssueId, source.id)
        XCTAssertEqual(created.targetIssueId, target.id)
        XCTAssertEqual(created.linkType, .relates)

        // From the source side: outgoing, target issue attached.
        let fromSource = try await relations.listLinks(issueId: source.id)
        XCTAssertEqual(fromSource.count, 1)
        XCTAssertEqual(fromSource[0].direction, .outgoing)
        XCTAssertEqual(fromSource[0].targetIssue.id, target.id)
        XCTAssertEqual(fromSource[0].targetIssue.title, "target task")
        XCTAssertEqual(fromSource[0].targetIssue.type, "task")

        // From the target side: incoming, pointing back at the source.
        let fromTarget = try await relations.listLinks(issueId: target.id)
        XCTAssertEqual(fromTarget.count, 1)
        XCTAssertEqual(fromTarget[0].direction, .incoming)
        XCTAssertEqual(fromTarget[0].targetIssue.id, source.id)
        XCTAssertEqual(fromTarget[0].targetIssue.title, "source task")
    }

    func testMemoTargetTitleFallsBackToBodyPrefix() async throws {
        let task = try await makeTask("task with memo link")
        let memo = try await memos.createMemo(CreateMemoRequest(bodyMd: "memo body as title"))

        _ = try await relations.createLink(CreateLinkRequest(
            sourceIssueId: task.id,
            targetIssueId: memo.id,
            linkType: .derivedFrom
        ))

        let links = try await relations.listLinks(issueId: task.id)
        XCTAssertEqual(links.count, 1)
        // Server: COALESCE(title, SUBSTR(body_md, 1, 100)).
        XCTAssertEqual(links[0].targetIssue.title, "memo body as title")
        XCTAssertEqual(links[0].targetIssue.type, "memo")
        XCTAssertEqual(links[0].linkType, .derivedFrom)
    }

    func testCreateLinkValidationMirrorsLinkService() async throws {
        let a = try await makeTask("a")
        let b = try await makeTask("b")

        // Self reference.
        do {
            _ = try await relations.createLink(CreateLinkRequest(
                sourceIssueId: a.id, targetIssueId: a.id, linkType: .relates
            ))
            XCTFail("Expected self-reference error")
        } catch let error as LocalIssueRelationsError {
            XCTAssertEqual(error.localizedDescription, "Cannot link issue to itself (ID: \(a.id))")
        }

        // Unknown target.
        do {
            _ = try await relations.createLink(CreateLinkRequest(
                sourceIssueId: a.id, targetIssueId: 999, linkType: .relates
            ))
            XCTFail("Expected unknown-issue error")
        } catch let error as LocalIssueRelationsError {
            XCTAssertEqual(error.localizedDescription, "Issue #999 not found")
        }

        // Duplicate.
        _ = try await relations.createLink(CreateLinkRequest(
            sourceIssueId: a.id, targetIssueId: b.id, linkType: .child
        ))
        do {
            _ = try await relations.createLink(CreateLinkRequest(
                sourceIssueId: a.id, targetIssueId: b.id, linkType: .child
            ))
            XCTFail("Expected duplicate error")
        } catch let error as LocalIssueRelationsError {
            XCTAssertEqual(
                error.localizedDescription,
                "Link already exists (source: \(a.id), target: \(b.id), type: child)"
            )
        }
    }

    func testDeleteLink() async throws {
        let a = try await makeTask("a")
        let b = try await makeTask("b")
        let link = try await relations.createLink(CreateLinkRequest(
            sourceIssueId: a.id, targetIssueId: b.id, linkType: .relates
        ))

        try await relations.deleteLink(linkId: link.id)
        let links = try await relations.listLinks(issueId: a.id)
        XCTAssertTrue(links.isEmpty)

        do {
            try await relations.deleteLink(linkId: link.id)
            XCTFail("Expected not-found error on second delete")
        } catch let error as LocalIssueRelationsError {
            XCTAssertEqual(error.localizedDescription, "Link #\(link.id) not found")
        }
    }

    // MARK: - URL links

    func testUrlLinkCrud() async throws {
        let task = try await makeTask("with url")

        let created = try await relations.createUrlLink(
            issueId: task.id,
            CreateUrlLinkRequest(url: "https://example.com/doc", title: "Docs")
        )
        XCTAssertLessThan(created.id, 0)
        XCTAssertEqual(created.issueId, task.id)
        XCTAssertEqual(created.url, "https://example.com/doc")
        XCTAssertEqual(created.title, "Docs")

        let listed = try await relations.listUrlLinks(issueId: task.id)
        XCTAssertEqual(listed.map(\.id), [created.id])
        XCTAssertEqual(listed[0].url, "https://example.com/doc")

        try await relations.deleteUrlLink(urlLinkId: created.id)
        let empty = try await relations.listUrlLinks(issueId: task.id)
        XCTAssertTrue(empty.isEmpty)
    }

    func testCreateUrlLinkForUnknownIssueFails() async throws {
        do {
            _ = try await relations.createUrlLink(
                issueId: 999,
                CreateUrlLinkRequest(url: "https://example.com", title: nil)
            )
            XCTFail("Expected unknown-issue error")
        } catch let error as LocalIssueRelationsError {
            XCTAssertEqual(error.localizedDescription, "Issue #999 not found")
        }
    }

    // MARK: - Activity log

    func testActivityLogIsEmpty() async throws {
        let task = try await makeTask("no timeline")
        let entries = try await relations.listActivityLog(issueId: task.id)
        XCTAssertTrue(entries.isEmpty)
    }
}

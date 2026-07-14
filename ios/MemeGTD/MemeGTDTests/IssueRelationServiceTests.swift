import XCTest
@testable import MemeGTD

@MainActor
final class IssueRelationServiceTests: XCTestCase {
    func testCreateIssueLinkBuildsRequestAndReloadsLinks() async throws {
        var receivedRequest: CreateLinkRequest?
        var loadCount = 0
        let expected = issueLink(id: 12, targetIssueId: 99)
        let service = makeService(
            issueId: 7,
            listIssueLinks: {
                loadCount += 1
                return [expected]
            },
            createIssueLink: { receivedRequest = $0 }
        )

        let links = try await service.createIssueLink(targetIssueId: 99, linkType: .relates)

        XCTAssertEqual(receivedRequest?.sourceIssueId, 7)
        XCTAssertEqual(receivedRequest?.targetIssueId, 99)
        XCTAssertEqual(receivedRequest?.linkType, .relates)
        XCTAssertEqual(loadCount, 1)
        XCTAssertEqual(links.map(\.id), [12])
    }

    func testDeleteIssueLinkReturnsFilteredLinks() async throws {
        var deletedId: Int?
        let service = makeService(
            deleteIssueLink: { deletedId = $0 }
        )
        let links = [
            issueLink(id: 1, targetIssueId: 10),
            issueLink(id: 2, targetIssueId: 20),
        ]

        let remaining = try await service.deleteIssueLink(1, from: links)

        XCTAssertEqual(deletedId, 1)
        XCTAssertEqual(remaining.map(\.id), [2])
    }

    func testCreateUrlLinkBuildsRequestAndReloadsLinks() async throws {
        var receivedRequest: CreateUrlLinkRequest?
        var loadCount = 0
        let expected = urlLink(id: 22)
        let service = makeService(
            issueId: 8,
            listUrlLinks: {
                loadCount += 1
                return [expected]
            },
            createUrlLink: { receivedRequest = $0 }
        )

        let links = try await service.createUrlLink(url: "https://example.com", title: "Example")

        XCTAssertEqual(receivedRequest?.url, "https://example.com")
        XCTAssertEqual(receivedRequest?.title, "Example")
        XCTAssertEqual(loadCount, 1)
        XCTAssertEqual(links.map(\.id), [22])
    }

    func testPickerItemsUseTargetIssueAndLinkTimestamp() {
        let link = issueLink(id: 1, targetIssueId: 42)

        let items = IssueRelationService.pickerItems(from: [link])

        XCTAssertEqual(items.map(\.id), [42])
        XCTAssertEqual(items.first?.type, "article")
        XCTAssertEqual(items.first?.title, "Linked issue")
        XCTAssertEqual(items.first?.status, "open")
        XCTAssertEqual(items.first?.updatedAt, "2026-07-14T01:00:00Z")
    }

    private func makeService(
        issueId: Int = 1,
        listIssueLinks: @escaping IssueRelationService.ListIssueLinks = { [] },
        createIssueLink: @escaping IssueRelationService.CreateIssueLink = { _ in },
        deleteIssueLink: @escaping IssueRelationService.DeleteIssueLink = { _ in },
        listUrlLinks: @escaping IssueRelationService.ListUrlLinks = { [] },
        createUrlLink: @escaping IssueRelationService.CreateUrlLink = { _ in },
        deleteUrlLink: @escaping IssueRelationService.DeleteUrlLink = { _ in }
    ) -> IssueRelationService {
        IssueRelationService(
            issueId: issueId,
            listIssueLinks: listIssueLinks,
            createIssueLink: createIssueLink,
            deleteIssueLink: deleteIssueLink,
            listUrlLinks: listUrlLinks,
            createUrlLink: createUrlLink,
            deleteUrlLink: deleteUrlLink
        )
    }

    private func issueLink(id: Int, targetIssueId: Int) -> IssueLink {
        IssueLink(
            id: id,
            sourceIssueId: 1,
            targetIssueId: targetIssueId,
            linkType: .relates,
            createdAt: "2026-07-14T01:00:00Z",
            direction: .outgoing,
            targetIssue: TargetIssue(
                id: targetIssueId,
                type: "article",
                title: "Linked issue",
                status: "open"
            )
        )
    }

    private func urlLink(id: Int) -> UrlLink {
        UrlLink(
            id: id,
            issueId: 1,
            url: "https://example.com",
            title: "Example",
            createdAt: "2026-07-14T01:00:00Z"
        )
    }
}

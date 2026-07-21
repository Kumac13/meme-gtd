import Foundation

/// Detail画面で共通するIssue Link / 外部URLの取得・変更処理。
/// activity再取得やUIフィードバックは、リソース固有のViewModelが担当する。
@MainActor
struct IssueRelationService {
    typealias ListIssueLinks = () async throws -> [IssueLink]
    typealias CreateIssueLink = (CreateLinkRequest) async throws -> Void
    typealias DeleteIssueLink = (Int) async throws -> Void
    typealias ListUrlLinks = () async throws -> [UrlLink]
    typealias CreateUrlLink = (CreateUrlLinkRequest) async throws -> Void
    typealias DeleteUrlLink = (Int) async throws -> Void

    private let issueId: Int
    private let listIssueLinksOperation: ListIssueLinks
    private let createIssueLinkOperation: CreateIssueLink
    private let deleteIssueLinkOperation: DeleteIssueLink
    private let listUrlLinksOperation: ListUrlLinks
    private let createUrlLinkOperation: CreateUrlLink
    private let deleteUrlLinkOperation: DeleteUrlLink

    init(issueId: Int, dataSource: any IssueRelationsDataSource) {
        self.init(
            issueId: issueId,
            listIssueLinks: { try await dataSource.listLinks(issueId: issueId) },
            createIssueLink: { request in
                let _: CreateLinkResponse = try await dataSource.createLink(request)
            },
            deleteIssueLink: { linkId in
                try await dataSource.deleteLink(linkId: linkId)
            },
            listUrlLinks: { try await dataSource.listUrlLinks(issueId: issueId) },
            createUrlLink: { request in
                let _: UrlLink = try await dataSource.createUrlLink(issueId: issueId, request)
            },
            deleteUrlLink: { urlLinkId in
                try await dataSource.deleteUrlLink(urlLinkId: urlLinkId)
            }
        )
    }

    init(
        issueId: Int,
        listIssueLinks: @escaping ListIssueLinks,
        createIssueLink: @escaping CreateIssueLink,
        deleteIssueLink: @escaping DeleteIssueLink,
        listUrlLinks: @escaping ListUrlLinks,
        createUrlLink: @escaping CreateUrlLink,
        deleteUrlLink: @escaping DeleteUrlLink
    ) {
        self.issueId = issueId
        self.listIssueLinksOperation = listIssueLinks
        self.createIssueLinkOperation = createIssueLink
        self.deleteIssueLinkOperation = deleteIssueLink
        self.listUrlLinksOperation = listUrlLinks
        self.createUrlLinkOperation = createUrlLink
        self.deleteUrlLinkOperation = deleteUrlLink
    }

    func loadIssueLinks() async throws -> [IssueLink] {
        try await listIssueLinksOperation()
    }

    func createIssueLink(targetIssueId: Int, linkType: LinkType) async throws -> [IssueLink] {
        let request = CreateLinkRequest(
            sourceIssueId: issueId,
            targetIssueId: targetIssueId,
            linkType: linkType
        )
        try await createIssueLinkOperation(request)
        return try await loadIssueLinks()
    }

    func deleteIssueLink(_ linkId: Int, from currentLinks: [IssueLink]) async throws -> [IssueLink] {
        try await deleteIssueLinkOperation(linkId)
        return currentLinks.filter { $0.id != linkId }
    }

    func loadUrlLinks() async throws -> [UrlLink] {
        try await listUrlLinksOperation()
    }

    func createUrlLink(url: String, title: String?) async throws -> [UrlLink] {
        try await createUrlLinkOperation(CreateUrlLinkRequest(url: url, title: title))
        return try await loadUrlLinks()
    }

    func deleteUrlLink(_ urlLinkId: Int, from currentLinks: [UrlLink]) async throws -> [UrlLink] {
        try await deleteUrlLinkOperation(urlLinkId)
        return currentLinks.filter { $0.id != urlLinkId }
    }

    static func pickerItems(from links: [IssueLink]) -> [IssuePickerItem] {
        links.map {
            IssuePickerItem(
                id: $0.targetIssue.id,
                type: $0.targetIssue.type,
                title: $0.targetIssue.title,
                status: $0.targetIssue.status,
                updatedAt: $0.createdAt
            )
        }
    }
}

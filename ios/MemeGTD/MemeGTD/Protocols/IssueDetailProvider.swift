import Foundation

@MainActor
protocol IssueMetadataProvider: ObservableObject {
    var issueLabels: [String] { get }
    var allLabels: [IssueLabel] { get }
    func confirmLabels(_ selectedNames: Set<String>)
    func addNewLabel(_ label: IssueLabel)

    var associatedProjects: [Project] { get }
    var allProjects: [Project] { get }
    func confirmProjects(_ selectedIds: Set<Int>)
}

@MainActor
protocol IssueLinkProvider: ObservableObject {
    var issueTypeLabel: String { get }
    var issueLinks: [IssueLink] { get }
    var linkedPickerItems: [IssuePickerItem] { get }
    func searchIssues(query: String) async -> [IssuePickerItem]
    func createIssueLink(targetIssueId: Int, linkType: LinkType) async
    func deleteIssueLink(_ linkId: Int) async

    var urlLinks: [UrlLink] { get }
    func createUrlLink(url: String, title: String?) async
    func deleteUrlLink(_ urlLinkId: Int) async
}

@MainActor
protocol IssueBookmarkProvider: ObservableObject {
    var isBookmarking: Bool { get }
    var isBookmarked: Bool { get }
    func toggleBookmark() async
}

@MainActor
protocol IssueCopyProvider: ObservableObject {
    func copyAllContents()
}

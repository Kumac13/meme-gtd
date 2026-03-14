import Foundation

@MainActor
protocol IssueDetailProvider: ObservableObject {
    var issueId: Int { get }
    var issueTypeLabel: String { get }

    // Links
    var issueLinks: [IssueLink] { get }
    var linkedPickerItems: [IssuePickerItem] { get }
    func searchIssues(query: String) async -> [IssuePickerItem]
    func createIssueLink(targetIssueId: Int, linkType: LinkType) async
    func deleteIssueLink(_ linkId: Int) async

    // URL Links
    var urlLinks: [UrlLink] { get }
    func createUrlLink(url: String, title: String?) async
    func deleteUrlLink(_ urlLinkId: Int) async

    // Bookmark
    var isBookmarking: Bool { get }
    var isBookmarked: Bool { get }
    func toggleBookmark() async

    // Labels
    var issueLabels: [String] { get }
    var allLabels: [IssueLabel] { get }
    func confirmLabels(_ selectedNames: Set<String>)

    // Projects
    var associatedProjects: [Project] { get }
    var allProjects: [Project] { get }
    func confirmProjects(_ selectedIds: Set<Int>)

    // Copy
    func copyAllContents()
}

import Foundation
import UIKit

@MainActor
protocol IssueMetadataManaging: IssueMetadataProvider {
    var metadataIssueId: Int { get }
    var dataSources: DataSourceProvider { get }
    var allLabels: [IssueLabel] { get set }
    var associatedProjects: [Project] { get set }
    var allProjects: [Project] { get set }
    var error: String? { get set }
    func reloadMetadataIssue() async
    func metadataDidChange() async
}

extension IssueMetadataManaging {
    private var metadataService: IssueMetadataService {
        IssueMetadataService(issueId: metadataIssueId, dataSources: dataSources)
    }

    func loadMetadataOptions() async {
        let options = await metadataService.loadOptions()
        if let labels = options.labels { allLabels = labels }
        if let associated = options.associatedProjects { associatedProjects = associated }
        if let projects = options.allProjects { allProjects = projects }
    }

    func reloadProjectOptions() async {
        let options = await metadataService.loadProjectOptions()
        if let associated = options.associated { associatedProjects = associated }
        if let projects = options.all { allProjects = projects }
    }

    func addNewLabel(_ label: IssueLabel) {
        allLabels = metadataService.reconciling(allLabels, with: label)
    }

    func confirmLabels(_ selectedNames: Set<String>) {
        let currentNames = Set(issueLabels)
        Task {
            do {
                try await metadataService.applyLabels(selectedNames: selectedNames, currentNames: currentNames, allLabels: allLabels)
            } catch {
                self.error = error.localizedDescription
            }
            await reloadMetadataIssue()
            await metadataDidChange()
        }
    }

    func confirmProjects(_ selectedIds: Set<Int>) {
        let currentIds = Set(associatedProjects.map(\.id))
        Task {
            do {
                try await metadataService.applyProjects(selectedIds: selectedIds, currentIds: currentIds)
            } catch {
                self.error = error.localizedDescription
            }
            await reloadProjectOptions()
            await metadataDidChange()
        }
    }
}

@MainActor
protocol IssueRelationManaging: IssueLinkProvider {
    var relationIssueId: Int { get }
    var dataSources: DataSourceProvider { get }
    var issueLinks: [IssueLink] { get set }
    var urlLinks: [UrlLink] { get set }
    var error: String? { get set }
    func relationDidChange() async
}

extension IssueRelationManaging {
    private var relationService: IssueRelationService {
        IssueRelationService(issueId: relationIssueId, dataSource: dataSources.issueRelations)
    }

    var linkedPickerItems: [IssuePickerItem] { IssueRelationService.pickerItems(from: issueLinks) }

    func loadIssueLinks() async {
        issueLinks = (try? await relationService.loadIssueLinks()) ?? issueLinks
    }

    func loadUrlLinks() async {
        urlLinks = (try? await relationService.loadUrlLinks()) ?? urlLinks
    }

    func createIssueLink(targetIssueId: Int, linkType: LinkType) async {
        do {
            issueLinks = try await relationService.createIssueLink(targetIssueId: targetIssueId, linkType: linkType)
            await relationDidChange()
            HapticManager.notification(.success)
        } catch {
            self.error = error.localizedDescription
            HapticManager.notification(.error)
        }
    }

    func deleteIssueLink(_ linkId: Int) async {
        do {
            issueLinks = try await relationService.deleteIssueLink(linkId, from: issueLinks)
            await relationDidChange()
        } catch {
            self.error = error.localizedDescription
        }
    }

    func createUrlLink(url: String, title: String?) async {
        do {
            urlLinks = try await relationService.createUrlLink(url: url, title: title)
            HapticManager.notification(.success)
        } catch {
            self.error = error.localizedDescription
            HapticManager.notification(.error)
        }
    }

    func deleteUrlLink(_ urlLinkId: Int) async {
        do {
            urlLinks = try await relationService.deleteUrlLink(urlLinkId, from: urlLinks)
        } catch {
            self.error = error.localizedDescription
        }
    }

    func searchIssues(query: String) async -> [IssuePickerItem] {
        await IssuePickerSearchService(dataSources: dataSources).search(query: query, excludingIDs: [relationIssueId])
    }
}

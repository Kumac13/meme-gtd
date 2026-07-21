import SwiftUI

/// Adapts unsaved task links to the same picker used by persisted Issue detail.
struct CreateTaskLinkPicker: View {
    @ObservedObject var viewModel: CreateTaskViewModel
    let onDismiss: () -> Void

    private var selectedIssues: [LinkPickerIssueSelection] {
        viewModel.pendingLinks.map {
            LinkPickerIssueSelection(
                id: .pending($0.id),
                targetIssueId: $0.targetIssueId,
                title: $0.title,
                item: nil,
                linkType: $0.linkType
            )
        }
    }

    private var selectedURLs: [LinkPickerURLSelection] {
        viewModel.pendingUrlLinks.map {
            LinkPickerURLSelection(id: .pending($0.id), url: $0.url, title: $0.title)
        }
    }

    var body: some View {
        IssueLinkPicker(
            issueTypeLabel: "task",
            selectedIssues: selectedIssues,
            selectedURLs: selectedURLs,
            search: viewModel.searchIssues,
            addIssue: { item, type in
                viewModel.addPendingLink(
                    targetIssueId: item.id,
                    linkType: type,
                    title: item.title
                )
            },
            removeIssue: { selection in
                guard case .pending(let id) = selection.id,
                      let link = viewModel.pendingLinks.first(where: { $0.id == id }) else { return }
                viewModel.removePendingLink(link)
            },
            addURL: { url, title in
                viewModel.addPendingUrlLink(url: url, title: title)
            },
            removeURL: { selection in
                guard case .pending(let id) = selection.id,
                      let link = viewModel.pendingUrlLinks.first(where: { $0.id == id }) else { return }
                viewModel.removePendingUrlLink(link)
            },
            onDismiss: onDismiss
        )
    }
}

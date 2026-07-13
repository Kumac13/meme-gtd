import SwiftUI

struct LinkPickerModal<VM: IssueDetailProvider>: View {
    @ObservedObject var viewModel: VM
    let onDismiss: () -> Void

    @State private var searchText = ""
    @State private var recentItems: [IssuePickerItem] = []
    @State private var searchResults: [IssuePickerItem]?
    @State private var isSearching = false
    @State private var searchTask: Task<Void, Never>?
    @State private var hasLoadedRecent = false
    @State private var processingIds: Set<Int> = []
    @State private var showUrlForm = false
    @State private var urlText = ""
    @State private var urlTitle = ""
    @State private var isCreatingUrl = false
    @State private var deletingUrlIds: Set<Int> = []

    private var linkedIds: Set<Int> {
        Set(viewModel.issueLinks.map(\.targetIssue.id))
    }

    private var displayItems: [IssuePickerItem] {
        if let results = searchResults {
            return results
        }
        return recentItems.filter { !linkedIds.contains($0.id) }
    }

    var body: some View {
        VStack(spacing: 0) {
            PickerModalHeader(
                title: "Links",
                onDismiss: onDismiss,
                onConfirm: { onDismiss() }
            )

            Divider()

            if showUrlForm {
                urlFormView
            } else {
                ZStack(alignment: .bottom) {
                    ScrollView {
                        VStack(alignment: .leading, spacing: 0) {
                            // "Selected" section (issue links + url links)
                            if !viewModel.linkedPickerItems.isEmpty || !viewModel.urlLinks.isEmpty {
                                PickerSectionHeader(title: "Selected")

                                ForEach(viewModel.linkedPickerItems) { item in
                                    linkedRow(item)
                                    Divider().padding(.leading, 16)
                                }

                                ForEach(viewModel.urlLinks) { urlLink in
                                    urlLinkRow(urlLink)
                                    Divider().padding(.leading, 16)
                                }
                            }

                            // Add External URL button
                            AddExternalURLRow {
                                showUrlForm = true
                            }

                            Divider().padding(.leading, 16)

                            // "Recent" section
                            PickerSectionHeader(title: searchResults != nil ? "Search Results" : "Recent")

                            if isSearching && !hasLoadedRecent {
                                ProgressView()
                                    .frame(maxWidth: .infinity)
                                    .padding(.top, 30)
                            } else if displayItems.isEmpty && hasLoadedRecent {
                                Text("No matching items found")
                                    .font(.system(size: 13))
                                    .foregroundColor(.textPrimary)
                                    .frame(maxWidth: .infinity)
                                    .padding(.top, 30)
                            } else {
                                ForEach(displayItems) { item in
                                    let isLinked = linkedIds.contains(item.id)
                                    issueRow(item, isLinked: isLinked)
                                    Divider().padding(.leading, 16)
                                }
                            }

                            Color.clear.frame(height: 70)
                        }
                    }

                    PickerSearchBar(text: $searchText, placeholder: "Search")
                }
            }
        }
        .background(Color(.secondarySystemGroupedBackground))
        .task {
            recentItems = await viewModel.searchIssues(query: "")
            hasLoadedRecent = true
        }
        .onChange(of: searchText) { newValue in
            searchTask?.cancel()
            let query = newValue.trimmingCharacters(in: .whitespacesAndNewlines)
            if query.isEmpty {
                searchResults = nil
                return
            }
            searchTask = Task {
                try? await Task.sleep(nanoseconds: 300_000_000)
                guard !Task.isCancelled else { return }
                isSearching = true
                searchResults = await viewModel.searchIssues(query: query)
                isSearching = false
            }
        }
    }

    // MARK: - URL Link Row (in Selected section)

    private func urlLinkRow(_ urlLink: UrlLink) -> some View {
        HStack(spacing: 8) {
            Image(systemName: "link")
                .font(.system(size: 11, weight: .medium))
                .foregroundColor(.textPrimary)
                .frame(width: 14)

            ExternalURLBadge()

            Text(urlLink.displayLabel)
                .font(.system(size: 15, weight: .medium))
                .foregroundColor(.textPrimary)
                .lineLimit(1)

            Spacer()

            Button(action: {
                guard !deletingUrlIds.contains(urlLink.id) else { return }
                HapticManager.impact(.light)
                deletingUrlIds.insert(urlLink.id)
                Task {
                    await viewModel.deleteUrlLink(urlLink.id)
                    deletingUrlIds.remove(urlLink.id)
                }
            }) {
                if deletingUrlIds.contains(urlLink.id) {
                    ProgressView()
                        .frame(width: 22, height: 22)
                } else {
                    Image(systemName: "checkmark.circle.fill")
                        .font(.system(size: 22))
                        .foregroundColor(.accent)
                }
            }
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 12)
    }

    // MARK: - URL Form

    private var urlFormView: some View {
        ExternalURLForm(
            urlText: $urlText,
            titleText: $urlTitle,
            isSubmitting: isCreatingUrl,
            onBack: {
                showUrlForm = false
                urlText = ""
                urlTitle = ""
            },
            onSubmit: { url, title in
                isCreatingUrl = true
                Task {
                    await viewModel.createUrlLink(url: url, title: title)
                    isCreatingUrl = false
                    urlText = ""
                    urlTitle = ""
                    showUrlForm = false
                }
            }
        )
    }

    // MARK: - Linked item row

    private func linkedRow(_ item: IssuePickerItem) -> some View {
        let link = viewModel.issueLinks.first { $0.targetIssue.id == item.id }

        return HStack(spacing: 8) {
            if let link {
                Image(systemName: link.linkType.iconName)
                    .font(.system(size: 11, weight: .medium))
                    .foregroundColor(.textPrimary)
                    .frame(width: 14)
            }

            IssuePickerItemSummary(item: item)

            Spacer()

            Button(action: {
                guard !processingIds.contains(item.id) else { return }
                guard let linkId = link?.id else { return }
                HapticManager.impact(.light)
                processingIds.insert(item.id)
                Task {
                    await viewModel.deleteIssueLink(linkId)
                    processingIds.remove(item.id)
                }
            }) {
                if processingIds.contains(item.id) {
                    ProgressView()
                        .frame(width: 22, height: 22)
                } else {
                    Image(systemName: "checkmark.circle.fill")
                        .font(.system(size: 22))
                        .foregroundColor(.accent)
                }
            }
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 12)
    }

    // MARK: - Unlinked / search result row

    private func issueRow(_ item: IssuePickerItem, isLinked: Bool) -> some View {
        HStack(spacing: 8) {
            IssuePickerItemSummary(item: item)

            Spacer()

            if processingIds.contains(item.id) {
                ProgressView()
                    .frame(width: 22, height: 22)
            } else if isLinked {
                Button(action: {
                    guard let linkId = viewModel.issueLinks.first(where: { $0.targetIssue.id == item.id })?.id else { return }
                    HapticManager.impact(.light)
                    processingIds.insert(item.id)
                    Task {
                        await viewModel.deleteIssueLink(linkId)
                        processingIds.remove(item.id)
                    }
                }) {
                    Image(systemName: "checkmark.circle.fill")
                        .font(.system(size: 22))
                        .foregroundColor(.accent)
                }
            } else {
                Menu {
                    Section("This \(viewModel.issueTypeLabel) is:") {
                        ForEach(LinkType.allCases, id: \.self) { type in
                            Button(action: {
                                HapticManager.impact(.light)
                                processingIds.insert(item.id)
                                Task {
                                    await viewModel.createIssueLink(
                                        targetIssueId: item.id,
                                        linkType: type
                                    )
                                    processingIds.remove(item.id)
                                }
                            }) {
                                Label(type.displayLabel, systemImage: type.iconName)
                            }
                        }
                    }
                } label: {
                    Image(systemName: "plus.circle")
                        .font(.system(size: 22))
                        .foregroundColor(Color(.systemGray3))
                }
            }
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 12)
    }
}

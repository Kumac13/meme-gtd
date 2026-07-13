import SwiftUI

struct CreateTaskLinkPicker: View {
    @ObservedObject var viewModel: CreateTaskViewModel
    let onDismiss: () -> Void

    @State private var searchText = ""
    @State private var recentItems: [IssuePickerItem] = []
    @State private var searchResults: [IssuePickerItem]?
    @State private var isSearching = false
    @State private var searchTask: Task<Void, Never>?
    @State private var hasLoadedRecent = false
    @State private var showUrlForm = false
    @State private var urlText = ""
    @State private var urlTitle = ""

    private var linkedIds: Set<Int> {
        Set(viewModel.pendingLinks.map(\.targetIssueId))
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
                            // Pending links section
                            if !viewModel.pendingLinks.isEmpty || !viewModel.pendingUrlLinks.isEmpty {
                                PickerSectionHeader(title: "Selected")

                                ForEach(viewModel.pendingLinks) { link in
                                    pendingLinkRow(link)
                                    Divider().padding(.leading, 16)
                                }

                                ForEach(viewModel.pendingUrlLinks) { urlLink in
                                    pendingUrlLinkRow(urlLink)
                                    Divider().padding(.leading, 16)
                                }
                            }

                            // Add External URL button
                            AddExternalURLRow {
                                showUrlForm = true
                            }

                            Divider().padding(.leading, 16)

                            // Search results / recent section
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
                                    issueRow(item)
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

    // MARK: - Pending URL Link Row

    private func pendingUrlLinkRow(_ urlLink: PendingUrlLink) -> some View {
        HStack(spacing: 8) {
            Image(systemName: "link")
                .font(.system(size: 11, weight: .medium))
                .foregroundColor(.textPrimary)
                .frame(width: 14)

            ExternalURLBadge()

            Text(urlLink.title ?? urlLink.url)
                .font(.system(size: 15, weight: .medium))
                .foregroundColor(.textPrimary)
                .lineLimit(1)

            Spacer()

            Button(action: {
                HapticManager.impact(.light)
                viewModel.removePendingUrlLink(urlLink)
            }) {
                Image(systemName: "checkmark.circle.fill")
                    .font(.system(size: 22))
                    .foregroundColor(.accent)
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
            onBack: {
                showUrlForm = false
                urlText = ""
                urlTitle = ""
            },
            onSubmit: { url, title in
                HapticManager.impact(.light)
                viewModel.addPendingUrlLink(url: url, title: title)
                urlText = ""
                urlTitle = ""
                showUrlForm = false
            }
        )
    }

    // MARK: - Issue type badge

    // MARK: - Pending link row

    private func pendingLinkRow(_ link: PendingLink) -> some View {
        HStack(spacing: 8) {
            Image(systemName: link.linkType.iconName)
                .font(.system(size: 11, weight: .medium))
                .foregroundColor(.textPrimary)
                .frame(width: 14)

            Text(link.title)
                .font(.system(size: 15, weight: .medium))
                .foregroundColor(.textPrimary)
                .lineLimit(1)

            Text(link.linkType.displayLabel)
                .font(.system(size: 11))
                .foregroundColor(.accentDark)

            Spacer()

            Button(action: {
                HapticManager.impact(.light)
                viewModel.removePendingLink(link)
            }) {
                Image(systemName: "checkmark.circle.fill")
                    .font(.system(size: 22))
                    .foregroundColor(.accent)
            }
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 12)
    }

    // MARK: - Issue row (unlinked)

    private func issueRow(_ item: IssuePickerItem) -> some View {
        HStack(spacing: 8) {
            IssuePickerItemSummary(item: item)

            Spacer()

            Menu {
                Section("Link type:") {
                    ForEach(LinkType.allCases, id: \.self) { type in
                        Button(action: {
                            HapticManager.impact(.light)
                            viewModel.addPendingLink(
                                targetIssueId: item.id,
                                linkType: type,
                                title: item.title
                            )
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
        .padding(.horizontal, 16)
        .padding(.vertical, 12)
    }
}

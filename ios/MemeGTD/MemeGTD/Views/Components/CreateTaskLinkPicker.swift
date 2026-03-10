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

            ZStack(alignment: .bottom) {
                ScrollView {
                    VStack(alignment: .leading, spacing: 0) {
                        // Pending links section
                        if !viewModel.pendingLinks.isEmpty {
                            sectionHeader("Selected")

                            ForEach(viewModel.pendingLinks) { link in
                                pendingLinkRow(link)
                                Divider().padding(.leading, 16)
                            }
                        }

                        // Search results / recent section
                        sectionHeader(searchResults != nil ? "Search Results" : "Recent")

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

    // MARK: - Section header

    private func sectionHeader(_ title: String) -> some View {
        HStack {
            Text(title)
                .font(.system(size: 12, weight: .semibold))
                .foregroundColor(.textPrimary)
            Spacer()
        }
        .padding(.horizontal, 16)
        .padding(.top, 10)
        .padding(.bottom, 4)
    }

    // MARK: - Issue type badge

    private var badgeWidth: CGFloat { 56 }

    @ViewBuilder
    private func issueTypeBadge(_ type: String) -> some View {
        let label = type.capitalized
        let (bg, fg) = issueTypeColors(type)
        Text(label)
            .font(.system(size: 12, weight: .medium))
            .padding(.horizontal, 8)
            .padding(.vertical, 4)
            .frame(width: badgeWidth)
            .background(bg)
            .foregroundColor(fg)
            .clipShape(Capsule())
    }

    private func issueTypeColors(_ type: String) -> (Color, Color) {
        switch type {
        case "task":
            return (Color(hex: "#1a7f37"), Color.white)
        case "memo":
            return (Color(hex: "#dafbe1"), Color(hex: "#1a7f37"))
        case "article":
            return (Color(hex: "#b4e6be"), Color(hex: "#0d5821"))
        default:
            return (Color.accent.opacity(0.15), Color.accentDark)
        }
    }

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
            issueTypeBadge(item.type)

            Text(item.title)
                .font(.system(size: 15, weight: .medium))
                .foregroundColor(.textPrimary)
                .lineLimit(1)

            if let status = item.status {
                Text(status.capitalized)
                    .font(.system(size: 11))
                    .foregroundColor(.accentDark)
            }

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

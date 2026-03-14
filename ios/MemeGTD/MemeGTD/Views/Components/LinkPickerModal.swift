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

    private var canSubmitUrl: Bool {
        let trimmed = urlText.trimmingCharacters(in: .whitespacesAndNewlines)
        return !trimmed.isEmpty && URL(string: trimmed) != nil && !isCreatingUrl
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
                                sectionHeader("Selected")

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
                            Button(action: {
                                HapticManager.impact(.light)
                                showUrlForm = true
                            }) {
                                HStack(spacing: 8) {
                                    Image(systemName: "link.badge.plus")
                                        .font(.system(size: 15))
                                        .foregroundColor(.accent)
                                    Text("Add External URL")
                                        .font(.system(size: 15))
                                        .foregroundColor(.accent)
                                    Spacer()
                                }
                                .padding(.horizontal, 16)
                                .padding(.vertical, 12)
                            }

                            Divider().padding(.leading, 16)

                            // "Recent" section
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

            Text("URL")
                .font(.system(size: 12, weight: .medium))
                .padding(.horizontal, 8)
                .padding(.vertical, 4)
                .frame(width: badgeWidth)
                .background(Color.accent.opacity(0.15))
                .foregroundColor(.accentDark)
                .clipShape(Capsule())

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
        VStack(spacing: 0) {
            HStack {
                Button(action: {
                    HapticManager.impact(.light)
                    showUrlForm = false
                    urlText = ""
                    urlTitle = ""
                }) {
                    HStack(spacing: 4) {
                        Image(systemName: "chevron.left")
                            .font(.system(size: 14, weight: .medium))
                        Text("Back")
                            .font(.system(size: 15))
                    }
                    .foregroundColor(.accent)
                }
                Spacer()
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 12)

            Divider()

            VStack(alignment: .leading, spacing: 16) {
                VStack(alignment: .leading, spacing: 6) {
                    Text("URL")
                        .font(.system(size: 13, weight: .medium))
                        .foregroundColor(.textSecondary)
                    TextField("https://example.com", text: $urlText)
                        .font(.system(size: 15))
                        .textFieldStyle(.roundedBorder)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()
                        .keyboardType(.URL)
                }

                VStack(alignment: .leading, spacing: 6) {
                    Text("Title (optional)")
                        .font(.system(size: 13, weight: .medium))
                        .foregroundColor(.textSecondary)
                    TextField("Link title", text: $urlTitle)
                        .font(.system(size: 15))
                        .textFieldStyle(.roundedBorder)
                }

                Button(action: {
                    guard canSubmitUrl else { return }
                    isCreatingUrl = true
                    let url = urlText.trimmingCharacters(in: .whitespacesAndNewlines)
                    let title = urlTitle.trimmingCharacters(in: .whitespacesAndNewlines)
                    Task {
                        await viewModel.createUrlLink(
                            url: url,
                            title: title.isEmpty ? nil : title
                        )
                        isCreatingUrl = false
                        urlText = ""
                        urlTitle = ""
                        showUrlForm = false
                    }
                }) {
                    HStack {
                        if isCreatingUrl {
                            ProgressView()
                                .tint(.white)
                        }
                        Text("Add")
                    }
                    .font(.system(size: 15, weight: .semibold))
                    .foregroundColor(.white)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 12)
                    .background(canSubmitUrl ? Color.accent : Color(.systemGray4))
                    .clipShape(RoundedRectangle(cornerRadius: 10))
                }
                .disabled(!canSubmitUrl)
            }
            .padding(16)

            Spacer()
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

    // MARK: - Issue type badge (same Capsule shape, fixed width, green family)

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

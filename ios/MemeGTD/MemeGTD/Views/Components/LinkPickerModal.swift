import SwiftUI

enum LinkPickerSelectionID: Hashable {
    case persisted(Int)
    case pending(UUID)
}

struct LinkPickerIssueSelection: Identifiable {
    let id: LinkPickerSelectionID
    let targetIssueId: Int
    let title: String
    let item: IssuePickerItem?
    let linkType: LinkType
}

struct LinkPickerURLSelection: Identifiable {
    let id: LinkPickerSelectionID
    let url: String
    let title: String?

    var displayLabel: String {
        if let title, !title.isEmpty { return title }
        guard let host = URL(string: url)?.host else { return String(url.prefix(30)) }
        return host.hasPrefix("www.") ? String(host.dropFirst(4)) : host
    }
}

/// Shared link picker engine and UI. Persisted detail links and pending create
/// links provide only their selections and mutation callbacks.
struct IssueLinkPicker: View {
    let issueTypeLabel: String
    let selectedIssues: [LinkPickerIssueSelection]
    let selectedURLs: [LinkPickerURLSelection]
    let search: (String) async -> [IssuePickerItem]
    let addIssue: (IssuePickerItem, LinkType) async -> Void
    let removeIssue: (LinkPickerIssueSelection) async -> Void
    let addURL: (String, String?) async -> Void
    let removeURL: (LinkPickerURLSelection) async -> Void
    let onDismiss: () -> Void

    @State private var searchText = ""
    @State private var recentItems: [IssuePickerItem] = []
    @State private var searchResults: [IssuePickerItem]?
    @State private var isSearching = false
    @State private var searchTask: Task<Void, Never>?
    @State private var hasLoadedRecent = false
    @State private var processingIds: Set<LinkPickerSelectionID> = []
    @State private var processingTargetIds: Set<Int> = []
    @State private var showURLForm = false
    @State private var urlText = ""
    @State private var urlTitle = ""
    @State private var isCreatingURL = false

    private var selectedTargetIds: Set<Int> {
        Set(selectedIssues.map(\.targetIssueId))
    }

    private var displayItems: [IssuePickerItem] {
        searchResults ?? recentItems.filter { !selectedTargetIds.contains($0.id) }
    }

    var body: some View {
        VStack(spacing: 0) {
            PickerModalHeader(title: "Links", onDismiss: onDismiss, onConfirm: onDismiss)
            Divider()

            if showURLForm {
                urlForm
            } else {
                pickerContent
            }
        }
        .background(Color(.secondarySystemGroupedBackground))
        .task {
            recentItems = await search("")
            hasLoadedRecent = true
        }
        .onChange(of: searchText, perform: searchTextChanged)
        .onDisappear { searchTask?.cancel() }
    }

    private var pickerContent: some View {
        ZStack(alignment: .bottom) {
            ScrollView {
                VStack(alignment: .leading, spacing: 0) {
                    if !selectedIssues.isEmpty || !selectedURLs.isEmpty {
                        PickerSectionHeader(title: "Selected")
                        ForEach(selectedIssues) { selection in
                            selectedIssueRow(selection)
                            Divider().padding(.leading, 16)
                        }
                        ForEach(selectedURLs) { selection in
                            selectedURLRow(selection)
                            Divider().padding(.leading, 16)
                        }
                    }

                    AddExternalURLRow { showURLForm = true }
                    Divider().padding(.leading, 16)
                    PickerSectionHeader(title: searchResults == nil ? "Recent" : "Search Results")

                    if isSearching && !hasLoadedRecent {
                        ProgressView().frame(maxWidth: .infinity).padding(.top, 30)
                    } else if displayItems.isEmpty && hasLoadedRecent {
                        Text("No matching items found")
                            .font(.system(size: 13))
                            .foregroundColor(.textPrimary)
                            .frame(maxWidth: .infinity)
                            .padding(.top, 30)
                    } else {
                        ForEach(displayItems) { item in
                            candidateRow(item)
                            Divider().padding(.leading, 16)
                        }
                    }

                    Color.clear.frame(height: 70)
                }
            }
            PickerSearchBar(text: $searchText, placeholder: "Search")
        }
    }

    private var urlForm: some View {
        ExternalURLForm(
            urlText: $urlText,
            titleText: $urlTitle,
            isSubmitting: isCreatingURL,
            onBack: resetURLForm,
            onSubmit: { url, title in
                isCreatingURL = true
                Task {
                    await addURL(url, title)
                    isCreatingURL = false
                    resetURLForm()
                }
            }
        )
    }

    private func selectedIssueRow(_ selection: LinkPickerIssueSelection) -> some View {
        HStack(spacing: 8) {
            Image(systemName: selection.linkType.iconName)
                .font(.system(size: 11, weight: .medium))
                .foregroundColor(.textPrimary)
                .frame(width: 14)

            if let item = selection.item {
                IssuePickerItemSummary(item: item)
            } else {
                Text(selection.title)
                    .font(.system(size: 15, weight: .medium))
                    .foregroundColor(.textPrimary)
                    .lineLimit(1)
                Text(selection.linkType.displayLabel)
                    .font(.system(size: 11))
                    .foregroundColor(.accentDark)
            }

            Spacer()
            mutationButton(id: selection.id) {
                await removeIssue(selection)
            }
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 12)
    }

    private func selectedURLRow(_ selection: LinkPickerURLSelection) -> some View {
        HStack(spacing: 8) {
            Image(systemName: "link")
                .font(.system(size: 11, weight: .medium))
                .foregroundColor(.textPrimary)
                .frame(width: 14)
            ExternalURLBadge()
            Text(selection.displayLabel)
                .font(.system(size: 15, weight: .medium))
                .foregroundColor(.textPrimary)
                .lineLimit(1)
            Spacer()
            mutationButton(id: selection.id) {
                await removeURL(selection)
            }
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 12)
    }

    private func candidateRow(_ item: IssuePickerItem) -> some View {
        let selection = selectedIssues.first { $0.targetIssueId == item.id }
        return HStack(spacing: 8) {
            IssuePickerItemSummary(item: item)
            Spacer()

            if processingTargetIds.contains(item.id) {
                ProgressView().frame(width: 22, height: 22)
            } else if let selection {
                Button {
                    mutateTarget(item.id) { await removeIssue(selection) }
                } label: {
                    Image(systemName: "checkmark.circle.fill")
                        .font(.system(size: 22))
                        .foregroundColor(.accent)
                }
            } else {
                Menu {
                    Section("This \(issueTypeLabel) is:") {
                        ForEach(LinkType.allCases, id: \.self) { type in
                            Button {
                                mutateTarget(item.id) { await addIssue(item, type) }
                            } label: {
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

    private func mutationButton(
        id: LinkPickerSelectionID,
        action: @escaping () async -> Void
    ) -> some View {
        Button {
            guard !processingIds.contains(id) else { return }
            HapticManager.impact(.light)
            processingIds.insert(id)
            Task {
                await action()
                processingIds.remove(id)
            }
        } label: {
            if processingIds.contains(id) {
                ProgressView().frame(width: 22, height: 22)
            } else {
                Image(systemName: "checkmark.circle.fill")
                    .font(.system(size: 22))
                    .foregroundColor(.accent)
            }
        }
    }

    private func mutateTarget(_ id: Int, action: @escaping () async -> Void) {
        guard !processingTargetIds.contains(id) else { return }
        HapticManager.impact(.light)
        processingTargetIds.insert(id)
        Task {
            await action()
            processingTargetIds.remove(id)
        }
    }

    private func searchTextChanged(_ newValue: String) {
        searchTask?.cancel()
        let query = newValue.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !query.isEmpty else {
            searchResults = nil
            isSearching = false
            return
        }
        searchTask = Task {
            try? await Task.sleep(nanoseconds: 300_000_000)
            guard !Task.isCancelled else { return }
            isSearching = true
            let results = await search(query)
            guard !Task.isCancelled else { return }
            searchResults = results
            isSearching = false
        }
    }

    private func resetURLForm() {
        urlText = ""
        urlTitle = ""
        showURLForm = false
    }
}

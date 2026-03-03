import SwiftUI

/// Filter state selected by the user in the search/filter modal.
struct SearchFilterState: Equatable {
    var searchText: String = ""
    var selectedLabels: Set<String> = []
    var dateFrom: Date?
    var dateTo: Date?

    var hasActiveFilters: Bool {
        !searchText.trimmingCharacters(in: .whitespaces).isEmpty
            || !selectedLabels.isEmpty
            || dateFrom != nil
            || dateTo != nil
    }

    var activeFilterCount: Int {
        var count = 0
        if !searchText.trimmingCharacters(in: .whitespaces).isEmpty { count += 1 }
        count += selectedLabels.count
        if dateFrom != nil { count += 1 }
        if dateTo != nil { count += 1 }
        return count
    }
}

/// Configuration for which filter sections to display.
struct SearchFilterConfig {
    var showLabels: Bool = true
    var showDateFilter: Bool = true
}

/// Bottom-up modal for search and filter controls.
struct SearchFilterModal: View {
    let config: SearchFilterConfig
    let allLabels: [IssueLabel]
    let currentState: SearchFilterState
    let onDismiss: () -> Void
    let onApply: (SearchFilterState) -> Void

    @State private var localState: SearchFilterState
    @FocusState private var searchFieldFocused: Bool

    init(
        config: SearchFilterConfig,
        allLabels: [IssueLabel],
        currentState: SearchFilterState,
        onDismiss: @escaping () -> Void,
        onApply: @escaping (SearchFilterState) -> Void
    ) {
        self.config = config
        self.allLabels = allLabels
        self.currentState = currentState
        self.onDismiss = onDismiss
        self.onApply = onApply
        self._localState = State(initialValue: currentState)
    }

    var body: some View {
        VStack(spacing: 0) {
            PickerModalHeader(
                title: "Filters",
                onDismiss: onDismiss,
                onConfirm: { onApply(localState) }
            )

            Divider()

            ScrollView {
                VStack(alignment: .leading, spacing: 24) {
                    searchTextSection

                    if config.showLabels {
                        labelFilterSection
                    }

                    if config.showDateFilter {
                        dateFilterSection
                    }

                    if localState.hasActiveFilters {
                        resetButton
                    }
                }
                .padding(16)
            }
        }
        .background(Color(.systemBackground))
        .onAppear {
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.4) {
                searchFieldFocused = true
            }
        }
    }

    // MARK: - Search text

    private var searchTextSection: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("SEARCH")
                .font(.system(size: 12, weight: .semibold))
                .foregroundColor(.textSecondary)

            HStack(spacing: 8) {
                Image(systemName: "magnifyingglass")
                    .font(.system(size: 15))
                    .foregroundColor(Color(.systemGray))

                TextField("Search memos...", text: $localState.searchText)
                    .textFieldStyle(.plain)
                    .font(.system(size: 15))
                    .tint(.accent)
                    .textInputAutocapitalization(.never)
                    .autocorrectionDisabled()
                    .focused($searchFieldFocused)

                if !localState.searchText.isEmpty {
                    Button(action: { localState.searchText = "" }) {
                        Image(systemName: "xmark.circle.fill")
                            .font(.system(size: 14))
                            .foregroundColor(Color(.systemGray))
                    }
                }
            }
            .padding(.horizontal, 12)
            .padding(.vertical, 10)
            .background(Color(.systemGray6))
            .clipShape(RoundedRectangle(cornerRadius: 10))
        }
    }

    // MARK: - Labels

    private var labelFilterSection: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("LABELS")
                .font(.system(size: 12, weight: .semibold))
                .foregroundColor(.textSecondary)

            if allLabels.isEmpty {
                Text("No labels available")
                    .font(.system(size: 14))
                    .foregroundColor(Color(.systemGray))
                    .padding(.vertical, 8)
            } else {
                FlowLayout(spacing: 8) {
                    ForEach(allLabels) { label in
                        labelChip(label)
                    }
                }
            }
        }
    }

    private func labelChip(_ label: IssueLabel) -> some View {
        let isSelected = localState.selectedLabels.contains(label.name)
        return Button(action: {
            HapticManager.impact(.light)
            if isSelected {
                localState.selectedLabels.remove(label.name)
            } else {
                localState.selectedLabels.insert(label.name)
            }
        }) {
            HStack(spacing: 4) {
                Text(label.name)
                    .font(.system(size: 13, weight: .medium))

                if isSelected {
                    Image(systemName: "checkmark")
                        .font(.system(size: 10, weight: .bold))
                }
            }
            .padding(.horizontal, 10)
            .padding(.vertical, 6)
            .background(
                isSelected
                    ? LabelColorHelper.bgColor(for: label.name)
                    : Color(.systemGray6)
            )
            .foregroundColor(
                isSelected
                    ? LabelColorHelper.textColor(for: label.name)
                    : .textSecondary
            )
            .clipShape(Capsule())
            .overlay(
                Capsule()
                    .stroke(
                        isSelected
                            ? LabelColorHelper.textColor(for: label.name).opacity(0.3)
                            : Color.clear,
                        lineWidth: 1
                    )
            )
        }
    }

    // MARK: - Date filter

    private var dateFilterSection: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("DATE")
                .font(.system(size: 12, weight: .semibold))
                .foregroundColor(.textSecondary)

            HStack(spacing: 12) {
                datePickerField(label: "From", date: $localState.dateFrom)
                datePickerField(label: "To", date: $localState.dateTo)
            }
        }
    }

    private func datePickerField(label: String, date: Binding<Date?>) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(label)
                .font(.system(size: 12))
                .foregroundColor(.textSecondary)

            HStack {
                if let selectedDate = date.wrappedValue {
                    Text(selectedDate, style: .date)
                        .font(.system(size: 14))
                    Spacer()
                    Button(action: {
                        HapticManager.impact(.light)
                        date.wrappedValue = nil
                    }) {
                        Image(systemName: "xmark.circle.fill")
                            .font(.system(size: 14))
                            .foregroundColor(Color(.systemGray))
                    }
                } else {
                    Text("Any")
                        .font(.system(size: 14))
                        .foregroundColor(Color(.systemGray))
                    Spacer()
                }
            }
            .padding(.horizontal, 12)
            .padding(.vertical, 10)
            .background(Color(.systemGray6))
            .clipShape(RoundedRectangle(cornerRadius: 10))
            .overlay {
                DatePicker(
                    "",
                    selection: Binding(
                        get: { date.wrappedValue ?? Date() },
                        set: { date.wrappedValue = $0 }
                    ),
                    displayedComponents: .date
                )
                .datePickerStyle(.compact)
                .labelsHidden()
                .opacity(0.02)
            }
        }
    }

    // MARK: - Reset

    private var resetButton: some View {
        Button(action: {
            HapticManager.impact(.light)
            localState = SearchFilterState()
        }) {
            Text("Reset Filters")
                .font(.system(size: 14, weight: .medium))
                .foregroundColor(.red)
        }
        .frame(maxWidth: .infinity)
        .padding(.top, 8)
    }
}

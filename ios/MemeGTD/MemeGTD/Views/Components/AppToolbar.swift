import SwiftUI

struct AppToolbar<Trailing: View, SearchBarAction: View>: ToolbarContent {
    let title: String
    let onMenuTap: () -> Void
    var titleLineLimit: Int? = nil
    /// Offline read-only cache state (offline support plan Phase 7): renders
    /// a "Read-only" subtitle under the title, the way Messages shows its
    /// connection state under the conversation title. Screen-level state
    /// belongs to the screen's title, not to the content or the filter row.
    var isReadOnly: Bool = false
    @ViewBuilder let trailing: () -> Trailing
    /// Optional content rendered inside the search bar, to the left of the
    /// clear ([x]) button, only while the search bar is open. Used by list
    /// views to surface a "copy current search results" action without adding
    /// a new UI element.
    @ViewBuilder let searchBarAction: () -> SearchBarAction

    private let searchConfig: SearchConfig?

    struct SearchConfig {
        let isSearching: Binding<Bool>
        let searchQuery: Binding<String>
        let placeholder: String
        let onSearch: () -> Void
    }

    // Init without search
    init(
        title: String,
        onMenuTap: @escaping () -> Void,
        titleLineLimit: Int? = nil,
        isReadOnly: Bool = false,
        @ViewBuilder trailing: @escaping () -> Trailing = { EmptyView() },
        @ViewBuilder searchBarAction: @escaping () -> SearchBarAction = { EmptyView() }
    ) {
        self.title = title
        self.onMenuTap = onMenuTap
        self.titleLineLimit = titleLineLimit
        self.isReadOnly = isReadOnly
        self.searchConfig = nil
        self.trailing = trailing
        self.searchBarAction = searchBarAction
    }

    // Init with search
    init(
        title: String,
        onMenuTap: @escaping () -> Void,
        isSearching: Binding<Bool>,
        searchQuery: Binding<String>,
        searchPlaceholder: String = "Search...",
        onSearch: @escaping () -> Void,
        isReadOnly: Bool = false,
        @ViewBuilder trailing: @escaping () -> Trailing = { EmptyView() },
        @ViewBuilder searchBarAction: @escaping () -> SearchBarAction = { EmptyView() }
    ) {
        self.title = title
        self.onMenuTap = onMenuTap
        self.titleLineLimit = nil
        self.isReadOnly = isReadOnly
        self.searchConfig = SearchConfig(
            isSearching: isSearching,
            searchQuery: searchQuery,
            placeholder: searchPlaceholder,
            onSearch: onSearch
        )
        self.trailing = trailing
        self.searchBarAction = searchBarAction
    }

    private var isSearchActive: Bool {
        searchConfig?.isSearching.wrappedValue ?? false
    }

    var body: some ToolbarContent {
        // Leading: hidden during search
        if !isSearchActive {
            ToolbarItem(placement: .navigationBarLeading) {
                Button(action: onMenuTap) {
                    Image(systemName: "line.3.horizontal")
                        .font(.system(size: 18, weight: .medium))
                        .foregroundColor(.textPrimary)
                }
            }
        }

        // Principal: always present, content animates between title and search
        ToolbarItem(placement: .principal) {
            ZStack {
                if isSearchActive, let config = searchConfig {
                    HStack(spacing: 8) {
                        Image(systemName: "magnifyingglass")
                            .font(.system(size: 13))
                            .foregroundColor(Color(.systemGray))

                        AutoFocusTextField(
                            placeholder: config.placeholder,
                            text: config.searchQuery,
                            onSubmit: config.onSearch
                        )

                        // Slot for a view-provided search-bar action
                        // (e.g. "copy current search results"). Sits to the
                        // left of the clear button so the clear affordance
                        // stays at the trailing edge where the user expects.
                        searchBarAction()

                        Button(action: {
                            HapticManager.impact(.light)
                            config.searchQuery.wrappedValue = ""
                            config.onSearch()
                            config.isSearching.wrappedValue = false
                        }) {
                            Image(systemName: "xmark.circle.fill")
                                .font(.system(size: 14))
                                .foregroundColor(Color(.systemGray))
                        }
                    }
                    .padding(.horizontal, 12)
                    .padding(.vertical, 10)
                    .frame(width: UIScreen.main.bounds.width - 32)
                    .modifier(PillSurface(radius: 22))
                    .transition(.move(edge: .trailing).combined(with: .opacity))
                } else {
                    VStack(spacing: 1) {
                        if let lineLimit = titleLineLimit {
                            Text(title)
                                .font(.headline)
                                .lineLimit(lineLimit)
                                .truncationMode(.tail)
                        } else {
                            Text(title)
                                .font(.headline)
                        }
                        if isReadOnly {
                            HStack(spacing: 3) {
                                Image(systemName: "wifi.slash")
                                    .font(.system(size: 9, weight: .semibold))
                                Text("Read-only")
                                    .font(.system(size: 11, weight: .medium))
                            }
                            .foregroundColor(.textSecondary)
                        }
                    }
                }
            }
            .animation(.spring(response: 0.3, dampingFraction: 0.85), value: isSearchActive)
        }

        // Trailing: hidden during search
        if !isSearchActive {
            ToolbarItem(placement: .navigationBarTrailing) {
                if let config = searchConfig {
                    HStack(spacing: 12) {
                        trailing()
                        Button(action: {
                            HapticManager.impact(.light)
                            config.isSearching.wrappedValue = true
                        }) {
                            Image(systemName: "magnifyingglass")
                                .font(.system(size: 17, weight: .medium))
                                .foregroundColor(.textPrimary)
                        }
                    }
                } else {
                    trailing()
                }
            }
        }
    }
}

import SwiftUI

struct AppToolbar<Trailing: View>: ToolbarContent {
    let title: String
    let onMenuTap: () -> Void
    var titleLineLimit: Int? = nil
    @ViewBuilder let trailing: () -> Trailing

    private let searchConfig: SearchConfig?
    private let searchModeView: AnyView?

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
        @ViewBuilder trailing: @escaping () -> Trailing = { EmptyView() }
    ) {
        self.title = title
        self.onMenuTap = onMenuTap
        self.titleLineLimit = titleLineLimit
        self.searchConfig = nil
        self.searchModeView = nil
        self.trailing = trailing
    }

    // Init with search
    init(
        title: String,
        onMenuTap: @escaping () -> Void,
        isSearching: Binding<Bool>,
        searchQuery: Binding<String>,
        searchPlaceholder: String = "Search...",
        onSearch: @escaping () -> Void,
        searchModeView: AnyView? = nil,
        @ViewBuilder trailing: @escaping () -> Trailing = { EmptyView() }
    ) {
        self.title = title
        self.onMenuTap = onMenuTap
        self.titleLineLimit = nil
        self.searchConfig = SearchConfig(
            isSearching: isSearching,
            searchQuery: searchQuery,
            placeholder: searchPlaceholder,
            onSearch: onSearch
        )
        self.searchModeView = searchModeView
        self.trailing = trailing
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
                    VStack(spacing: 6) {
                        HStack(spacing: 8) {
                            Image(systemName: "magnifyingglass")
                                .font(.system(size: 13))
                                .foregroundColor(Color(.systemGray))

                            AutoFocusTextField(
                                placeholder: config.placeholder,
                                text: config.searchQuery,
                                onSubmit: config.onSearch
                            )

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

                        if let modeView = searchModeView {
                            modeView
                        }
                    }
                    .transition(.move(edge: .trailing).combined(with: .opacity))
                } else {
                    if let lineLimit = titleLineLimit {
                        Text(title)
                            .font(.headline)
                            .lineLimit(lineLimit)
                            .truncationMode(.tail)
                    } else {
                        Text(title)
                            .font(.headline)
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

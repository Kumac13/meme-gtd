import SwiftUI

struct RootView: View {
    @State private var selectedTab: AppTab = .memos
    @State private var isMenuOpen: Bool = false
    @State private var navigationPath = NavigationPath()

    var body: some View {
        ZStack {
            // Content layer
            NavigationStack(path: $navigationPath) {
                Group {
                    switch selectedTab {
                    case .memos:
                        MemoListView(
                            onMenuTap: { openMenu() },
                            navigationPath: $navigationPath
                        )
                    case .settings:
                        SettingsView(onMenuTap: { openMenu() })
                    }
                }
                .navigationDestination(for: Int.self) { memoId in
                    MemoDetailView(
                        memoId: memoId,
                        onMenuTap: { openMenu() }
                    )
                }
            }

            // Menu overlay layer
            if isMenuOpen {
                SideMenuView(
                    selectedTab: $selectedTab,
                    isOpen: $isMenuOpen,
                    onNavigate: { tab in
                        selectedTab = tab
                        navigationPath = NavigationPath()
                        withAnimation(.easeOut(duration: 0.25)) {
                            isMenuOpen = false
                        }
                    }
                )
            }
        }
    }

    private func openMenu() {
        HapticManager.impact(.light)
        withAnimation(.easeOut(duration: 0.25)) {
            isMenuOpen = true
        }
    }
}

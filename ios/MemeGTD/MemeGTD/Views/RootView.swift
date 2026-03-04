import SwiftUI

struct MemoRoute: Hashable {
    let memoId: Int
    let initialBody: String
}

struct RootView: View {
    @State private var selectedTab: AppTab = .memos
    @State private var isMenuOpen: Bool = false
    @State private var navigationPath = NavigationPath()

    private let menuWidth: CGFloat = 280
    // iPhone 16 Pro screen corner radius (~55pt)
    // Content panel uses concentric radius: screen radius - edge inset
    private let contentCornerRadius: CGFloat = 50

    var body: some View {
        ZStack(alignment: .leading) {
            // Layer 1: Menu (always in background)
            SideMenuView(
                selectedTab: $selectedTab,
                onNavigate: { tab in
                    selectedTab = tab
                    navigationPath = NavigationPath()
                    closeMenu()
                }
            )
            .frame(width: menuWidth)

            // Layer 2: Main content (slides right when menu opens)
            NavigationStack(path: $navigationPath) {
                Group {
                    switch selectedTab {
                    case .memos:
                        MemoListView(
                            onMenuTap: { openMenu() },
                            navigationPath: $navigationPath
                        )
                    case .tasks:
                        TaskListView(onMenuTap: { openMenu() })
                    case .settings:
                        SettingsView(onMenuTap: { openMenu() })
                    }
                }
                .navigationDestination(for: MemoRoute.self) { route in
                    MemoDetailView(
                        memoId: route.memoId,
                        initialBody: route.initialBody,
                        onMenuTap: { openMenu() }
                    )
                }
            }
            .opacity(isMenuOpen ? 0.6 : 1.0)
            .overlay {
                Color.clear
                    .contentShape(Rectangle())
                    .ignoresSafeArea()
                    .allowsHitTesting(isMenuOpen)
                    .onTapGesture { closeMenu() }
            }
            .mask {
                RoundedRectangle(
                    cornerRadius: isMenuOpen ? contentCornerRadius : 0,
                    style: .continuous
                )
                .ignoresSafeArea()
            }
            // Layered shadows for realistic depth (near + far)
            .background {
                if isMenuOpen {
                    RoundedRectangle(cornerRadius: contentCornerRadius, style: .continuous)
                        .fill(Color(.systemBackground))
                        .shadow(color: .black.opacity(0.12), radius: 24, x: -6, y: 0)
                        .shadow(color: .black.opacity(0.06), radius: 4, x: -1, y: 0)
                        .ignoresSafeArea()
                }
            }
            .offset(x: isMenuOpen ? menuWidth : 0)
            .animation(.spring(response: 0.32, dampingFraction: 0.88), value: isMenuOpen)
            .ignoresSafeArea()
        }
        .background(Color.menuBackground)
    }

    private func openMenu() {
        UIApplication.shared.sendAction(#selector(UIResponder.resignFirstResponder), to: nil, from: nil, for: nil)
        HapticManager.impact(.light)
        isMenuOpen = true
    }

    private func closeMenu() {
        HapticManager.impact(.light)
        isMenuOpen = false
    }
}

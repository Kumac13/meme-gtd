import SwiftUI

struct MemoRoute: Hashable {
    let memoId: Int
    let initialBody: String
}

struct TaskRoute: Hashable {
    let taskId: Int
    let initialTitle: String
}

struct ArticleRoute: Hashable {
    let articleId: Int
    let initialTitle: String
}

struct RootView: View {
    @EnvironmentObject private var syncEngine: SyncEngine
    @State private var selectedTab: AppTab = .memos
    @State private var isMenuOpen: Bool = false
    @State private var navigationPath = NavigationPath()
    @State private var failedMemosSheetPresented: Bool = false

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
                        TaskListView(
                            onMenuTap: { openMenu() },
                            navigationPath: $navigationPath
                        )
                    case .articles:
                        ArticleListView(
                            onMenuTap: { openMenu() },
                            navigationPath: $navigationPath
                        )
                    case .settings:
                        SettingsView(onMenuTap: { openMenu() })
                    }
                }
                .navigationDestination(for: MemoRoute.self) { route in
                    MemoDetailView(
                        memoId: route.memoId,
                        initialBody: route.initialBody,
                        onMenuTap: { openMenu() },
                        onNavigateToLinkedIssue: { id, type, title in
                            navigateToIssue(id: id, type: type, title: title)
                        }
                    )
                }
                .navigationDestination(for: TaskRoute.self) { route in
                    TaskDetailView(
                        taskId: route.taskId,
                        initialTitle: route.initialTitle,
                        onMenuTap: { openMenu() },
                        onNavigateToLinkedIssue: { id, type, title in
                            navigateToIssue(id: id, type: type, title: title)
                        }
                    )
                }
                .navigationDestination(for: ArticleRoute.self) { route in
                    ArticleDetailView(
                        articleId: route.articleId,
                        initialTitle: route.initialTitle,
                        onMenuTap: { openMenu() },
                        onNavigateToLinkedIssue: { id, type, title in
                            navigateToIssue(id: id, type: type, title: title)
                        }
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
        .overlay(alignment: .top) {
            // Only surface the banner when something actually failed —
            // otherwise the offline path is meant to be silent.
            if syncEngine.failedCount > 0 && !isMenuOpen {
                FailedMemosBanner(count: syncEngine.failedCount) {
                    failedMemosSheetPresented = true
                }
            }
        }
        .sheet(isPresented: $failedMemosSheetPresented) {
            NavigationStack {
                FailedMemosView()
                    .toolbar {
                        ToolbarItem(placement: .topBarTrailing) {
                            Button("Done") { failedMemosSheetPresented = false }
                        }
                    }
            }
            .environmentObject(syncEngine)
        }
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

    private func navigateToIssue(id: Int, type: String, title: String) {
        switch type {
        case "task":
            navigationPath.append(TaskRoute(taskId: id, initialTitle: title))
        case "memo":
            navigationPath.append(MemoRoute(memoId: id, initialBody: title))
        case "article":
            navigationPath.append(ArticleRoute(articleId: id, initialTitle: title))
        default:
            break
        }
    }
}

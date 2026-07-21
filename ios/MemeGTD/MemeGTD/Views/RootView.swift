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

struct TemplateRoute: Hashable {
    let templateId: Int
    let initialTitle: String
}

enum IssueRouteDestination: Equatable {
    case memo(MemoRoute)
    case task(TaskRoute)
    case article(ArticleRoute)
    case template(TemplateRoute)

    init?(id: Int, type: String?, title: String) {
        switch type {
        case "memo":
            self = .memo(MemoRoute(memoId: id, initialBody: title))
        case "task":
            self = .task(TaskRoute(taskId: id, initialTitle: title))
        case "article":
            self = .article(ArticleRoute(articleId: id, initialTitle: title))
        case "template":
            self = .template(TemplateRoute(templateId: id, initialTitle: title))
        default:
            return nil
        }
    }

    func append(to path: inout NavigationPath) {
        switch self {
        case .memo(let route): path.append(route)
        case .task(let route): path.append(route)
        case .article(let route): path.append(route)
        case .template(let route): path.append(route)
        }
    }
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
                        TaskListView(
                            onMenuTap: { openMenu() },
                            navigationPath: $navigationPath
                        )
                    case .articles:
                        ArticleListView(
                            onMenuTap: { openMenu() },
                            navigationPath: $navigationPath
                        )
                    case .templates:
                        TemplateListView(
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
                .navigationDestination(for: TemplateRoute.self) { route in
                    TemplateDetailView(
                        templateId: route.templateId,
                        initialTitle: route.initialTitle,
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

    private func navigateToIssue(id: Int, type: String, title: String) {
        guard let destination = IssueRouteDestination(id: id, type: type, title: title) else { return }
        destination.append(to: &navigationPath)
    }
}

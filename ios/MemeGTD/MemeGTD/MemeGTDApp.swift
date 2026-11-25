import Combine
import SwiftUI

@main
struct MemeGTDApp: App {
    @State private var endpoint = Settings.shared.effectiveApiUrl
    var body: some Scene {
        WindowGroup {
            ServerSessionView()
                .id(endpoint)
                .onReceive(NotificationCenter.default.publisher(for: .serverEndpointChanged)) { _ in
                    endpoint = Settings.shared.effectiveApiUrl
                }
        }
    }
}

extension Notification.Name {
    static let serverEndpointChanged = Notification.Name("ServerEndpointChanged")
}

private struct ServerSessionView: View {
    @StateObject private var taskStore = TaskStore()
    @StateObject private var memoStore = MemoStore()
    @StateObject private var articleStore = ArticleStore()
    @StateObject private var templateStore = TemplateStore()
    @StateObject private var dataSources = DataSourceProvider()
    @Environment(\.scenePhase) private var scenePhase

    var body: some View {
        RootView()
            .environmentObject(taskStore)
            .environmentObject(memoStore)
            .environmentObject(articleStore)
            .environmentObject(templateStore)
            .environmentObject(dataSources)
            .task {
                if Settings.shared.appMode == .server { await CreationTemplateCache.shared.refreshAll() }
            }
            .onReceive(ConnectivityMonitor.shared.$state.removeDuplicates().dropFirst()) { state in
                if state == .available, let scheduler = dataSources.syncScheduler {
                    scheduler.requestSync()
                    Task { await CreationTemplateCache.shared.refreshAll() }
                }
            }
            .preferredColorScheme(.light)
        .onChange(of: scenePhase) { _, newPhase in
            // Sync trigger: scene became active (no-op while Offline Sync is
            // off — the scheduler only exists when the toggle is on).
            if newPhase == .active {
                dataSources.syncScheduler?.sceneDidBecomeActive()
            }
        }
    }
}

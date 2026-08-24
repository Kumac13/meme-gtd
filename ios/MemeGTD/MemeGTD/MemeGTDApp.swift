import SwiftUI

@main
struct MemeGTDApp: App {
    @StateObject private var taskStore = TaskStore()
    @StateObject private var memoStore = MemoStore()
    @StateObject private var articleStore = ArticleStore()
    @StateObject private var templateStore = TemplateStore()
    @StateObject private var dataSources = DataSourceProvider()
    @Environment(\.scenePhase) private var scenePhase

    init() {
        // Touch the shared local database so the App Group DB file and schema
        // exist right after launch. No feature reads from it yet (offline
        // support lands in later phases).
        _ = AppDatabase.shared
        // Start server-reachability monitoring at launch. The singleton is
        // otherwise created lazily by the first task/article view that
        // observes it — but memo screens never do, so an outage that starts
        // there would go completely undetected (no probes, no recovery loop)
        // until the user happens to open a task or article screen.
        _ = ConnectivityMonitor.shared
    }

    var body: some Scene {
        WindowGroup {
            RootView()
                .environmentObject(taskStore)
                .environmentObject(memoStore)
                .environmentObject(articleStore)
                .environmentObject(templateStore)
                .environmentObject(dataSources)
                .preferredColorScheme(.light)
        }
        .onChange(of: scenePhase) { _, newPhase in
            // Sync trigger: scene became active (no-op while Offline Sync is
            // off — the scheduler only exists when the toggle is on).
            if newPhase == .active {
                dataSources.syncScheduler?.sceneDidBecomeActive()
            }
        }
    }
}

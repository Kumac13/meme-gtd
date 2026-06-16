import SwiftUI

@main
struct MemeGTDApp: App {
    @StateObject private var taskStore = TaskStore()
    @StateObject private var memoStore = MemoStore()
    @StateObject private var articleStore = ArticleStore()
    @StateObject private var syncEngine = SyncEngine.shared
    @StateObject private var networkMonitor = NetworkMonitor.shared

    var body: some Scene {
        WindowGroup {
            RootView()
                .environmentObject(taskStore)
                .environmentObject(memoStore)
                .environmentObject(articleStore)
                .environmentObject(syncEngine)
                .environmentObject(networkMonitor)
                .preferredColorScheme(.light)
                .task {
                    // bootstrap once per process; SyncEngine handles its own
                    // re-trigger semantics on subsequent foreground events.
                    syncEngine.bootstrap()
                }
        }
    }
}

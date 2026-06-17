import SwiftUI

@main
struct MemeGTDApp: App {
    @StateObject private var taskStore = TaskStore()
    @StateObject private var memoStore = MemoStore()
    @StateObject private var articleStore = ArticleStore()
    // `SyncEngine.shared` and `NetworkMonitor.shared` are singletons that own
    // their own lifetime — wrapping them in @StateObject would imply the App
    // created them, which is misleading. @ObservedObject correctly says
    // "observe these published changes without claiming ownership."
    @ObservedObject private var syncEngine = SyncEngine.shared
    @ObservedObject private var networkMonitor = NetworkMonitor.shared

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

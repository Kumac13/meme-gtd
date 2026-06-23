import SwiftUI
import SwiftData

@main
struct MemeGTDApp: App {
    @StateObject private var taskStore = TaskStore()
    @StateObject private var memoStore = MemoStore()
    @StateObject private var articleStore = ArticleStore()
    @StateObject private var networkMonitor = NetworkMonitor.shared
    @StateObject private var syncEngine = SyncEngine.shared

    var body: some Scene {
        WindowGroup {
            RootView()
                .environmentObject(taskStore)
                .environmentObject(memoStore)
                .environmentObject(articleStore)
                .environmentObject(networkMonitor)
                .environmentObject(syncEngine)
                .preferredColorScheme(.light)
                .task {
                    // First-run wiring. ModelContext must come from the
                    // attached container; capturing it inside `.task`
                    // guarantees we are on the main actor.
                    let context = AppDatabase.shared.mainContext
                    memoStore.setModelContext(context)
                    syncEngine.attach(context: context)
                    syncEngine.bindToNetworkMonitor(networkMonitor)
                    networkMonitor.start()

                    // Story 6: first launch performs a full pull so the
                    // device has every memo cached for offline browsing.
                    await syncEngine.runInitialHydration()
                    await syncEngine.pullMemos()
                }
        }
        .modelContainer(AppDatabase.shared)
    }
}

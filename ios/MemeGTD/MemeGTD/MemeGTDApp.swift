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
                    //
                    // We deliberately do NOT attach `.modelContainer(...)` to
                    // WindowGroup, and do NOT bind MemoStore to SyncEngine's
                    // didFinishSyncStep. Both hooked the SwiftUI render cycle
                    // into background SwiftData / Combine activity, which
                    // interrupted the toolbar search field's open / close
                    // animation. UI state is refreshed only at well-defined
                    // points: app launch (end of this .task), each list
                    // view's `.task`, and after explicit user actions.
                    let context = AppDatabase.shared.mainContext
                    memoStore.setModelContext(context)
                    syncEngine.attach(context: context)
                    syncEngine.bindToNetworkMonitor(networkMonitor)
                    networkMonitor.start()
                    memoStore.refreshPending()

                    // First push any ops that survived a previous offline
                    // session, then ensure the cache is current.
                    await syncEngine.pushOutbox()
                    memoStore.refreshPending()

                    // Story 6: first launch performs a full pull so the
                    // device has every memo cached for offline browsing.
                    await syncEngine.runInitialHydration()
                    await syncEngine.pullMemos()
                    memoStore.refreshFromCache()
                }
        }
    }
}

import SwiftUI

@main
struct MemeGTDApp: App {
    @StateObject private var taskStore = TaskStore()
    @StateObject private var memoStore = MemoStore()
    @StateObject private var articleStore = ArticleStore()
    @StateObject private var dataSources = DataSourceProvider()

    init() {
        // Touch the shared local database so the App Group DB file and schema
        // exist right after launch. No feature reads from it yet (offline
        // support lands in later phases).
        _ = AppDatabase.shared
    }

    var body: some Scene {
        WindowGroup {
            RootView()
                .environmentObject(taskStore)
                .environmentObject(memoStore)
                .environmentObject(articleStore)
                .environmentObject(dataSources)
                .preferredColorScheme(.light)
        }
    }
}

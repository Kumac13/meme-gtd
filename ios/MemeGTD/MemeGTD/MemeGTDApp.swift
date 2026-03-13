import SwiftUI

@main
struct MemeGTDApp: App {
    @StateObject private var taskStore = TaskStore()
    @StateObject private var memoStore = MemoStore()

    var body: some Scene {
        WindowGroup {
            RootView()
                .environmentObject(taskStore)
                .environmentObject(memoStore)
                .preferredColorScheme(.light)
        }
    }
}

import SwiftUI
import GRDB

extension View {
    func observePendingThreads(kind: String, update: @escaping @MainActor (Set<Int>) -> Void) -> some View {
        task {
            guard Settings.shared.appMode == .server else { return }
            let endpoint = Settings.shared.effectiveApiUrl
            let observation = ValueObservation.tracking { db in
                try ThreadDelivery.pendingThreadIDs(db, kind: kind, endpoint: endpoint)
            }
            do {
                for try await ids in observation.values(in: AppDatabase.shared.dbWriter) {
                    if Task.isCancelled { return }
                    update(ids)
                }
            } catch { return }
        }
    }

    func observeThread(id: Int, update: @escaping @MainActor (ThreadDelivery) -> Void) -> some View {
        task(id: id) {
            guard Settings.shared.appMode == .server else { return }
            let endpoint = Settings.shared.effectiveApiUrl
            let observation = ValueObservation.tracking { db in try ThreadDelivery.read(db, id: id, endpoint: endpoint) }
            do {
                for try await value in observation.values(in: AppDatabase.shared.dbWriter) {
                    if Task.isCancelled { return }
                    update(value)
                }
            } catch { return }
        }
    }
}

import Foundation
import SwiftData

/// Owns the SwiftData ModelContainer used by the host app. The container is
/// constructed once on first access; if the persistent store cannot be
/// opened (e.g. an incompatible schema after an app update) the on-disk file
/// is deleted and the container is re-created empty. Because the server is
/// the source of truth, recovery costs only one full pull.
enum AppDatabase {
    static let shared = AppDatabase.makeContainer()

    private static let schema = Schema([
        LocalMemo.self,
        LocalComment.self,
        OutboxOperation.self,
    ])

    private static func makeContainer() -> ModelContainer {
        let storeURL = defaultStoreURL()
        let configuration = ModelConfiguration(
            schema: schema,
            url: storeURL,
            allowsSave: true,
            cloudKitDatabase: .none
        )

        do {
            return try ModelContainer(for: schema, configurations: [configuration])
        } catch {
            // The store is unreadable — delete it and start fresh. The
            // server holds all the data, so the next pull rehydrates.
            NSLog("[AppDatabase] ModelContainer init failed: \(error). Resetting store at \(storeURL.path).")
            removeStore(at: storeURL)
            UserDefaults.standard.removeObject(forKey: AppDatabase.hydrationFlagKey)
            do {
                return try ModelContainer(for: schema, configurations: [configuration])
            } catch {
                fatalError("ModelContainer could not be created even after reset: \(error)")
            }
        }
    }

    /// Returns the on-disk location of the SwiftData store. We place it in
    /// Application Support so it survives backups but isn't user-visible.
    private static func defaultStoreURL() -> URL {
        let fm = FileManager.default
        let base = (try? fm.url(
            for: .applicationSupportDirectory,
            in: .userDomainMask,
            appropriateFor: nil,
            create: true
        )) ?? URL(fileURLWithPath: NSTemporaryDirectory())
        let directory = base.appendingPathComponent("MemeGTD", isDirectory: true)
        try? fm.createDirectory(at: directory, withIntermediateDirectories: true)
        return directory.appendingPathComponent("local.store")
    }

    private static func removeStore(at url: URL) {
        let fm = FileManager.default
        for suffix in ["", "-wal", "-shm"] {
            let path = url.path + suffix
            try? fm.removeItem(atPath: path)
        }
    }

    /// UserDefaults flag tracking whether the initial full pull has completed
    /// for the current schema version. Reset when the store is rebuilt.
    static let hydrationFlagKey = "MemeGTD.app.didHydrateMemos_v1"
}

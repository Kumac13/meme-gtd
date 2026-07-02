import Foundation
import GRDB

/// Stable per-install device identifier used by the sync protocol (push
/// `deviceId` and conflicted-copy annotations, offline support plan S4).
nonisolated enum DeviceID {
    static let syncMetaKey = "device_id"

    /// Returns the persisted device identifier, generating and storing one in
    /// `sync_meta` on first access. Runs in a single write transaction so
    /// concurrent first accesses agree on the same identifier.
    static func identifier(in database: AppDatabase) throws -> String {
        try database.dbWriter.write { db in
            if let existing = try String.fetchOne(
                db,
                sql: "SELECT value FROM sync_meta WHERE key = ?",
                arguments: [syncMetaKey]
            ) {
                return existing
            }
            let identifier = UUID().uuidString.lowercased()
            try db.execute(
                sql: "INSERT INTO sync_meta (key, value) VALUES (?, ?)",
                arguments: [syncMetaKey, identifier]
            )
            return identifier
        }
    }
}

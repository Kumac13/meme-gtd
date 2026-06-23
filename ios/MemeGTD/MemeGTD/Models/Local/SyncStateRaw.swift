import Foundation

/// Sync state of a LocalMemo or LocalComment relative to the server.
///
/// `synced`         — server holds the same content (remoteId set)
/// `pendingCreate`  — created locally; not yet POSTed
/// `pendingUpdate`  — edited locally; PATCH not yet flushed
/// `pendingDelete`  — soft-deleted locally; DELETE not yet flushed
/// `conflict`       — server-side change made the pending op unresolvable
///                    (e.g., PATCH returned 404 because the row was deleted server-side)
enum SyncStateRaw: String, Codable, CaseIterable {
    case synced
    case pendingCreate
    case pendingUpdate
    case pendingDelete
    case conflict
}

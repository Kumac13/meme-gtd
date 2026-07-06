import Foundation

/// Error thrown by the offline-first read caches (tasks / articles /
/// projects) when a WRITE is attempted without connectivity. Kept separate
/// from `APIError` so exhaustive switches over API errors stay untouched.
///
/// Tasks, articles and projects are read-only offline (offline support plan
/// Phase 7): unlike memos they have no outbox path, so a write that cannot
/// reach the server is refused instead of being queued.
nonisolated struct OfflineReadOnlyError: Error, LocalizedError {
    var errorDescription: String? {
        "Offline — this action requires a connection."
    }
}

/// Shared helpers for the offline-first read caches.
nonisolated enum OfflineFirstSupport {
    /// Whether the error means "the server could not be reached" (as opposed
    /// to a server-side rejection or a decoding problem). Only this case
    /// falls back to the local cache: 4xx/5xx answers and decode failures
    /// must surface to the user unchanged.
    static func isNetworkError(_ error: Error) -> Bool {
        if case APIError.networkError = error { return true }
        return false
    }
}

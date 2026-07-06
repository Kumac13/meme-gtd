import Foundation

/// ISO 8601 timestamps with millisecond precision, matching the server's
/// `nowIso()` format exactly (e.g. "2026-07-02T03:00:23.911Z"). The sync
/// protocol compares `updatedAt` strings for equality only, so producing the
/// same textual format as the server is what matters.
nonisolated enum ISO8601Millis {
    /// Current time as an ISO 8601 string with milliseconds, UTC.
    static func now() -> String {
        string(from: Date())
    }

    /// The given date as an ISO 8601 string with milliseconds, UTC.
    static func string(from date: Date) -> String {
        // A fresh formatter per call keeps this trivially thread-safe; the
        // sync layer produces timestamps at user-interaction frequency, so
        // the allocation cost is irrelevant.
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return formatter.string(from: date)
    }
}

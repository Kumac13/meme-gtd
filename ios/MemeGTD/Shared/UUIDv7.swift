import Foundation

/// RFC 9562 UUID version 7 generator (time-ordered).
///
/// Layout: 48-bit Unix millisecond timestamp, 4-bit version (7), 12-bit
/// monotonic counter, 2-bit variant (10), 62 random bits. The counter makes
/// identifiers generated within the same millisecond strictly increasing,
/// which keeps offline-created primary keys sortable by creation time.
nonisolated enum UUIDv7 {
    private static let lock = NSLock()
    // Both protected by `lock`.
    private nonisolated(unsafe) static var lastMilliseconds: UInt64 = 0
    private nonisolated(unsafe) static var counter: UInt16 = 0

    /// Generates a lowercase UUIDv7 string, e.g.
    /// "01890a5d-ac96-774b-bcce-b302099a8057".
    static func generate(now: Date = Date()) -> String {
        let milliseconds = UInt64(now.timeIntervalSince1970 * 1000)

        lock.lock()
        if milliseconds > lastMilliseconds {
            lastMilliseconds = milliseconds
            // Random starting point with headroom: the counter can still
            // increment ~2048 times within the millisecond before spilling.
            counter = UInt16.random(in: 0...0x7FF)
        } else {
            // Same millisecond (or a clock rewind): bump the counter to stay
            // monotonic; spill into the timestamp on overflow.
            if counter >= 0xFFF {
                lastMilliseconds += 1
                counter = 0
            } else {
                counter += 1
            }
        }
        let timestamp = lastMilliseconds
        let sequence = counter
        lock.unlock()

        // unix_ts_ms (48 bits) split across the first two groups.
        let timeHigh = UInt32((timestamp >> 16) & 0xFFFF_FFFF)
        let timeLow = UInt16(timestamp & 0xFFFF)
        // ver (0111) + rand_a: 12-bit monotonic counter.
        let versionField = UInt16(0x7000) | (sequence & 0x0FFF)
        // var (10) + rand_b: 62 random bits.
        let variantField = UInt16(0x8000) | (UInt16.random(in: 0...UInt16.max) & 0x3FFF)
        let randomTail = UInt64.random(in: 0...0xFFFF_FFFF_FFFF)

        return String(
            format: "%08x-%04x-%04x-%04x-%012llx",
            timeHigh, timeLow, versionField, variantField, randomTail
        )
    }
}

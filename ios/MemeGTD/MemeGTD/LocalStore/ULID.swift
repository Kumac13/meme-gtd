import Foundation

/// 128-bit Universally Unique Lexicographically Sortable Identifier.
/// 26 characters of Crockford Base32 (no I, L, O, U): the first 48 bits
/// encode a millisecond timestamp, the remaining 80 bits are random.
///
/// iOS uses ULIDs as both (1) the primary key in local_memos and (2) the
/// `clientId` sent to the server when a queued memo finally syncs. Same
/// string in both places means we can map "what the server saved" back to
/// "what the user typed offline" without a separate translation table.
enum ULID {
    private static let alphabet: [Character] = Array("0123456789ABCDEFGHJKMNPQRSTVWXYZ")

    /// Generates a fresh ULID at the current wall-clock time. Not seeded
    /// from a CSPRNG specifically because we don't need cryptographic
    /// uniqueness — collision probability over the lifetime of one device
    /// at typical memo rates is already vanishingly small.
    static func generate() -> String {
        let timestampMs = UInt64(Date().timeIntervalSince1970 * 1000)
        var bytes = [UInt8](repeating: 0, count: 16)

        // First 6 bytes (48 bits) = timestamp, big-endian.
        for i in 0..<6 {
            bytes[5 - i] = UInt8((timestampMs >> (i * 8)) & 0xFF)
        }
        // Remaining 10 bytes (80 bits) = randomness.
        for i in 6..<16 {
            bytes[i] = UInt8.random(in: 0...255)
        }

        return encodeCrockfordBase32(bytes)
    }

    /// Strict ULID format check: 26 Crockford Base32 chars. Mirrors the
    /// regex used in the server's CreateMemoRequestSchema so something
    /// the iOS side accepts will never be rejected by the API.
    static func isValid(_ candidate: String) -> Bool {
        guard candidate.count == 26 else { return false }
        let upper = candidate.uppercased()
        for ch in upper {
            if !alphabet.contains(ch) { return false }
        }
        return true
    }

    /// Encodes 16 bytes (128 bits) as 26 chars of Crockford Base32.
    /// The byte stream is treated as a single big-endian integer and shifted
    /// 5 bits at a time from the most-significant end.
    private static func encodeCrockfordBase32(_ bytes: [UInt8]) -> String {
        var output = ""
        output.reserveCapacity(26)

        // Build the 128-bit value as two 64-bit halves (Swift has no UInt128).
        var hi: UInt64 = 0
        var lo: UInt64 = 0
        for i in 0..<8 {
            hi = (hi << 8) | UInt64(bytes[i])
        }
        for i in 8..<16 {
            lo = (lo << 8) | UInt64(bytes[i])
        }

        // 130 bits >> 5 = 26 chunks. We need to seed by left-shifting 2 bits
        // first so the most significant chunk has 5 bits to work with.
        // Easier: iterate from the top, taking 5 bits at a time.
        // chunks[0] is most significant -> char at output[0].
        var chunks = [UInt8](repeating: 0, count: 26)
        for i in stride(from: 25, through: 0, by: -1) {
            chunks[i] = UInt8(lo & 0x1F)
            lo = (lo >> 5) | ((hi & 0x1F) << 59)
            hi = hi >> 5
        }

        for chunk in chunks {
            output.append(alphabet[Int(chunk)])
        }
        return output
    }
}

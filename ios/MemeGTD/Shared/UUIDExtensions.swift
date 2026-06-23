import Foundation

extension UUID {
    /// Stable negative Int derived from the UUID's bytes. Used as a synthetic
    /// `Memo.id` for rows that exist only locally (no `remoteId` yet). Server
    /// IDs are always positive, so negative values reliably mark "not yet
    /// confirmed by the server". The mapping is deterministic — the same
    /// UUID produces the same Int across app launches.
    var stableLocalId: Int {
        var accumulator: UInt64 = 0
        withUnsafeBytes(of: self.uuid) { raw in
            for i in 0..<min(8, raw.count) {
                accumulator = (accumulator << 8) | UInt64(raw[i])
            }
        }
        let positive = Int(accumulator & 0x7FFF_FFFF_FFFF_FFFF)
        return -max(1, positive)
    }

    /// Lowercased UUID string matching the format the API expects in
    /// `clientUuid` payloads.
    var lowercasedString: String {
        uuidString.lowercased()
    }
}

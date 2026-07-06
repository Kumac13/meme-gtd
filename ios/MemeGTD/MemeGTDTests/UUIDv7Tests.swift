import XCTest
@testable import MemeGTD

final class UUIDv7Tests: XCTestCase {
    // RFC 9562: version nibble 7, variant bits 10 (hex 8, 9, a or b).
    private let uuidV7Pattern =
        "^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$"

    func testGeneratedStringMatchesVersion7Format() {
        for _ in 0..<100 {
            let id = UUIDv7.generate()
            XCTAssertNotNil(
                id.range(of: uuidV7Pattern, options: .regularExpression),
                "\(id) is not a valid UUIDv7 string"
            )
        }
    }

    func testGeneratedInSequenceIsMonotonicallyIncreasing() {
        let ids = (0..<1000).map { _ in UUIDv7.generate() }

        // Strictly increasing: sorted order equals generation order, and all
        // values are unique (many of these share the same millisecond, so
        // this exercises the 12-bit counter).
        XCTAssertEqual(ids, ids.sorted())
        XCTAssertEqual(Set(ids).count, ids.count)
    }

    func testTimestampBitsEncodeCurrentTime() throws {
        // The generator never goes backwards (monotonic state), so compare
        // against the wall clock with a small headroom for counter spill.
        let before = UInt64(Date().timeIntervalSince1970 * 1000)
        let id = UUIDv7.generate()
        let after = UInt64(Date().timeIntervalSince1970 * 1000)

        let hexTimestamp = id.replacingOccurrences(of: "-", with: "").prefix(12)
        let milliseconds = try XCTUnwrap(UInt64(hexTimestamp, radix: 16))

        XCTAssertGreaterThanOrEqual(milliseconds, before)
        XCTAssertLessThanOrEqual(milliseconds, after + 10)
    }
}

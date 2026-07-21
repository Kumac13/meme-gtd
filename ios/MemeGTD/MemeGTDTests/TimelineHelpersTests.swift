import XCTest
@testable import MemeGTD

final class TimelineHelpersTests: XCTestCase {
    private let now = ISO8601DateFormatter().date(from: "2026-07-13T12:00:00Z")!

    func testCompactRelativeTimeBoundaries() {
        XCTAssertEqual(compact(secondsAgo: 0), "now")
        XCTAssertEqual(compact(secondsAgo: 59), "now")
        XCTAssertEqual(compact(secondsAgo: 60), "1m")
        XCTAssertEqual(compact(secondsAgo: 3_599), "59m")
        XCTAssertEqual(compact(secondsAgo: 3_600), "1h")
        XCTAssertEqual(compact(secondsAgo: 86_400), "1d")
        XCTAssertEqual(compact(secondsAgo: 7 * 86_400), "1w")
        XCTAssertEqual(compact(secondsAgo: 30 * 86_400), "4w")
        XCTAssertEqual(compact(secondsAgo: 35 * 86_400), "1mo")
        XCTAssertEqual(compact(secondsAgo: 365 * 86_400), "1y")
    }

    func testCompactRelativeTimeAcceptsFractionalAndNonFractionalISO() {
        XCTAssertEqual(
            TimelineHelpers.compactRelativeTimeString(
                iso: "2026-07-13T11:55:00.000Z",
                now: now
            ),
            "5m"
        )
        XCTAssertEqual(
            TimelineHelpers.compactRelativeTimeString(
                iso: "2026-07-13T11:55:00Z",
                now: now
            ),
            "5m"
        )
    }

    func testCompactRelativeTimeReturnsEmptyForInvalidDate() {
        XCTAssertEqual(
            TimelineHelpers.compactRelativeTimeString(iso: "invalid", now: now),
            ""
        )
    }

    private func compact(secondsAgo: TimeInterval) -> String {
        let date = now.addingTimeInterval(-secondsAgo)
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime]
        return TimelineHelpers.compactRelativeTimeString(
            iso: formatter.string(from: date),
            now: now
        )
    }
}

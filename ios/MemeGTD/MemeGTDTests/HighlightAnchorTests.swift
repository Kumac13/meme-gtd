import XCTest
@testable import MemeGTD

final class HighlightAnchorTests: XCTestCase {
    func testComputeQuoteCapturesExactAndContext() {
        let text = "The quick brown fox jumps over the lazy dog." as NSString
        let range = text.range(of: "quick brown fox")
        let quote = HighlightAnchor.computeQuote(text: text, selectedRange: range)
        XCTAssertNotNil(quote)
        XCTAssertEqual(quote?.exact, "quick brown fox")
        XCTAssertEqual(quote?.prefix, "The ")
        XCTAssertEqual(quote?.suffix, " jumps over the lazy dog.")
    }

    func testComputeQuoteRejectsEmptySelection() {
        let text = "Hello world" as NSString
        XCTAssertNil(HighlightAnchor.computeQuote(text: text, selectedRange: NSRange(location: 2, length: 0)))
    }

    func testLocateRoundTrip() {
        let text = "The quick brown fox jumps over the lazy dog." as NSString
        let quote = QuoteSelector(exact: "quick brown fox", prefix: "The ", suffix: " jumps")
        let range = HighlightAnchor.locate(quote, in: text)
        XCTAssertNotNil(range)
        XCTAssertEqual(text.substring(with: range!), "quick brown fox")
    }

    func testLocateDisambiguatesRepeatsByContext() {
        let text = "see the cat and the cat again" as NSString
        let first = QuoteSelector(exact: "the cat", prefix: "see ", suffix: " and")
        let second = QuoteSelector(exact: "the cat", prefix: "and ", suffix: " again")
        let r1 = HighlightAnchor.locate(first, in: text)
        let r2 = HighlightAnchor.locate(second, in: text)
        XCTAssertNotNil(r1)
        XCTAssertNotNil(r2)
        XCTAssertLessThan(r1!.location, r2!.location)
    }

    func testLocateUniqueExactIgnoresMismatchedContext() {
        // A Web-created highlight may carry prefix/suffix that span the whole
        // body; within a single iOS block the unique-exact path still resolves it.
        let text = "Readability extracts the main article body cleanly." as NSString
        let quote = QuoteSelector(exact: "main article body", prefix: "unrelated-prefix", suffix: "unrelated-suffix")
        let range = HighlightAnchor.locate(quote, in: text)
        XCTAssertNotNil(range)
        XCTAssertEqual(text.substring(with: range!), "main article body")
    }

    func testLocateReturnsNilWhenAbsent() {
        let text = "nothing to see here" as NSString
        XCTAssertNil(HighlightAnchor.locate(QuoteSelector(exact: "missing", prefix: nil, suffix: nil), in: text))
    }

    func testHighlightDecodes() throws {
        let json = """
        {"id":1,"issueId":2,"exact":"quick brown fox","prefix":"The ","suffix":" jumps","color":"green","createdAt":"2026-07-09T00:00:00.000Z","updatedAt":"2026-07-09T00:00:00.000Z","commentCount":1}
        """.data(using: .utf8)!
        let highlight = try JSONDecoder().decode(Highlight.self, from: json)
        XCTAssertEqual(highlight.id, 1)
        XCTAssertEqual(highlight.issueId, 2)
        XCTAssertEqual(highlight.exact, "quick brown fox")
        XCTAssertEqual(highlight.color, "green")
        XCTAssertEqual(highlight.commentCount, 1)
    }

    func testCommentDecodesWithHighlightId() throws {
        let json = """
        {"id":5,"issueId":2,"highlightId":1,"bodyMd":"note","createdAt":"2026-07-09T00:00:00.000Z","updatedAt":"2026-07-09T00:00:00.000Z"}
        """.data(using: .utf8)!
        let comment = try JSONDecoder().decode(Comment.self, from: json)
        XCTAssertEqual(comment.highlightId, 1)
        XCTAssertEqual(comment.issueId, 2)
    }

    func testCommentDecodesWithoutHighlightId() throws {
        let json = """
        {"id":5,"issueId":2,"bodyMd":"note","createdAt":"2026-07-09T00:00:00.000Z","updatedAt":"2026-07-09T00:00:00.000Z"}
        """.data(using: .utf8)!
        let comment = try JSONDecoder().decode(Comment.self, from: json)
        XCTAssertNil(comment.highlightId)
    }
}

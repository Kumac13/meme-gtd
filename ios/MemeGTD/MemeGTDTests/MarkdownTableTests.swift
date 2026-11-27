import XCTest
@testable import MemeGTD

final class MarkdownTableTests: XCTestCase {
    @MainActor
    func testHeaderOnlyAndEmptyCellsAndRows() throws {
        let headerOnly = try table(in: """
        | 一 | 二 | 三 |
        | :-- | :-: | --: |
        """)
        XCTAssertEqual(strings(headerOnly), [["一", "二", "三"]])
        XCTAssertEqual(headerOnly.alignments, [.left, .center, .right])

        let empty = try table(in: """
        |  |  |  |
        | --- | --- | --- |
        ||||
        | first || third |
        | short |
        | ^ | second | last | ignored |
        | | | |
        """)
        XCTAssertEqual(strings(empty), [
            ["", "", ""],
            ["", "", ""],
            ["first", "", "third"],
            ["short", "", ""],
            ["^", "second", "last"],
            ["", "", ""],
        ])
    }

    @MainActor
    func testCRLFMultipleTablesAndTextAndTodoOrder() throws {
        let markdown = """
        Before
        - [ ] First

        | 一 | 二 |
        | --- | --- |
        | 長い日本語 | other |

        Middle

        | three |
        | --- |
        | row |

        - [x] Last
        After
        """.replacingOccurrences(of: "\n", with: "\r\n")

        let blocks = parseBlocks(markdown)
        let signatures = blocks.map { block in
            switch block {
            case .text(let content): return content
            case .todoItem(let checked, let content, _, let index): return "\(index) \(checked) \(content)"
            case .table(let table): return strings(table).flatMap { $0 }.joined(separator: ",")
            default: return "Unexpected block"
            }
        }
        XCTAssertEqual(signatures, [
            "Before", "0 false First", "一,二,長い日本語,other",
            "Middle\n", "three,row", "1 true Last", "After",
        ])
        let toggled = try XCTUnwrap(TodoMarkdown.toggleTodo(markdown, at: 1))
        XCTAssertTrue(toggled.contains("- [ ] Last"))
        XCTAssertTrue(toggled.contains("| 長い日本語 | other |"))
    }

    @MainActor
    func testInlineMarkupAndEscapedPipes() throws {
        let parsed = try table(in: #"""
        | A\|B | **bold** | `x\|y` |
        | --- | --- | --- |
        | *italic* and ~~struck~~ | ***both*** | [issue][ref] |

        [ref]: /tasks/42
        """#)
        XCTAssertEqual(strings(parsed), [["A|B", "bold", "x|y"], ["italic and struck", "both", "issue"]])
        XCTAssertEqual(parsed.rows[0][1].runs.first?.inlinePresentationIntent, .stronglyEmphasized)
        XCTAssertEqual(parsed.rows[0][2].runs.first?.inlinePresentationIntent, .code)
        XCTAssertEqual(parsed.rows[1][0].runs.first?.inlinePresentationIntent, .emphasized)
        XCTAssertEqual(parsed.rows[1][0].runs.last?.inlinePresentationIntent, .strikethrough)
        XCTAssertEqual(parsed.rows[1][1].runs.first?.inlinePresentationIntent, [.stronglyEmphasized, .emphasized])
        XCTAssertEqual(parsed.rows[1][2].runs.first?.link?.absoluteString, "/tasks/42")
    }

    @MainActor
    func testOnlyAllowedLinksAndNoHTMLInCells() throws {
        let parsed = try table(in: """
        | Issues | Web | Unsafe |
        | --- | --- | --- |
        | [Task](/tasks/12) | [HTTPS](https://example.com/) | [File](file:///example) |
        | [Memo](memos/3) | [Email](mailto:hello@example.com) | [Custom](custom://example.com) |
        | [HTML](//example.com/tasks/12) | <b>plain</b> | <img src="https://example.com/image.png"> |
        """)
        let rows = parsed.rows
        XCTAssertEqual(rows[1][0].runs.first?.link?.absoluteString, "/tasks/12")
        XCTAssertEqual(rows[1][1].runs.first?.link?.absoluteString, "https://example.com/")
        XCTAssertEqual(rows[2][0].runs.first?.link?.absoluteString, "memos/3")
        XCTAssertEqual(rows[2][1].runs.first?.link?.absoluteString, "mailto:hello@example.com")
        XCTAssertNil(rows[1][2].runs.first?.link)
        XCTAssertNil(rows[2][2].runs.first?.link)
        XCTAssertNil(rows[3][0].runs.first?.link)
        XCTAssertEqual(strings(parsed)[3], ["HTML", "plain", ""])
    }

    @MainActor
    func testMalformedTablesAndCodeFencesStayInExistingBlocks() {
        let markdown = """
        ```markdown
        | valid | table |
        | --- | --- |
        ```

        ~~~
        | valid | table |
        | --- | --- |
        ~~~

        | mismatched | header |
        | --- |
        """
        let blocks = parseBlocks(markdown)
        XCTAssertTrue(blocks.contains { block in
            guard case .codeBlock(let language, let code) = block else { return false }
            return language == "markdown" && code.contains("| valid | table |")
        })
        XCTAssertTrue(blocks.contains { block in
            guard case .text(let text) = block else { return false }
            return text.contains("| mismatched | header |")
        })
        XCTAssertFalse(blocks.contains { if case .table = $0 { true } else { false } })
    }

    @MainActor
    private func table(in markdown: String) throws -> MarkdownTable {
        let table = parseBlocks(markdown).compactMap { block -> MarkdownTable? in
            guard case .table(let table) = block else { return nil }
            return table
        }.first
        return try XCTUnwrap(table)
    }

    @MainActor
    private func strings(_ table: MarkdownTable) -> [[String]] {
        table.rows.map { row in row.map { String($0.characters) } }
    }
}

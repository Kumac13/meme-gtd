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
            case .table(let table, _, _): return strings(table).flatMap { $0 }.joined(separator: ",")
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
    func testNestedTablesKeepQuoteAndListPlacement() throws {
        let markdown = """
        > Before the table
        >
        > | Quote | Date |
        > | --- | --- |
        > | Quoted row | Friday |
        >
        > After the table

        - Parent item

          | List | Date |
          | --- | --- |
          | Child row | Friday |

        3. | Ordered | Date |
           | --- | --- |
           | Ordered row | Friday |

        - [ ] Final Todo
        """
        let blocks = parseBlocks(markdown)
        let tables = blocks.compactMap { block -> (MarkdownTable, MarkdownTablePlacement)? in
            guard case .table(let table, let placement, _) = block else { return nil }
            return (table, placement)
        }
        XCTAssertEqual(tables.map { strings($0.0)[1][0] }, ["Quoted row", "Child row", "Ordered row"])
        XCTAssertEqual(tables.map { $0.1.quoteDepth }, [1, 0, 0])
        XCTAssertEqual(tables.map { $0.1.listDepth }, [0, 1, 1])
        XCTAssertEqual(tables.map { $0.1.listMarker }, [nil, nil, "3."])
        XCTAssertTrue(blocks.contains { if case .blockquote(let text) = $0 { text.contains("Before the table") } else { false } })
        XCTAssertTrue(blocks.contains { if case .blockquote(let text) = $0 { text.contains("After the table") } else { false } })
        XCTAssertTrue(blocks.contains { if case .listItem(content: "Parent item", indent: 0) = $0 { true } else { false } })
        XCTAssertTrue(blocks.contains { if case .todoItem(checked: false, content: "Final Todo", indent: 0, todoIndex: 0) = $0 { true } else { false } })
    }

    @MainActor
    func testLongBacktickFenceKeepsExampleAndFollowingTableAndTodosSeparate() throws {
        let markdown = """
        - [ ] First Todo

        ````markdown
        ```text
        - [ ] This belongs to the example
        ```
        ````

        | Header | Other |
        | --- | --- |
        | Visible table | Content |

        - [ ] Last Todo
        """
        let blocks = parseBlocks(markdown)
        XCTAssertEqual(blocks.compactMap { block -> String? in
            guard case .codeBlock(language: "markdown", code: let code) = block else { return nil }
            return code
        }, ["```text\n- [ ] This belongs to the example\n```"])
        XCTAssertEqual(strings(try table(in: markdown))[1][0], "Visible table")
        XCTAssertEqual(blocks.compactMap { block -> Int? in
            guard case .todoItem(_, _, _, let index) = block else { return nil }
            return index
        }, [0, 1])
        let changed = try XCTUnwrap(TodoMarkdown.toggleTodo(markdown, at: 1))
        XCTAssertTrue(changed.contains("- [x] Last Todo"))
        XCTAssertTrue(changed.contains("- [ ] This belongs to the example"))
    }

    @MainActor
    func testStoredCommentWithEmDashDelimiterRendersAsTable() throws {
        let storedComment = """
        1 | 2  | 3
        — | — | —
        hoge | fuga | piyo
        """
        let expected = [["1", "2", "3"], ["hoge", "fuga", "piyo"]]
        XCTAssertEqual(strings(try table(in: storedComment)), expected)
        XCTAssertEqual(strings(try table(in: storedComment.replacingOccurrences(of: "—", with: "—-"))), expected)
        XCTAssertEqual(strings(try table(in: storedComment.replacingOccurrences(of: "—", with: "--"))), expected)
        XCTAssertEqual(strings(try table(in: "1 | 2 | 3 \n --- | --- | --- \n hoge | fuga | piyo")), expected)
    }

    @MainActor
    func testEmDashConversionIsLimitedToRecognizedTableDelimiters() {
        let markdown = #"""
        — 文章中のダッシュ —

        Only | two
        — | — | —
        not a table

        | A\|B | C |
        | — | — |
        | — | — |

        | Alpha | Beta |
        | --- | --- |
        | —- | — |

        ```md
        1 | 2  | 3
        — | — | —
        hoge | fuga | piyo
        ```
        """#
        let blocks = parseBlocks(markdown)
        let rendered = blocks.compactMap { block -> [[String]]? in
            guard case .table(let table, _, _) = block else { return nil }
            return strings(table)
        }
        XCTAssertEqual(rendered, [
            [["A|B", "C"], ["—", "—"]],
            [["Alpha", "Beta"], ["—-", "—"]],
        ])
        XCTAssertTrue(blocks.contains { block in
            guard case .text(let text) = block else { return false }
            return text.contains("— 文章中のダッシュ —") && text.contains("Only | two\n— | — | —")
        })
        XCTAssertTrue(blocks.contains { block in
            guard case .codeBlock(let language, let code) = block else { return false }
            return language == "md" && code == "1 | 2  | 3\n— | — | —\nhoge | fuga | piyo"
        })
    }

    @MainActor
    func testReferenceTitlesFollowTheSameRulesAsBodyText() throws {
        func link(_ id: Int, type: String = "task", title: String) -> IssueLink {
            IssueLink(
                id: id, sourceIssueId: 1, targetIssueId: id, linkType: .relates, createdAt: "",
                direction: .outgoing, targetIssue: TargetIssue(id: id, type: type, title: title, status: nil)
            )
        }
        let titles = IssueReferenceTitles(links: [
            link(12, title: "A task"), link(13, type: "memo", title: "A | memo"), link(14, title: "  "),
        ])
        let parsed = try table(in: """
        | Ref | Other |
        | --- | --- |
        | [#12](/tasks/12) | **[#13](/memos/13)** |
        | [#14](/tasks/14) [#17](/tasks/17) [#12](/memos/12) | [#99](/tasks/12) [#12 **custom**](/tasks/12) |
        | [#12](https://example.com/tasks/12) | `[#12](/tasks/12)` [`#12`](/tasks/12) |
        """)
        let rows = parsed.rows(issueReferenceTitles: titles)
        XCTAssertEqual(rows.map { row in row.map { String($0.characters) } }, [
            ["Ref", "Other"],
            ["#12: A task", "#13: A | memo"],
            ["#14 #17 #12", "#99 #12 custom"],
            ["#12", "[#12](/tasks/12) #12"],
        ])
        // タイトルまで含めた全体が同じリンクになり、周囲の装飾も引き継ぐ。
        XCTAssertEqual(rows[1][0].runs.map { $0.link?.absoluteString }, ["/tasks/12"])
        XCTAssertEqual(rows[1][1].runs.map { $0.link?.absoluteString }, ["/memos/13"])
        XCTAssertEqual(rows[1][1].runs.map(\.inlinePresentationIntent), [.stronglyEmphasized])
        XCTAssertEqual(strings(parsed)[1], ["#12", "#13"])
    }

    @MainActor
    private func table(in markdown: String) throws -> MarkdownTable {
        let table = parseBlocks(markdown).compactMap { block -> MarkdownTable? in
            guard case .table(let table, _, _) = block else { return nil }
            return table
        }.first
        return try XCTUnwrap(table)
    }

    @MainActor
    private func strings(_ table: MarkdownTable) -> [[String]] {
        table.rows.map { row in row.map { String($0.characters) } }
    }
}

import Foundation
import Markdown

struct MarkdownTablePlacement {
    var quoteDepth = 0
    var listDepth = 0
    var listMarker: String?
    var listMarkerLine: Int?
}

struct MarkdownSourceBlocks {
    private(set) var tables: [Int: (lastLine: Int, table: MarkdownTable, placement: MarkdownTablePlacement)] = [:]
    private(set) var codeBlocks: [Int: (lastLine: Int, language: String, code: String)] = [:]
    private(set) var fencedLines = IndexSet()

    private let collectTables: Bool

    init(markdown: String, lines: [String], collectTables: Bool = true) {
        self.collectTables = collectTables
        let document = Document(parsing: markdown, options: .disableSmartOpts)
        collect(document, lines: lines, placement: MarkdownTablePlacement())
    }

    private mutating func collect(_ node: Markup, lines: [String], placement: MarkdownTablePlacement) {
        switch node {
        case let table as Table:
            guard collectTables, let range = table.range, !table.columnAlignments.isEmpty else { return }
            let firstLine = range.lowerBound.line - 1
            var location = placement
            if location.listMarkerLine != firstLine { location.listMarker = nil }
            tables[firstLine] = (range.upperBound.line - 1, MarkdownTable(table), location)
        case let code as CodeBlock:
            guard let range = code.range else { return }
            let firstLine = range.lowerBound.line - 1
            let lastLine = range.upperBound.line - 1
            guard lines.indices.contains(firstLine), lastLine >= firstLine else { return }
            let source = lines[firstLine].utf8.dropFirst(range.lowerBound.column - 1)
            let opener = String(decoding: source, as: UTF8.self)
            guard opener.hasPrefix("```") || opener.hasPrefix("~~~") else { return }
            fencedLines.insert(integersIn: firstLine...lastLine)
            // 表の抽出とフェンスの範囲は同じ構文木を使い、従来のコード描画を呼ぶ。
            if placement.quoteDepth == 0, placement.listDepth == 0, lines[firstLine].hasPrefix("```") {
                let content = code.code.hasSuffix("\n") ? String(code.code.dropLast()) : code.code
                codeBlocks[firstLine] = (lastLine, code.language ?? "", content)
            }
        case is BlockQuote:
            var location = placement
            location.quoteDepth += 1
            for child in node.children {
                collect(child, lines: lines, placement: location)
            }
        case is UnorderedList, is OrderedList:
            let start = (node as? OrderedList)?.startIndex
            for (index, item) in node.children.enumerated() {
                var location = placement
                location.listDepth += 1
                location.listMarker = start.map { "\($0 + UInt(index))." } ?? "\u{2022}"
                location.listMarkerLine = item.range.map { $0.lowerBound.line - 1 }
                collect(item, lines: lines, placement: location)
            }
        case is Document, is ListItem:
            for child in node.children {
                collect(child, lines: lines, placement: placement)
            }
        default:
            break
        }
    }
}

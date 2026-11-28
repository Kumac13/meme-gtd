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
        let document = collectTables
            ? Self.documentForTables(markdown: markdown, lines: lines)
            : Document(parsing: markdown, options: .disableSmartOpts)
        collect(document, lines: lines, placement: MarkdownTablePlacement())
    }

    private static func documentForTables(markdown: String, lines: [String]) -> Document {
        let candidates = lines.indices.dropFirst().filter { isEmDashDelimiterCandidate(lines[$0]) }
        guard !candidates.isEmpty else { return Document(parsing: markdown, options: .disableSmartOpts) }

        var presentationLines = lines
        for line in candidates {
            // U+2014 は UTF-8 で3バイト。元の行・列範囲を保つ。
            presentationLines[line] = lines[line].replacingOccurrences(of: "—", with: "---")
        }
        let draft = Document(parsing: presentationLines.joined(separator: "\n"), options: .disableSmartOpts)
        var delimiterLines = Set<Int>()
        collectTableDelimiterLines(in: draft, into: &delimiterLines)

        let rejected = candidates.filter { !delimiterLines.contains($0) }
        if rejected.isEmpty { return draft }
        if rejected.count == candidates.count {
            return Document(parsing: markdown, options: .disableSmartOpts)
        }
        // コードや表のデータ行など、区切りと認識されなかった行は原文に戻す。
        for line in rejected {
            presentationLines[line] = lines[line]
        }
        return Document(parsing: presentationLines.joined(separator: "\n"), options: .disableSmartOpts)
    }

    private static func isEmDashDelimiterCandidate(_ line: String) -> Bool {
        guard line.contains("—"), line.contains("|") else { return false }
        // 引用の接頭辞は候補の判定から外し、表の妥当性は Markdown の構文木で確認する。
        let payload = line.drop(while: { $0 == " " || $0 == "\t" || $0 == ">" })
        var cells = payload.split(separator: "|", omittingEmptySubsequences: false)
            .map { $0.trimmingCharacters(in: .whitespaces) }
        if cells.first == "" { cells.removeFirst() }
        if cells.last == "" { cells.removeLast() }
        return cells.count >= 2 && cells.allSatisfy { !$0.isEmpty && $0.allSatisfy { $0 == "—" } }
    }

    private static func collectTableDelimiterLines(in node: Markup, into lines: inout Set<Int>) {
        if let table = node as? Table, let header = table.range?.lowerBound.line {
            // ヘッダーの1ベース行番号は、次行の区切りの0ベース番号と等しい。
            lines.insert(header)
        } else {
            for child in node.children {
                collectTableDelimiterLines(in: child, into: &lines)
            }
        }
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

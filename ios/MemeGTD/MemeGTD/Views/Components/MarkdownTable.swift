import Foundation
import Markdown

struct MarkdownTable {
    let alignments: [Table.ColumnAlignment?]
    let rows: [[AttributedString]]

    init(_ table: Table) {
        alignments = table.columnAlignments
        let header = Array(table.head.cells).map { Self.renderCell($0) }
        let body = table.body.rows.map { row in Array(row.cells).map { Self.renderCell($0) } }
        rows = [header] + body
    }

    private static func renderCell(_ cell: Table.Cell) -> AttributedString {
        // Swift Markdown の拡張では ^ を行結合に使う。GFM と同じセル内容に戻す。
        if cell.rowspan == 0 && cell.isEmpty { return AttributedString("^") }
        var text = AttributedString()
        for child in cell.children {
            text += renderInline(child)
        }
        return text
    }

    private static func renderInline(_ node: Markup) -> AttributedString {
        switch node {
        case let text as Markdown.Text:
            return AttributedString(text.string)
        case let code as InlineCode:
            var text = AttributedString(code.code)
            text.inlinePresentationIntent = .code
            return text
        case is InlineHTML:
            return AttributedString()
        case is LineBreak, is SoftBreak:
            return AttributedString(" ")
        default:
            var text = AttributedString()
            for child in node.children {
                text += renderInline(child)
            }

            switch node {
            case is Strong:
                return addingIntent(.stronglyEmphasized, to: text)
            case is Emphasis:
                return addingIntent(.emphasized, to: text)
            case is Strikethrough:
                return addingIntent(.strikethrough, to: text)
            case let link as Markdown.Link:
                text.link = link.destination.flatMap(URL.init(string:)).flatMap { allowedLink($0) }
                return text
            default:
                return text
            }
        }
    }

    private static func addingIntent(
        _ intent: InlinePresentationIntent, to input: AttributedString
    ) -> AttributedString {
        var text = input
        let runs = Array(text.runs)
        for run in runs {
            text[run.range].inlinePresentationIntent = (run.inlinePresentationIntent ?? []).union(intent)
        }
        return text
    }

    private static func allowedLink(_ url: URL) -> URL? {
        switch url.scheme?.lowercased() {
        case "https", "http":
            return url.host?.isEmpty == false ? url : nil
        case "mailto":
            return url.path.isEmpty ? nil : url
        case nil:
            guard url.host == nil, parseInternalIssueURL(selectableLinkURL(url)) != nil else { return nil }
            return url
        default:
            return nil
        }
    }
}

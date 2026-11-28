import Foundation
import Markdown

struct MarkdownTable {
    let alignments: [Table.ColumnAlignment?]
    private let table: Table

    init(_ table: Table) {
        alignments = table.columnAlignments
        self.table = table
    }

    var rows: [[AttributedString]] { rows(issueReferenceTitles: .init()) }

    /// 番号だけの内部参照リンクには、本文と同じ条件で参照先のタイトルを添える。
    func rows(issueReferenceTitles titles: IssueReferenceTitles) -> [[AttributedString]] {
        let header = Array(table.head.cells).map { Self.renderCell($0, titles) }
        let body = table.body.rows.map { row in Array(row.cells).map { Self.renderCell($0, titles) } }
        return [header] + body
    }

    private static func renderCell(_ cell: Table.Cell, _ titles: IssueReferenceTitles) -> AttributedString {
        // Swift Markdown の拡張では ^ を行結合に使う。GFM と同じセル内容に戻す。
        if cell.rowspan == 0 && cell.isEmpty { return AttributedString("^") }
        var text = AttributedString()
        for child in cell.children {
            text += renderInline(child, titles)
        }
        return text
    }

    private static func renderInline(_ node: Markup, _ titles: IssueReferenceTitles) -> AttributedString {
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
                text += renderInline(child, titles)
            }

            switch node {
            case is Strong:
                return addingIntent(.stronglyEmphasized, to: text)
            case is Emphasis:
                return addingIntent(.emphasized, to: text)
            case is Strikethrough:
                return addingIntent(.strikethrough, to: text)
            case let link as Markdown.Link:
                let url = link.destination.flatMap(URL.init(string:)).flatMap { allowedLink($0) }
                if let url, let title = referenceTitle(for: link, url: url, in: titles) {
                    text += AttributedString(": \(title)")
                }
                text.link = url
                return text
            default:
                return text
            }
        }
    }

    private static func referenceTitle(
        for link: Markdown.Link, url: URL, in titles: IssueReferenceTitles
    ) -> String? {
        // 装飾や独自のリンク名を持つリンクは、書かれた表示のまま残す。
        guard url.scheme == nil, url.host == nil,
              let issue = parseInternalIssueURL(url),
              let digits = url.absoluteString.split(separator: "/").last,
              link.childCount == 1,
              let label = link.child(at: 0) as? Markdown.Text,
              label.string == "#\(digits)" else { return nil }
        return titles[issue.id, issue.type]
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

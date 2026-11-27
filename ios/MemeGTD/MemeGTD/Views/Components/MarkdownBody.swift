import HighlightSwift
import SwiftUI
import UIKit
import WebKit

/// A view that renders markdown text with support for headings, code blocks,
/// blockquotes, lists, tables, inline code, bold, italic, and links.
struct MarkdownBody: View {
    let text: String
    let fontSize: CGFloat
    let color: Color
    let searchQuery: String?
    let onIssueTap: ((Int, String) -> Void)?
    let issueReferenceTitles: IssueReferenceTitles
    let onTodoToggle: ((Int, Bool) -> Void)?

    init(
        _ text: String,
        fontSize: CGFloat = 14,
        color: Color = Color(.label).opacity(0.75),
        searchQuery: String? = nil,
        onIssueTap: ((Int, String) -> Void)? = nil,
        issueReferenceTitles: IssueReferenceTitles = .init(),
        onTodoToggle: ((Int, Bool) -> Void)? = nil
    ) {
        self.text = text
        self.fontSize = fontSize
        self.color = color
        self.searchQuery = searchQuery
        self.onIssueTap = onIssueTap
        self.issueReferenceTitles = issueReferenceTitles
        self.onTodoToggle = onTodoToggle
    }

    private var blocks: [MarkdownBlock] {
        parseBlocks(text)
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            ForEach(Array(blocks.enumerated()), id: \.offset) { _, block in
                renderBlock(block)
            }
        }
        .environment(\.openURL, OpenURLAction { url in
            if let tap = onIssueTap, let parsed = parseInternalIssueURL(url) {
                tap(parsed.id, parsed.type)
                return .handled
            }
            return .systemAction
        })
    }

    // MARK: - Block renderer

    @ViewBuilder
    private func renderBlock(_ block: MarkdownBlock) -> some View {
        switch block {
        case .heading(let level, let content):
            headingView(level: level, content: content)
        case .codeBlock(let lang, let code):
            codeBlockView(language: lang, code: code)
        case .mermaidBlock(let code):
            MermaidContainerView(code: code)
        case .blockquote(let content):
            blockquoteView(content: content)
        case .listItem(let content, let indent):
            listItemView(content: content, indent: indent)
        case .todoItem(let checked, let content, let indent, let todoIndex):
            todoItemView(checked: checked, content: content, indent: indent, todoIndex: todoIndex)
        case .image(let alt, let url):
            imageView(alt: alt, url: url)
        case .table(let table, let placement, let todo):
            tableView(table, placement: placement, todo: todo)
        case .text(let content):
            if !content.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                inlineMarkdownText(content)
            }
        }
    }

    // MARK: - Heading

    private func headingView(level: Int, content: String) -> some View {
        let size: CGFloat
        let weight: UIFont.Weight
        switch level {
        case 1:
            size = fontSize + 6
            weight = .bold
        case 2:
            size = fontSize + 4
            weight = .bold
        case 3:
            size = fontSize + 2
            weight = .semibold
        default:
            size = fontSize + 1
            weight = .semibold
        }

        return inlineMarkdownText(
            content, font: .systemFont(ofSize: size, weight: weight), color: .label, lineSpacing: 0
        )
            .padding(.top, level <= 2 ? 4 : 2)
    }

    // MARK: - Code block

    private func codeBlockView(language: String, code: String) -> some View {
        HighlightedCodeBlockView(language: language, code: code, fontSize: fontSize)
    }

    // MARK: - Image

    private func imageView(alt: String, url: String) -> some View {
        let imageURL = transformAttachmentURL(url)
        return AsyncImage(url: URL(string: imageURL)) { phase in
            switch phase {
            case .success(let image):
                image
                    .resizable()
                    .aspectRatio(contentMode: .fit)
                    .frame(maxWidth: .infinity)
                    .clipShape(RoundedRectangle(cornerRadius: 8))
            case .failure:
                HStack(spacing: 6) {
                    Image(systemName: "photo")
                        .foregroundColor(.textSecondary)
                    Text(alt.isEmpty ? "Image" : alt)
                        .font(.system(size: 12))
                        .foregroundColor(.textSecondary)
                }
                .padding(12)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(Color(.systemGray6))
                .clipShape(RoundedRectangle(cornerRadius: 8))
            case .empty:
                ProgressView()
                    .frame(maxWidth: .infinity)
                    .frame(height: 100)
            @unknown default:
                EmptyView()
            }
        }
        .padding(.vertical, 4)
    }

    private func transformAttachmentURL(_ path: String) -> String {
        // Convert absolute path like /Users/xxx/.mgtd/attachments/uuid.png
        // to API URL like {baseUrl}/api/attachments/uuid.png
        if let range = path.range(of: #"\.mgtd/attachments/([a-zA-Z0-9\-]+\.(png|jpe?g|gif|webp))$"#, options: .regularExpression) {
            let matched = String(path[range])
            let filename = matched.components(separatedBy: "/").last ?? matched
            return "\(Settings.shared.effectiveApiUrl)/api/attachments/\(filename)"
        }
        // If already a URL or unrecognized format, return as-is
        return path
    }

    // MARK: - Table containers

    @ViewBuilder
    private func tableView(
        _ table: MarkdownTable, placement: MarkdownTablePlacement, todo: TodoMarkdown.TodoItem?
    ) -> some View {
        let tableView = MarkdownTableView(table: table, fontSize: fontSize, color: color, searchQuery: searchQuery)
        if placement.listDepth == 0 && placement.quoteDepth == 0 {
            tableView
        } else {
            HStack(alignment: .top, spacing: 6) {
                if let todo, let onTodoToggle {
                    todoButton(checked: todo.checked, index: todo.todoIndex, onToggle: onTodoToggle)
                        .padding(.top, 4)
                } else if let marker = placement.listMarker {
                    Text(todo.map { "\(marker) [\($0.checked ? "x" : " ")]" } ?? marker)
                        .font(.system(size: fontSize))
                        .foregroundColor(color)
                        .padding(.top, 4)
                }
                tableView
            }
            .padding(.leading, CGFloat(placement.listDepth - (placement.listMarker == nil ? 0 : 1)) * 16)
            .modifier(MarkdownQuoteIndent(depth: placement.quoteDepth))
        }
    }

    // MARK: - Blockquote

    private func blockquoteView(content: String) -> some View {
        inlineMarkdownText(content)
            .modifier(MarkdownQuoteIndent(depth: 1))
    }

    // MARK: - List item

    private func listItemView(content: String, indent: Int) -> some View {
        HStack(alignment: .top, spacing: 6) {
            Text("\u{2022}")
                .font(.system(size: fontSize))
                .foregroundColor(color)
            inlineMarkdownText(content)
        }
        .padding(.leading, CGFloat(indent) * 16)
    }

    // MARK: - Todo item

    @ViewBuilder
    private func todoItemView(checked: Bool, content: String, indent: Int, todoIndex: Int) -> some View {
        if let onToggle = onTodoToggle {
            HStack(alignment: .top, spacing: 6) {
                todoButton(checked: checked, index: todoIndex, onToggle: onToggle)
                inlineMarkdownText(content)
            }
            .padding(.leading, CGFloat(indent) * 16)
        } else {
            // Non-interactive context: render the same bullet shape as a regular list item
            HStack(alignment: .top, spacing: 6) {
                Text("\u{2022}")
                    .font(.system(size: fontSize))
                    .foregroundColor(color)
                inlineMarkdownText("[\(checked ? "x" : " ")] \(content)")
            }
            .padding(.leading, CGFloat(indent) * 16)
        }
    }

    private func todoButton(checked: Bool, index: Int, onToggle: @escaping (Int, Bool) -> Void) -> some View {
        Button {
            HapticManager.impact(.light)
            onToggle(index, !checked)
        } label: {
            Image(systemName: checked ? "checkmark.square.fill" : "square")
                .font(.system(size: fontSize + 1))
                .foregroundColor(checked ? .accent : .textSecondary)
        }
        .buttonStyle(.plain)
    }

    // MARK: - Inline markdown text (with accent-colored links)

    private func inlineMarkdownText(
        _ content: String,
        font: UIFont? = nil,
        color: UIColor? = nil,
        lineSpacing: CGFloat = 4
    ) -> some View {
        let parsed = renderInlineMarkdown(content, issueReferenceTitles: issueReferenceTitles)
        return SelectableText(content: renderedMarkdownText(
            parsed,
            font: font ?? .systemFont(ofSize: fontSize),
            color: color ?? UIColor(self.color),
            lineSpacing: lineSpacing,
            searchQuery: searchQuery
        ))
    }
}

private struct MarkdownQuoteIndent: ViewModifier {
    let depth: Int

    func body(content: Content) -> some View {
        if depth == 0 {
            content
        } else {
            content
                .padding(.leading, CGFloat(depth) * 10)
                .overlay(alignment: .leading) {
                    HStack(spacing: 7) {
                        ForEach(0..<depth, id: \.self) { _ in
                            RoundedRectangle(cornerRadius: 1.5)
                                .fill(Color(.systemGray3))
                                .frame(width: 3)
                        }
                    }
                }
                .padding(.vertical, 2)
        }
    }
}

func renderedMarkdownText(
    _ parsed: AttributedString,
    font baseFont: UIFont,
    color baseColor: UIColor,
    lineSpacing: CGFloat = 4,
    alignment: NSTextAlignment = .natural,
    searchQuery: String?
) -> NSAttributedString {
    let paragraph = NSMutableParagraphStyle()
    paragraph.lineSpacing = lineSpacing
    paragraph.alignment = alignment
    let rendered = NSMutableAttributedString()
    for run in parsed.runs {
        let intent = run.inlinePresentationIntent ?? []
        let runFont = intent.contains(.code)
            ? UIFont.monospacedSystemFont(ofSize: baseFont.pointSize, weight: .regular)
            : baseFont
        var traits = runFont.fontDescriptor.symbolicTraits
        if intent.contains(.stronglyEmphasized) { traits.insert(.traitBold) }
        if intent.contains(.emphasized) { traits.insert(.traitItalic) }
        let descriptor = runFont.fontDescriptor.withSymbolicTraits(traits) ?? runFont.fontDescriptor
        var attributes: [NSAttributedString.Key: Any] = [
            .font: UIFont(descriptor: descriptor, size: runFont.pointSize),
            .foregroundColor: baseColor,
            .paragraphStyle: paragraph,
        ]
        if intent.contains(.strikethrough) {
            attributes[.strikethroughStyle] = NSUnderlineStyle.single.rawValue
        }
        if let url = run.link {
            attributes[.link] = selectableLinkURL(url)
        }
        rendered.append(NSAttributedString(string: String(parsed[run.range].characters), attributes: attributes))
    }

    if let query = searchQuery, !query.isEmpty {
        let plainText = rendered.string
        var searchStart = plainText.startIndex
        while let range = plainText.range(of: query, options: .caseInsensitive, range: searchStart..<plainText.endIndex) {
            rendered.addAttributes([
                .foregroundColor: UIColor(Color.accentDarker),
                .font: UIFont.systemFont(ofSize: baseFont.pointSize, weight: .semibold),
            ], range: NSRange(range, in: plainText))
            searchStart = range.upperBound
        }
    }
    return rendered
}

func selectableLinkURL(_ url: URL) -> URL {
    // 相対リンクも既存のアプリ内ルーティングに渡す。
    guard url.scheme == nil, !url.path.isEmpty else { return url }
    var components = URLComponents()
    components.scheme = "memegtd-internal"
    components.host = "internal"
    components.path = url.path.hasPrefix("/") ? url.path : "/\(url.path)"
    return components.url ?? url
}

func renderInlineMarkdown(
    _ markdown: String,
    issueReferenceTitles: IssueReferenceTitles = .init()
) -> AttributedString {
    let parsed = (try? AttributedString(
        markdown: markdown,
        options: .init(
            interpretedSyntax: .inlineOnlyPreservingWhitespace,
            appliesSourcePositionAttributes: !issueReferenceTitles.isEmpty
        )
    )) ?? AttributedString(markdown)
    if issueReferenceTitles.isEmpty { return parsed }

    let source = Array(markdown.utf8)
    let lineStarts = [0] + source.indices.compactMap { source[$0] == 10 ? $0 + 1 : nil }
    var result = AttributedString()
    for run in parsed.runs {
        result.append(AttributedString(parsed[run.range]))
        guard let url = run.link, url.scheme == nil, url.host == nil,
              let issue = parseInternalIssueURL(url),
              let title = issueReferenceTitles[issue.id, issue.type],
              !(run.inlinePresentationIntent ?? []).contains(.code),
              let digits = url.absoluteString.split(separator: "/").last,
              String(parsed[run.range].characters) == "#\(digits)",
              let position = run.markdownSourcePosition,
              position.startLine == position.endLine,
              lineStarts.indices.contains(position.startLine - 1) else { continue }

        // 装飾付きの独自リンク名の一部が番号と一致する場合を除く。
        let lineStart = lineStarts[position.startLine - 1]
        let openingBracket = lineStart + position.startColumn - 2
        let closingBracket = lineStart + position.endColumn
        guard source.indices.contains(openingBracket), source.indices.contains(closingBracket),
              source[openingBracket] == 91, source[closingBracket] == 93 else { continue }
        // 同じリンク属性のまま表示の文字列を追加する。
        result.append(AttributedString(": \(title)", attributes: run.attributes))
    }
    return result
}

// MARK: - Internal issue URL parser

func parseInternalIssueURL(_ url: URL) -> (id: Int, type: String)? {
    // Accept three forms:
    //   1. relative path-only (`/tasks/63`) from raw AttributedString
    //   2. our promoted custom scheme (`memegtd-internal://internal/tasks/63`)
    //   3. fully absolute URLs that happen to match the internal path shape
    let path: String
    if url.scheme == "memegtd-internal" {
        path = url.path
    } else if url.scheme == nil, url.host == nil {
        path = url.absoluteString
    } else {
        path = url.path
    }
    let pattern = #"^/(memos|tasks|articles)/(\d+)$"#
    guard let regex = try? NSRegularExpression(pattern: pattern) else { return nil }
    let range = NSRange(path.startIndex..<path.endIndex, in: path)
    guard let match = regex.firstMatch(in: path, range: range), match.numberOfRanges == 3 else {
        return nil
    }
    guard
        let slugRange = Range(match.range(at: 1), in: path),
        let idRange = Range(match.range(at: 2), in: path),
        let id = Int(path[idRange])
    else { return nil }
    let slug = String(path[slugRange])
    let type: String
    switch slug {
    case "memos": type = "memo"
    case "tasks": type = "task"
    case "articles": type = "article"
    default: return nil
    }
    return (id, type)
}

// MARK: - Markdown parser

enum MarkdownBlock {
    case text(String)
    case table(MarkdownTable, placement: MarkdownTablePlacement, todo: TodoMarkdown.TodoItem?)
    case heading(level: Int, content: String)
    case codeBlock(language: String, code: String)
    case mermaidBlock(code: String)
    case blockquote(String)
    case listItem(content: String, indent: Int)
    case todoItem(checked: Bool, content: String, indent: Int, todoIndex: Int)
    case image(alt: String, url: String)
}

func parseBlocks(_ source: String) -> [MarkdownBlock] {
    var blocks: [MarkdownBlock] = []
    let markdown = source.replacingOccurrences(of: "\r\n", with: "\n")
        .replacingOccurrences(of: "\r", with: "\n")
    let lines = markdown.components(separatedBy: "\n")
    let sourceBlocks = MarkdownSourceBlocks(markdown: markdown, lines: lines)
    let todos = Dictionary(uniqueKeysWithValues: TodoMarkdown
        .enumerateTodos(lines: lines, excluding: sourceBlocks.fencedLines)
        .map { ($0.lineIndex, $0) })
    var lastParsedLine = -1
    var currentText = ""
    var quoteLines: [String] = []

    func flushText() {
        if !currentText.isEmpty {
            blocks.append(.text(currentText))
            currentText = ""
        }
    }

    func flushQuote() {
        if !quoteLines.isEmpty {
            blocks.append(.blockquote(quoteLines.joined(separator: "\n")))
            quoteLines = []
        }
    }

    for (lineIndex, line) in lines.enumerated() {
        if lineIndex <= lastParsedLine { continue }
        if let table = sourceBlocks.tables[lineIndex] {
            flushText()
            flushQuote()
            blocks.append(.table(table.table, placement: table.placement, todo: todos[lineIndex]))
            lastParsedLine = table.lastLine
            continue
        }

        if let code = sourceBlocks.codeBlocks[lineIndex] {
            flushText()
            flushQuote()
            if code.language.lowercased() == "mermaid" {
                blocks.append(.mermaidBlock(code: code.code))
            } else {
                blocks.append(.codeBlock(language: code.language, code: code.code))
            }
            lastParsedLine = code.lastLine
            continue
        }

        // Image (![alt](url))
        if let match = line.range(of: #"^!\[([^\]]*)\]\(([^)]+)\)$"#, options: .regularExpression) {
            flushText()
            flushQuote()
            let fullMatch = String(line[match])
            let altRange = fullMatch.range(of: #"\[([^\]]*)\]"#, options: .regularExpression)!
            let urlRange = fullMatch.range(of: #"\(([^)]+)\)"#, options: .regularExpression)!
            let alt = String(fullMatch[altRange].dropFirst().dropLast())
            let url = String(fullMatch[urlRange].dropFirst().dropLast())
            blocks.append(.image(alt: alt, url: url))
            continue
        }

        // Heading (# ## ### ####)
        if let match = line.range(of: #"^(#{1,4})\s+(.+)$"#, options: .regularExpression) {
            flushText()
            flushQuote()
            let fullMatch = String(line[match])
            let hashCount = fullMatch.prefix(while: { $0 == "#" }).count
            let content = String(fullMatch.drop(while: { $0 == "#" }).dropFirst()) // drop space
            blocks.append(.heading(level: hashCount, content: content))
            continue
        }

        // Blockquote
        if line.hasPrefix("> ") || line == ">" {
            flushText()
            let content = line.hasPrefix("> ") ? String(line.dropFirst(2)) : ""
            quoteLines.append(content)
            continue
        }

        // Todo item (- [ ] / - [x]) — must be checked BEFORE plain list item
        if let todo = todos[lineIndex], !todo.content.isEmpty {
            flushText()
            flushQuote()
            blocks.append(.todoItem(
                checked: todo.checked, content: todo.content, indent: todo.indent / 2, todoIndex: todo.todoIndex
            ))
            continue
        }

        // List item (- or * with optional indentation)
        if let match = line.range(of: #"^(\s*)[*\-]\s+(.+)$"#, options: .regularExpression) {
            flushText()
            flushQuote()
            let fullMatch = String(line[match])
            let leadingSpaces = fullMatch.prefix(while: { $0 == " " || $0 == "\t" }).count
            let indent = leadingSpaces / 2
            // Extract content after the bullet marker
            let trimmed = fullMatch.drop(while: { $0 == " " || $0 == "\t" })
            let content: String
            if trimmed.hasPrefix("- ") {
                content = String(trimmed.dropFirst(2))
            } else if trimmed.hasPrefix("* ") {
                content = String(trimmed.dropFirst(2))
            } else {
                content = String(trimmed)
            }
            blocks.append(.listItem(content: content, indent: indent))
            continue
        }

        // Regular text
        flushQuote()
        if !currentText.isEmpty { currentText += "\n" }
        currentText += line
    }

    flushQuote()
    flushText()

    return blocks
}

// MARK: - Highlighted code block

private struct HighlightedCodeBlockView: View {
    let language: String
    let code: String
    let fontSize: CGFloat

    /// Atom One Dark background (#282c34) — matches Web UI's oneDark theme
    private static let darkBg = Color(red: 0x28/255.0, green: 0x2c/255.0, blue: 0x34/255.0)

    @State private var highlightedCode: AttributedString?

    private var resolvedLanguage: String {
        let aliases: [String: String] = [
            "js": "javascript", "ts": "typescript",
            "py": "python", "sh": "bash", "shell": "bash",
            "md": "markdown",
        ]
        let lang = language.lowercased()
        return aliases[lang] ?? lang
    }

    private var renderedCode: NSAttributedString {
        let font = UIFont.monospacedSystemFont(ofSize: fontSize - 1, weight: .regular)
        let fallbackColor = UIColor.white.withAlphaComponent(0.85)
        var highlighted = highlightedCode ?? AttributedString(code)
        for run in highlighted.runs {
            let range = run.range
            highlighted[range].uiKit.font = run.uiKit.font?.withSize(font.pointSize) ?? font
            if run.uiKit.foregroundColor == nil {
                highlighted[range].uiKit.foregroundColor = fallbackColor
            }
        }
        return NSAttributedString(highlighted)
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            if !language.isEmpty {
                Text(language)
                    .font(.system(size: fontSize - 3, weight: .medium, design: .monospaced))
                    .foregroundColor(.white.opacity(0.5))
                    .padding(.horizontal, 10)
                    .padding(.top, 8)
                    .padding(.bottom, 4)
            }

            SelectableText(content: renderedCode)
                .padding(.horizontal, 10)
                .padding(.vertical, language.isEmpty ? 8 : 4)
                .padding(.bottom, language.isEmpty ? 0 : 4)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Self.darkBg)
        .cornerRadius(8)
        .task(id: code) {
            highlightedCode = nil
            guard !language.isEmpty else { return }
            let result = try? await Highlight()
                .attributedText(code, language: resolvedLanguage, colors: .dark(.atomOne))
            if !_Concurrency.Task.isCancelled { highlightedCode = result }
        }
    }
}

// MARK: - Mermaid diagram renderer

private struct MermaidView: UIViewRepresentable {
    let code: String
    let onHeightChange: (CGFloat) -> Void

    func makeUIView(context: Context) -> WKWebView {
        let config = WKWebViewConfiguration()
        let handler = context.coordinator
        config.userContentController.add(handler, name: "heightChanged")
        let webView = WKWebView(frame: .zero, configuration: config)
        webView.isOpaque = false
        webView.backgroundColor = .clear
        webView.scrollView.isScrollEnabled = false
        webView.navigationDelegate = handler
        return webView
    }

    func updateUIView(_ webView: WKWebView, context: Context) {
        guard !context.coordinator.hasLoaded else { return }
        context.coordinator.hasLoaded = true

        let escapedCode = code
            .replacingOccurrences(of: "\\", with: "\\\\")
            .replacingOccurrences(of: "`", with: "\\`")
            .replacingOccurrences(of: "$", with: "\\$")

        let html = """
        <!DOCTYPE html>
        <html>
        <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0">
        <style>
            body { margin: 0; padding: 8px; background: transparent; display: flex; justify-content: center; }
            .mermaid { font-size: 14px; }
            .mermaid svg { max-width: 100%; height: auto; }
        </style>
        <script type="module">
            import mermaid from 'https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.esm.min.mjs';
            mermaid.initialize({ startOnLoad: false, theme: 'neutral' });
            const element = document.querySelector('.mermaid');
            try {
                const { svg } = await mermaid.render('diagram', `\(escapedCode)`);
                element.innerHTML = svg;
            } catch (e) {
                element.innerHTML = '<pre style="color:red">' + e.message + '</pre>';
            }
            const height = document.body.scrollHeight;
            window.webkit.messageHandlers.heightChanged.postMessage(height);
        </script>
        </head>
        <body>
        <div class="mermaid"></div>
        </body>
        </html>
        """

        webView.loadHTMLString(html, baseURL: nil)
    }

    func makeCoordinator() -> Coordinator {
        Coordinator(onHeightChange: onHeightChange)
    }

    class Coordinator: NSObject, WKNavigationDelegate, WKScriptMessageHandler {
        var hasLoaded = false
        let onHeightChange: (CGFloat) -> Void

        init(onHeightChange: @escaping (CGFloat) -> Void) {
            self.onHeightChange = onHeightChange
        }

        func userContentController(
            _ userContentController: WKUserContentController,
            didReceive message: WKScriptMessage
        ) {
            if let height = message.body as? CGFloat, height > 0 {
                DispatchQueue.main.async {
                    self.onHeightChange(height)
                }
            }
        }

        func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
            webView.evaluateJavaScript("document.body.scrollHeight") { result, _ in
                if let height = result as? CGFloat, height > 0 {
                    DispatchQueue.main.async {
                        self.onHeightChange(height)
                    }
                }
            }
        }
    }
}

private struct MermaidContainerView: View {
    let code: String
    @State private var height: CGFloat = 200

    var body: some View {
        MermaidView(code: code) { newHeight in
            height = newHeight
        }
        .frame(height: height)
        .frame(maxWidth: .infinity)
        .background(Color(.systemGray6))
        .cornerRadius(8)
    }
}

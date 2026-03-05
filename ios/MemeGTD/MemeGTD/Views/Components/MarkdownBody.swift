import SwiftUI
import WebKit

/// A view that renders markdown text with support for headings, code blocks,
/// blockquotes, lists, inline code, bold, italic, and links.
struct MarkdownBody: View {
    let text: String
    let fontSize: CGFloat
    let color: Color

    init(_ text: String, fontSize: CGFloat = 14, color: Color = Color(.label).opacity(0.75)) {
        self.text = text
        self.fontSize = fontSize
        self.color = color
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
            MermaidView(code: code)
        case .blockquote(let content):
            blockquoteView(content: content)
        case .listItem(let content, let indent):
            listItemView(content: content, indent: indent)
        case .text(let content):
            if !content.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                inlineMarkdownText(content)
            }
        }
    }

    // MARK: - Heading

    private func headingView(level: Int, content: String) -> some View {
        let size: CGFloat
        let weight: Font.Weight
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

        return inlineAttributedText(content)
            .font(.system(size: size, weight: weight))
            .foregroundColor(Color(.label))
            .padding(.top, level <= 2 ? 4 : 2)
    }

    // MARK: - Code block

    private func codeBlockView(language: String, code: String) -> some View {
        VStack(alignment: .leading, spacing: 0) {
            if !language.isEmpty {
                Text(language)
                    .font(.system(size: fontSize - 3, weight: .medium, design: .monospaced))
                    .foregroundColor(Color(.systemGray))
                    .padding(.horizontal, 10)
                    .padding(.top, 8)
                    .padding(.bottom, 4)
            }

            Text(code)
                .font(.system(size: fontSize - 1, design: .monospaced))
                .foregroundColor(Color(.label).opacity(0.85))
                .padding(.horizontal, 10)
                .padding(.vertical, language.isEmpty ? 8 : 4)
                .padding(.bottom, language.isEmpty ? 0 : 4)
                .textSelection(.enabled)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color(.systemGray6))
        .cornerRadius(8)
    }

    // MARK: - Blockquote

    private func blockquoteView(content: String) -> some View {
        HStack(spacing: 0) {
            RoundedRectangle(cornerRadius: 1.5)
                .fill(Color(.systemGray3))
                .frame(width: 3)

            VStack(alignment: .leading, spacing: 2) {
                let lines = content.components(separatedBy: "\n")
                ForEach(Array(lines.enumerated()), id: \.offset) { _, line in
                    if !line.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                        inlineMarkdownText(line)
                    }
                }
            }
            .padding(.leading, 10)
        }
        .padding(.vertical, 2)
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

    // MARK: - Inline markdown text (with accent-colored links)

    private func inlineMarkdownText(_ content: String) -> some View {
        inlineAttributedText(content)
            .font(.system(size: fontSize))
            .lineSpacing(4)
            .foregroundColor(color)
            .multilineTextAlignment(.leading)
    }

    private func inlineAttributedText(_ content: String) -> Text {
        if var attributed = try? AttributedString(
            markdown: content,
            options: .init(interpretedSyntax: .inlineOnlyPreservingWhitespace)
        ) {
            // Recolor links to accent
            for run in attributed.runs {
                if run.link != nil {
                    let range = run.range
                    attributed[range].foregroundColor = UIColor(red: 0x2d/255.0, green: 0xa4/255.0, blue: 0x4e/255.0, alpha: 1.0)
                    attributed[range].underlineStyle = .single
                }
            }
            return Text(attributed)
        } else {
            return Text(content)
        }
    }
}

// MARK: - Markdown parser

private enum MarkdownBlock {
    case text(String)
    case heading(level: Int, content: String)
    case codeBlock(language: String, code: String)
    case mermaidBlock(code: String)
    case blockquote(String)
    case listItem(content: String, indent: Int)
}

private func parseBlocks(_ markdown: String) -> [MarkdownBlock] {
    var blocks: [MarkdownBlock] = []
    let lines = markdown.components(separatedBy: "\n")
    var currentText = ""
    var inCodeBlock = false
    var codeLanguage = ""
    var codeContent = ""
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

    for line in lines {
        // Code block fence
        if !inCodeBlock && line.hasPrefix("```") {
            flushText()
            flushQuote()
            inCodeBlock = true
            codeLanguage = String(line.dropFirst(3)).trimmingCharacters(in: .whitespaces)
            codeContent = ""
            continue
        }
        if inCodeBlock && line.hasPrefix("```") {
            if codeContent.hasSuffix("\n") {
                codeContent = String(codeContent.dropLast())
            }
            if codeLanguage.lowercased() == "mermaid" {
                blocks.append(.mermaidBlock(code: codeContent))
            } else {
                blocks.append(.codeBlock(language: codeLanguage, code: codeContent))
            }
            inCodeBlock = false
            codeLanguage = ""
            codeContent = ""
            continue
        }
        if inCodeBlock {
            if !codeContent.isEmpty { codeContent += "\n" }
            codeContent += line
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

    // Handle unclosed code block
    if inCodeBlock && !codeContent.isEmpty {
        if codeLanguage.lowercased() == "mermaid" {
            blocks.append(.mermaidBlock(code: codeContent))
        } else {
            blocks.append(.codeBlock(language: codeLanguage, code: codeContent))
        }
    }

    flushQuote()
    flushText()

    return blocks
}

// MARK: - Mermaid diagram renderer

private struct MermaidView: UIViewRepresentable {
    let code: String

    func makeUIView(context: Context) -> WKWebView {
        let config = WKWebViewConfiguration()
        let webView = WKWebView(frame: .zero, configuration: config)
        webView.isOpaque = false
        webView.backgroundColor = .clear
        webView.scrollView.isScrollEnabled = false
        webView.navigationDelegate = context.coordinator
        return webView
    }

    func updateUIView(_ webView: WKWebView, context: Context) {
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
            const { svg } = await mermaid.render('diagram', `\(escapedCode)`);
            element.innerHTML = svg;
            // Notify native side of content height
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
        Coordinator()
    }

    class Coordinator: NSObject, WKNavigationDelegate {
        func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
            webView.evaluateJavaScript("document.body.scrollHeight") { result, _ in
                if let height = result as? CGFloat, height > 0 {
                    webView.invalidateIntrinsicContentSize()
                }
            }
        }
    }
}

private struct MermaidContainerView: View {
    let code: String
    @State private var height: CGFloat = 200

    var body: some View {
        MermaidView(code: code)
            .frame(height: height)
            .frame(maxWidth: .infinity)
            .background(Color(.systemGray6))
            .cornerRadius(8)
    }
}

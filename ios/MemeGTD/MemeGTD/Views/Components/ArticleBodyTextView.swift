import SwiftUI
import UIKit

extension NSAttributedString.Key {
    /// Marks characters covered by a highlight (value: Int highlight id).
    static let mgtdHighlightId = NSAttributedString.Key("mgtdHighlightId")
    /// Marks a trailing comment-icon glyph (value: Int highlight id).
    static let mgtdHighlightIcon = NSAttributedString.Key("mgtdHighlightIcon")
    /// Carries an image URL on a placeholder attachment for async loading.
    static let mgtdImageURL = NSAttributedString.Key("mgtdImageURL")
}

/// Renders a whole article body as one selectable `NSAttributedString`. Because
/// the entire body is a single text view, selection works across every block
/// (paragraphs, headings, lists) and highlights can be anchored anywhere.
enum ArticleBodyRenderer {
    static func makeAttributed(
        markdown: String,
        fontSize: CGFloat,
        textColor: UIColor,
        highlights: [Highlight],
        commentedHighlightIds: Set<Int>
    ) -> NSMutableAttributedString {
        let result = NSMutableAttributedString()
        let blocks = parseBlocks(markdown)

        for (index, block) in blocks.enumerated() {
            if index > 0 { result.append(NSAttributedString(string: "\n\n")) }
            result.append(attributed(for: block, fontSize: fontSize, textColor: textColor))
        }

        applyHighlights(to: result, highlights: highlights, commentedHighlightIds: commentedHighlightIds, fontSize: fontSize)
        return result
    }

    // MARK: - Per-block attributed text

    private static func attributed(for block: MarkdownBlock, fontSize: CGFloat, textColor: UIColor) -> NSAttributedString {
        switch block {
        case .heading(let level, let content):
            let (size, weight): (CGFloat, UIFont.Weight)
            switch level {
            case 1: (size, weight) = (fontSize + 6, .bold)
            case 2: (size, weight) = (fontSize + 4, .bold)
            case 3: (size, weight) = (fontSize + 2, .semibold)
            default: (size, weight) = (fontSize + 1, .semibold)
            }
            return makeInlineAttributed(content, font: .systemFont(ofSize: size, weight: weight), textColor: .label)

        case .text(let content):
            return makeInlineAttributed(content, font: .systemFont(ofSize: fontSize), textColor: textColor)

        case .listItem(let content, let indent):
            let para = NSMutableParagraphStyle()
            let base = CGFloat(indent) * 16
            para.firstLineHeadIndent = base
            para.headIndent = base + 16
            para.paragraphSpacing = 2
            let line = NSMutableAttributedString(
                string: "•  ",
                attributes: [.font: UIFont.systemFont(ofSize: fontSize), .foregroundColor: textColor]
            )
            line.append(makeInlineAttributed(content, font: .systemFont(ofSize: fontSize), textColor: textColor))
            line.addAttribute(.paragraphStyle, value: para, range: NSRange(location: 0, length: line.length))
            return line

        case .todoItem(let checked, let content, let indent, _):
            let para = NSMutableParagraphStyle()
            let base = CGFloat(indent) * 16
            para.firstLineHeadIndent = base
            para.headIndent = base + 16
            let box = checked ? "\u{2611}\u{FE0E}  " : "\u{2610}  "
            let line = NSMutableAttributedString(
                string: box,
                attributes: [.font: UIFont.systemFont(ofSize: fontSize), .foregroundColor: textColor]
            )
            line.append(makeInlineAttributed(content, font: .systemFont(ofSize: fontSize), textColor: textColor))
            line.addAttribute(.paragraphStyle, value: para, range: NSRange(location: 0, length: line.length))
            return line

        case .blockquote(let content):
            let para = NSMutableParagraphStyle()
            para.firstLineHeadIndent = 12
            para.headIndent = 12
            let text = content.components(separatedBy: "\n")
                .filter { !$0.trimmingCharacters(in: .whitespaces).isEmpty }
                .joined(separator: "\n")
            let a = makeInlineAttributed(text, font: .systemFont(ofSize: fontSize), textColor: .secondaryLabel)
            a.addAttribute(.paragraphStyle, value: para, range: NSRange(location: 0, length: a.length))
            return a

        case .codeBlock(_, let code):
            return codeAttributed(code, fontSize: fontSize)

        case .mermaidBlock(let code):
            // Mermaid (essentially absent in extracted web articles) degrades to
            // a code block rather than a rendered diagram.
            return codeAttributed(code, fontSize: fontSize)

        case .image(_, let url):
            // Placeholder attachment; the view's coordinator loads it async.
            let attachment = NSTextAttachment()
            attachment.image = placeholderImage()
            let a = NSMutableAttributedString(attachment: attachment)
            a.addAttribute(.mgtdImageURL, value: url, range: NSRange(location: 0, length: a.length))
            return a
        }
    }

    private static func codeAttributed(_ code: String, fontSize: CGFloat) -> NSAttributedString {
        let para = NSMutableParagraphStyle()
        para.firstLineHeadIndent = 8
        para.headIndent = 8
        para.paragraphSpacingBefore = 4
        para.paragraphSpacing = 4
        return NSAttributedString(string: code, attributes: [
            .font: UIFont.monospacedSystemFont(ofSize: fontSize - 1, weight: .regular),
            .foregroundColor: UIColor.label,
            .backgroundColor: UIColor.secondarySystemBackground,
            .paragraphStyle: para,
        ])
    }

    private static func placeholderImage() -> UIImage {
        let size = CGSize(width: 40, height: 40)
        return UIGraphicsImageRenderer(size: size).image { ctx in
            UIColor.secondarySystemBackground.setFill()
            ctx.fill(CGRect(origin: .zero, size: size))
        }
    }

    // MARK: - Highlights + comment icons

    private static func applyHighlights(
        to result: NSMutableAttributedString,
        highlights: [Highlight],
        commentedHighlightIds: Set<Int>,
        fontSize: CGFloat
    ) {
        let full = result.string as NSString
        let bg = UIColor(Color.highlightBackground)

        // Locate all highlights first (before inserting any icons shifts offsets).
        var located: [(range: NSRange, id: Int)] = []
        for highlight in highlights {
            let quote = QuoteSelector(exact: highlight.exact, prefix: highlight.prefix, suffix: highlight.suffix)
            if let range = HighlightAnchor.locate(quote, in: full) {
                located.append((range, highlight.id))
            }
        }

        for item in located {
            result.addAttribute(.backgroundColor, value: bg, range: item.range)
            result.addAttribute(.mgtdHighlightId, value: item.id, range: item.range)
        }

        // Insert comment icons after their highlight, from the last position
        // backward so earlier ranges stay valid.
        let iconInserts = located
            .filter { commentedHighlightIds.contains($0.id) }
            .sorted { $0.range.location + $0.range.length > $1.range.location + $1.range.length }
        for item in iconInserts {
            let icon = commentIconAttachment(fontSize: fontSize, id: item.id)
            result.insert(icon, at: item.range.location + item.range.length)
        }
    }

    private static func commentIconAttachment(fontSize: CGFloat, id: Int) -> NSAttributedString {
        let config = UIImage.SymbolConfiguration(pointSize: fontSize - 2, weight: .semibold)
        let image = UIImage(systemName: "text.bubble.fill", withConfiguration: config)?
            .withTintColor(UIColor(Color.accent), renderingMode: .alwaysOriginal)
        let attachment = NSTextAttachment()
        attachment.image = image
        let a = NSMutableAttributedString(string: "\u{FEFF}")  // zero-width joiner spacer
        a.append(NSAttributedString(attachment: attachment))
        a.addAttribute(.mgtdHighlightIcon, value: id, range: NSRange(location: 0, length: a.length))
        return a
    }
}

/// Build inline-markdown attributed text with accent-colored links; internal
/// path-only links are promoted to a custom scheme for tap routing.
func makeInlineAttributed(_ content: String, font: UIFont, textColor: UIColor) -> NSMutableAttributedString {
    let baseAttributes: [NSAttributedString.Key: Any] = [.font: font, .foregroundColor: textColor]
    guard let attributed = try? AttributedString(
        markdown: content,
        options: .init(interpretedSyntax: .inlineOnlyPreservingWhitespace)
    ) else {
        return NSMutableAttributedString(string: content, attributes: baseAttributes)
    }

    let ns = NSMutableAttributedString(attributedString: NSAttributedString(attributed))
    let fullRange = NSRange(location: 0, length: ns.length)
    // Base font + color everywhere; the markdown conversion carries formatting
    // as inlinePresentationIntent (not UIFont), applied next.
    ns.addAttribute(.font, value: font, range: fullRange)
    ns.addAttribute(.foregroundColor, value: textColor, range: fullRange)

    ns.enumerateAttribute(.inlinePresentationIntent, in: fullRange) { value, range, _ in
        guard let raw = value as? Int else { return }
        let intent = InlinePresentationIntent(rawValue: UInt(raw))
        if intent.contains(.code) {
            ns.addAttribute(.font, value: UIFont.monospacedSystemFont(ofSize: font.pointSize - 1, weight: .regular), range: range)
            return
        }
        var traits: UIFontDescriptor.SymbolicTraits = []
        if intent.contains(.stronglyEmphasized) { traits.insert(.traitBold) }
        if intent.contains(.emphasized) { traits.insert(.traitItalic) }
        if !traits.isEmpty,
           let descriptor = font.fontDescriptor.withSymbolicTraits(traits) {
            ns.addAttribute(.font, value: UIFont(descriptor: descriptor, size: font.pointSize), range: range)
        }
    }

    let accent = UIColor(Color.accent)
    ns.enumerateAttribute(.link, in: fullRange) { value, range, _ in
        guard let url = value as? URL else { return }
        ns.addAttribute(.foregroundColor, value: accent, range: range)
        ns.addAttribute(.underlineStyle, value: NSUnderlineStyle.single.rawValue, range: range)
        if url.scheme == nil, !url.path.isEmpty {
            var components = URLComponents()
            components.scheme = "memegtd-internal"
            components.host = "internal"
            components.path = url.path.hasPrefix("/") ? url.path : "/\(url.path)"
            if let promoted = components.url {
                ns.addAttribute(.link, value: promoted, range: range)
            }
        }
    }
    return ns
}

/// The whole article body in one non-editable, selectable `UITextView` with a
/// native "Highlight" edit-menu action, cross-block highlight rendering, comment
/// icons, and tap routing.
struct ArticleBodyTextView: UIViewRepresentable {
    let markdown: String
    let fontSize: CGFloat
    let textColor: UIColor
    let highlights: [Highlight]
    let commentedHighlightIds: Set<Int>
    let onCreate: (QuoteSelector) -> Void
    let onTapHighlight: (Int) -> Void
    let onIssueTap: ((Int, String) -> Void)?

    func makeCoordinator() -> Coordinator { Coordinator(self) }

    func makeUIView(context: Context) -> UITextView {
        let tv = UITextView()
        tv.isEditable = false
        tv.isSelectable = true
        tv.isScrollEnabled = false
        tv.backgroundColor = .clear
        tv.textContainerInset = .zero
        tv.textContainer.lineFragmentPadding = 0
        tv.adjustsFontForContentSizeCategory = true
        tv.delegate = context.coordinator

        let tap = UITapGestureRecognizer(target: context.coordinator, action: #selector(Coordinator.handleTap(_:)))
        tap.delegate = context.coordinator
        tv.addGestureRecognizer(tap)

        context.coordinator.textView = tv
        context.coordinator.render()
        return tv
    }

    func updateUIView(_ uiView: UITextView, context: Context) {
        context.coordinator.parent = self
        context.coordinator.render()
    }

    func sizeThatFits(_ proposal: ProposedViewSize, uiView: UITextView, context: Context) -> CGSize? {
        let width = proposal.width ?? uiView.bounds.width
        guard width > 0 else { return nil }
        let fitted = uiView.sizeThatFits(CGSize(width: width, height: .greatestFiniteMagnitude))
        return CGSize(width: width, height: ceil(fitted.height))
    }

    final class Coordinator: NSObject, UITextViewDelegate, UIGestureRecognizerDelegate {
        var parent: ArticleBodyTextView
        weak var textView: UITextView?
        private var imageCache: [String: UIImage] = [:]
        private var renderedKey: String = ""

        init(_ parent: ArticleBodyTextView) { self.parent = parent }

        private var currentKey: String {
            "\(parent.markdown.hashValue)|\(parent.highlights.map { "\($0.id):\($0.exact.hashValue)" }.joined(separator: ","))|\(parent.commentedHighlightIds.sorted().map(String.init).joined(separator: ","))"
        }

        func render() {
            guard let tv = textView else { return }
            let key = currentKey
            // Avoid rebuilding (and losing an in-progress selection) when nothing changed.
            if key == renderedKey, tv.attributedText.length > 0 { return }
            renderedKey = key

            let attributed = ArticleBodyRenderer.makeAttributed(
                markdown: parent.markdown,
                fontSize: parent.fontSize,
                textColor: parent.textColor,
                highlights: parent.highlights,
                commentedHighlightIds: parent.commentedHighlightIds
            )
            applyLoadedImages(to: attributed)
            tv.attributedText = attributed
            tv.invalidateIntrinsicContentSize()
            loadPendingImages(in: attributed)
        }

        // MARK: - Async images

        private func applyLoadedImages(to attributed: NSMutableAttributedString) {
            let full = NSRange(location: 0, length: attributed.length)
            attributed.enumerateAttribute(.mgtdImageURL, in: full) { value, range, _ in
                guard let urlString = value as? String, let image = imageCache[urlString] else { return }
                let attachment = NSTextAttachment()
                attachment.image = image
                let width = min(image.size.width, (textView?.bounds.width ?? 320))
                let scale = width / max(image.size.width, 1)
                attachment.bounds = CGRect(x: 0, y: 0, width: width, height: image.size.height * scale)
                attributed.replaceCharacters(in: range, with: NSAttributedString(attachment: attachment))
            }
        }

        private func loadPendingImages(in attributed: NSAttributedString) {
            var urls: [String] = []
            attributed.enumerateAttribute(.mgtdImageURL, in: NSRange(location: 0, length: attributed.length)) { value, _, _ in
                if let s = value as? String, imageCache[s] == nil { urls.append(s) }
            }
            for urlString in Set(urls) {
                guard let url = URL(string: resolvedImageURL(urlString)) else { continue }
                URLSession.shared.dataTask(with: url) { [weak self] data, _, _ in
                    guard let self, let data, let image = UIImage(data: data) else { return }
                    DispatchQueue.main.async {
                        self.imageCache[urlString] = image
                        self.renderedKey = ""  // force a rebuild that swaps in the image
                        self.render()
                    }
                }.resume()
            }
        }

        private func resolvedImageURL(_ path: String) -> String {
            if let range = path.range(of: #"\.mgtd/attachments/([a-zA-Z0-9\-]+\.(png|jpe?g|gif|webp))$"#, options: .regularExpression) {
                let filename = String(path[range]).components(separatedBy: "/").last ?? ""
                return "\(Settings.shared.effectiveApiUrl)/api/attachments/\(filename)"
            }
            return path
        }

        // MARK: - Edit menu

        func textView(
            _ textView: UITextView,
            editMenuForTextIn range: NSRange,
            suggestedActions: [UIMenuElement]
        ) -> UIMenu? {
            guard range.length > 0 else { return UIMenu(children: suggestedActions) }
            let highlightAction = UIAction(title: "Highlight") { [weak self] _ in
                guard let self, let tv = self.textView else { return }
                let ns = (tv.text ?? "") as NSString
                if let quote = HighlightAnchor.computeQuote(text: ns, selectedRange: range) {
                    self.parent.onCreate(quote)
                }
                tv.selectedTextRange = nil
            }
            return UIMenu(children: [highlightAction] + suggestedActions)
        }

        // MARK: - Tap

        @objc func handleTap(_ gesture: UITapGestureRecognizer) {
            guard gesture.state == .ended, let tv = textView, let attributed = tv.attributedText else { return }
            let point = gesture.location(in: tv)
            guard let position = tv.closestPosition(to: point) else { return }
            let index = tv.offset(from: tv.beginningOfDocument, to: position)
            guard index >= 0, index < attributed.length else { return }

            if let iconId = attributed.attribute(.mgtdHighlightIcon, at: index, effectiveRange: nil) as? Int {
                parent.onTapHighlight(iconId)
                return
            }
            if let highlightId = attributed.attribute(.mgtdHighlightId, at: index, effectiveRange: nil) as? Int {
                parent.onTapHighlight(highlightId)
                return
            }
            if let link = attributed.attribute(.link, at: index, effectiveRange: nil) as? URL,
               let parsed = parseInternalIssueURL(link) {
                parent.onIssueTap?(parsed.id, parsed.type)
            }
        }

        func gestureRecognizer(
            _ gestureRecognizer: UIGestureRecognizer,
            shouldRecognizeSimultaneouslyWith otherGestureRecognizer: UIGestureRecognizer
        ) -> Bool { true }
    }
}

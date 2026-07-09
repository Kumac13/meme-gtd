import SwiftUI
import UIKit

/// Context passed to `MarkdownBody` to make article prose blocks highlightable.
/// When present, `.text` blocks render through `SelectableMarkdownText` (native
/// selection + "Highlight" edit-menu action); when nil, MarkdownBody is unchanged.
struct ArticleHighlightContext {
    let highlights: [Highlight]
    /// Called when the user picks "Highlight" on a text selection.
    let onCreate: (QuoteSelector) -> Void
    /// Called when the user taps an existing highlight (by highlight id).
    let onTapHighlight: (Int) -> Void
    /// Internal `#id` link tap routing, mirroring MarkdownBody's onIssueTap.
    let onIssueTap: ((Int, String) -> Void)?
}

/// A single prose paragraph rendered in a self-sizing, non-editable but
/// selectable `UITextView`. Provides native iOS text selection with a
/// "Highlight" edit-menu action, renders existing highlights with a green
/// background, and routes taps on highlights / internal links.
///
/// v1 scope: selection and highlight rendering are per-block (a highlight that
/// spans paragraphs is not supported), and only `.text` (paragraph) blocks are
/// selectable — headings/lists/quotes/code/images render as before.
struct SelectableMarkdownText: UIViewRepresentable {
    let content: String
    let fontSize: CGFloat
    let textColor: UIColor
    let context: ArticleHighlightContext

    func makeCoordinator() -> Coordinator { Coordinator(self) }

    func makeUIView(context ctx: Context) -> UITextView {
        let tv = UITextView()
        tv.isEditable = false
        tv.isSelectable = true
        tv.isScrollEnabled = false
        tv.backgroundColor = .clear
        tv.textContainerInset = .zero
        tv.textContainer.lineFragmentPadding = 0
        tv.delegate = ctx.coordinator
        tv.setContentHuggingPriority(.required, for: .vertical)
        tv.setContentCompressionResistancePriority(.required, for: .vertical)

        let tap = UITapGestureRecognizer(target: ctx.coordinator, action: #selector(Coordinator.handleTap(_:)))
        tap.delegate = ctx.coordinator
        tv.addGestureRecognizer(tap)

        ctx.coordinator.textView = tv
        tv.attributedText = ctx.coordinator.buildAttributed()
        return tv
    }

    func updateUIView(_ tv: UITextView, context ctx: Context) {
        ctx.coordinator.parent = self
        tv.attributedText = ctx.coordinator.buildAttributed()
    }

    final class Coordinator: NSObject, UITextViewDelegate, UIGestureRecognizerDelegate {
        var parent: SelectableMarkdownText
        weak var textView: UITextView?
        private var locatedHighlights: [(range: NSRange, id: Int)] = []

        init(_ parent: SelectableMarkdownText) { self.parent = parent }

        func buildAttributed() -> NSAttributedString {
            let attr = makeInlineAttributed(parent.content, fontSize: parent.fontSize, textColor: parent.textColor)
            let ns = attr.string as NSString
            locatedHighlights = []
            let bg = UIColor(Color.highlightBackground)
            for highlight in parent.context.highlights {
                let quote = QuoteSelector(exact: highlight.exact, prefix: highlight.prefix, suffix: highlight.suffix)
                if let range = HighlightAnchor.locate(quote, in: ns) {
                    attr.addAttribute(.backgroundColor, value: bg, range: range)
                    locatedHighlights.append((range, highlight.id))
                }
            }
            return attr
        }

        // MARK: - Edit menu: add "Highlight"

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
                    self.parent.context.onCreate(quote)
                }
                tv.selectedTextRange = nil
            }
            return UIMenu(children: [highlightAction] + suggestedActions)
        }

        // MARK: - Tap: open highlight sheet or follow internal link

        @objc func handleTap(_ gesture: UITapGestureRecognizer) {
            guard gesture.state == .ended, let tv = textView else { return }
            let point = gesture.location(in: tv)
            guard let position = tv.closestPosition(to: point) else { return }
            let index = tv.offset(from: tv.beginningOfDocument, to: position)

            for located in locatedHighlights where NSLocationInRange(index, located.range) {
                parent.context.onTapHighlight(located.id)
                return
            }

            if let attributed = tv.attributedText, index >= 0, index < attributed.length,
               let link = attributed.attribute(.link, at: index, effectiveRange: nil) as? URL,
               let parsed = parseInternalIssueURL(link) {
                parent.context.onIssueTap?(parsed.id, parsed.type)
            }
        }

        func gestureRecognizer(
            _ gestureRecognizer: UIGestureRecognizer,
            shouldRecognizeSimultaneouslyWith otherGestureRecognizer: UIGestureRecognizer
        ) -> Bool { true }
    }
}

/// Build an inline-markdown `NSMutableAttributedString` with accent-colored
/// links, mirroring `MarkdownBody.inlineAttributedText` but for UIKit. Internal
/// path-only links (`/tasks/63`) are promoted to a custom scheme so tap routing
/// can parse them (same trick as MarkdownBody).
func makeInlineAttributed(_ content: String, fontSize: CGFloat, textColor: UIColor) -> NSMutableAttributedString {
    let baseAttributes: [NSAttributedString.Key: Any] = [
        .font: UIFont.systemFont(ofSize: fontSize),
        .foregroundColor: textColor,
    ]

    guard let attributed = try? AttributedString(
        markdown: content,
        options: .init(interpretedSyntax: .inlineOnlyPreservingWhitespace)
    ) else {
        return NSMutableAttributedString(string: content, attributes: baseAttributes)
    }

    let ns = NSMutableAttributedString(attributedString: NSAttributedString(attributed))
    let fullRange = NSRange(location: 0, length: ns.length)
    ns.addAttributes(baseAttributes, range: fullRange)

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

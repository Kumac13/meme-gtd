import SwiftUI
import UIKit

/// Composer の Markdown 記号を UIKit の入力時に変換しない。
struct MarkdownComposerInput: UIViewRepresentable {
    @Binding var text: String
    @Binding var isFocused: Bool
    let placeholder: String

    @Environment(\.isEnabled) private var isEnabled

    func makeUIView(context: Context) -> UITextView {
        let view = UITextView()
        view.delegate = context.coordinator
        view.font = .systemFont(ofSize: 14)
        view.textColor = .label
        view.tintColor = UIColor(Color.accent)
        view.backgroundColor = .clear
        view.autocapitalizationType = .none
        view.autocorrectionType = .no
        view.smartDashesType = .no
        view.textContainerInset = .zero
        view.textContainer.lineFragmentPadding = 0
        view.accessibilityLabel = placeholder
        return view
    }

    func updateUIView(_ view: UITextView, context: Context) {
        context.coordinator.input = self
        view.isEditable = isEnabled
        if view.text != text, view.markedTextRange == nil {
            let selection = view.selectedRange
            view.text = text
            let location = min(selection.location, text.utf16.count)
            view.selectedRange = NSRange(location: location, length: min(selection.length, text.utf16.count - location))
        }

        if isFocused, isEnabled, !view.isFirstResponder {
            view.becomeFirstResponder()
        } else if (!isFocused || !isEnabled), view.isFirstResponder {
            view.resignFirstResponder()
        }
    }

    func sizeThatFits(_ proposal: ProposedViewSize, uiView: UITextView, context: Context) -> CGSize? {
        guard let width = proposal.width, width.isFinite, width > 0, let font = uiView.font else { return nil }
        let fitted = uiView.sizeThatFits(CGSize(width: width, height: .greatestFiniteMagnitude))
        let height = min(max(fitted.height, font.lineHeight * 2), font.lineHeight * 8)
        return CGSize(width: width, height: ceil(height))
    }

    func makeCoordinator() -> Coordinator {
        Coordinator(input: self)
    }

    final class Coordinator: NSObject, UITextViewDelegate {
        var input: MarkdownComposerInput

        init(input: MarkdownComposerInput) {
            self.input = input
        }

        func textViewDidChange(_ textView: UITextView) {
            input.text = textView.text
        }

        func textViewDidBeginEditing(_ textView: UITextView) {
            updateFocus(textView)
        }

        func textViewDidEndEditing(_ textView: UITextView) {
            updateFocus(textView)
        }

        private func updateFocus(_ textView: UITextView) {
            // updateUIView がフォーカスを変更した場合にも、SwiftUI の更新後に通知する。
            Task { @MainActor [weak self, weak textView] in
                guard let self, let textView else { return }
                let focused = textView.isFirstResponder
                if input.isFocused != focused { input.isFocused = focused }
            }
        }
    }
}

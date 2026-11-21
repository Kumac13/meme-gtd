import SwiftUI
import UIKit

extension EnvironmentValues {
    @Entry var selectableTextDidSelect: ((UITextView) -> Void)? = nil
}

/// 読み取り専用の本文に、iOS 標準の範囲選択とコピーメニューを提供する。
struct SelectableText: UIViewRepresentable {
    let content: NSAttributedString

    @Environment(\.openURL) private var openURL
    @Environment(\.selectableTextDidSelect) private var didSelect

    func makeUIView(context: Context) -> UITextView {
        let view = UITextView()
        view.isEditable = false
        view.isSelectable = true
        view.isScrollEnabled = false
        view.tintColor = UIColor(Color.accent)
        view.backgroundColor = .clear
        view.textContainerInset = .zero
        view.textContainer.lineFragmentPadding = 0
        view.linkTextAttributes = [
            .foregroundColor: UIColor(Color.accent),
            .underlineStyle: NSUnderlineStyle.single.rawValue,
        ]
        view.delegate = context.coordinator
        return view
    }

    func updateUIView(_ view: UITextView, context: Context) {
        context.coordinator.openURL = openURL
        context.coordinator.didSelect = didSelect
        // 親ビューが更新されても、本文が同じなら現在の選択範囲を保つ。
        if view.attributedText != content {
            view.attributedText = content
        }
    }

    func sizeThatFits(_ proposal: ProposedViewSize, uiView: UITextView, context: Context) -> CGSize? {
        guard let width = proposal.width, width.isFinite, width > 0 else { return nil }
        let size = uiView.sizeThatFits(CGSize(width: width, height: .greatestFiniteMagnitude))
        return CGSize(width: width, height: ceil(size.height))
    }

    func makeCoordinator() -> Coordinator {
        Coordinator()
    }

    final class Coordinator: NSObject, UITextViewDelegate {
        var openURL: OpenURLAction?
        var didSelect: ((UITextView) -> Void)?

        func textViewDidChangeSelection(_ textView: UITextView) {
            if textView.selectedRange.length > 0 { didSelect?(textView) }
        }

        func textView(_ textView: UITextView, primaryActionFor textItem: UITextItem, defaultAction: UIAction) -> UIAction? {
            guard case .link(let url) = textItem.content, let openURL else { return defaultAction }
            return UIAction { _ in openURL(url) }
        }
    }
}

import SwiftUI
import UIKit

struct MemoTimelineItem: View {
    let memo: Memo
    var snippet: String? = nil
    var searchQuery: String? = nil
    let onOpen: () -> Void
    @State private var interaction = ThreadInteraction()

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack(alignment: .top, spacing: 10) {
                MemoBody(bodyMd: memo.bodyMd, labels: memo.labels, searchQuery: searchQuery)
                    .frame(maxWidth: .infinity, alignment: .leading)

                Spacer(minLength: 0)

                // Comment count (right edge)
                if let count = memo.commentCount, count > 0 {
                    Image(systemName: "bubble.right")
                        .font(.system(size: 11))
                        .foregroundColor(.textSecondary)
                        .padding(.top, 2)
                }
            }

            if let snippet = snippet, let query = searchQuery, !query.isEmpty {
                Text(highlightKeyword(in: snippet, query: query))
                    .lineLimit(2)
                    .padding(.top, 4)
            }
        }
        .padding(.vertical, 10)
        .frame(maxWidth: .infinity, alignment: .leading)
        .contentShape(Rectangle())
        .environment(\.selectableTextDidSelect) { interaction.selectedText = $0 }
        .gesture(MemoThreadTap(interaction: interaction, action: onOpen))
        .accessibilityElement(children: .contain)
        .accessibilityAction(named: Text("Open Memo"), onOpen)
    }
}

private final class ThreadInteraction {
    weak var selectedText: UITextView?

    var hasSelection: Bool {
        (selectedText?.selectedRange.length ?? 0) > 0
    }
}

private struct MemoThreadTap: UIGestureRecognizerRepresentable {
    let interaction: ThreadInteraction
    let action: () -> Void

    func makeCoordinator(converter: CoordinateSpaceConverter) -> Coordinator {
        Coordinator(interaction: interaction)
    }

    func makeUIGestureRecognizer(context: Context) -> UITapGestureRecognizer {
        let recognizer = UITapGestureRecognizer()
        recognizer.delegate = context.coordinator
        recognizer.cancelsTouchesInView = false
        return recognizer
    }

    func handleUIGestureRecognizerAction(_ recognizer: UITapGestureRecognizer, context: Context) {
        if recognizer.state == .recognized, !interaction.hasSelection { action() }
    }

    final class Coordinator: NSObject, UIGestureRecognizerDelegate {
        let interaction: ThreadInteraction

        init(interaction: ThreadInteraction) {
            self.interaction = interaction
        }

        func gestureRecognizer(_ gestureRecognizer: UIGestureRecognizer, shouldReceive touch: UITouch) -> Bool {
            // 編集メニューへのタップも行の座標に重なるため、行全体の選択状態を見る。
            !interaction.hasSelection
        }

        func gestureRecognizer(
            _ gestureRecognizer: UIGestureRecognizer,
            shouldRecognizeSimultaneouslyWith otherGestureRecognizer: UIGestureRecognizer
        ) -> Bool {
            // テキスト側のダブルタップや長押しの判定を待たず、短いタップで開く。
            true
        }
    }
}

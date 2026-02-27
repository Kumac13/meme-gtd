import SwiftUI

struct MemoTimelineItem: View {
    let memo: Memo

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            // Body text (rendered as markdown)
            if let attributed = try? AttributedString(
                markdown: memo.bodyMd,
                options: .init(interpretedSyntax: .inlineOnlyPreservingWhitespace)
            ) {
                Text(attributed)
                    .font(.system(size: 13))
                    .lineSpacing(4)
                    .foregroundColor(Color(.label).opacity(0.75))
                    .multilineTextAlignment(.leading)
            } else {
                Text(memo.bodyMd)
                    .font(.system(size: 13))
                    .lineSpacing(4)
                    .foregroundColor(Color(.label).opacity(0.75))
                    .multilineTextAlignment(.leading)
            }

            // Labels
            if let labels = memo.labels, !labels.isEmpty {
                HStack(spacing: 4) {
                    ForEach(labels.prefix(3), id: \.self) { label in
                        Text(label)
                            .font(.system(size: 10, weight: .medium))
                            .padding(.horizontal, 6)
                            .padding(.vertical, 2)
                            .background(Color.accent.opacity(0.12))
                            .foregroundColor(.accent)
                            .cornerRadius(4)
                    }
                }
                .padding(.top, 6)
            }

            // Comment count (right-aligned, only if > 0)
            if let count = memo.commentCount, count > 0 {
                HStack {
                    Spacer()
                    HStack(spacing: 3) {
                        Image(systemName: "bubble.right")
                            .font(.system(size: 11))
                        Text("\(count)")
                            .font(.system(size: 11))
                    }
                    .foregroundColor(.textSecondary)
                }
                .padding(.top, 4)
            }
        }
        .padding(.vertical, 6)
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

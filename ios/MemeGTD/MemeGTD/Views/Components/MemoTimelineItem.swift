import SwiftUI

struct MemoTimelineItem: View {
    let memo: Memo

    var body: some View {
        // HStack: memo content (flex-1) + comment count (right side)
        // Matches Web UI: <div className="flex items-start gap-2.5">
        HStack(alignment: .top, spacing: 10) {
            // Memo body + labels (takes remaining space, pushes comment to right edge)
            VStack(alignment: .leading, spacing: 0) {
                // Body text (markdown)
                MarkdownBody(memo.bodyMd, fontSize: 13)

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
            }
            .frame(maxWidth: .infinity, alignment: .leading)

            Spacer(minLength: 0)

            // Comment count (right edge, top-aligned with memo text)
            if let count = memo.commentCount, count > 0 {
                Image(systemName: "bubble.right")
                    .font(.system(size: 11))
                    .foregroundColor(.textSecondary)
                    .padding(.top, 2)
            }
        }
        .padding(.vertical, 10)
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

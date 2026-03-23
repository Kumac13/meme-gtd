import SwiftUI

struct MemoTimelineItem: View {
    let memo: Memo
    var matchInfo: SearchMatchInfo? = nil

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack(alignment: .top, spacing: 10) {
                MemoBody(bodyMd: memo.bodyMd, labels: memo.labels)
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

            // Search match info (label + optional snippet)
            if let info = matchInfo {
                HStack(spacing: 6) {
                    Text(info.label)
                        .font(.system(size: 10, weight: .medium))
                        .padding(.horizontal, 6)
                        .padding(.vertical, 2)
                        .background(Color.textSecondary.opacity(0.15))
                        .foregroundColor(.textSecondary)
                        .cornerRadius(4)
                    if let snippet = info.snippet {
                        Text(snippet)
                            .font(.system(size: 11))
                            .foregroundColor(.textSecondary)
                            .lineLimit(1)
                    }
                }
                .padding(.top, 4)
            }
        }
        .padding(.vertical, 10)
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

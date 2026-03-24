import SwiftUI

struct MemoTimelineItem: View {
    let memo: Memo
    var matchInfo: SearchMatchInfo? = nil
    var searchQuery: String? = nil

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
                HStack(spacing: 4) {
                    Text(info.label)
                        .font(.system(size: 11, weight: .medium))
                        .foregroundColor(.textSecondary)
                    if let snippet = info.snippet, let query = searchQuery, !query.isEmpty {
                        Text("-")
                            .font(.system(size: 11))
                            .foregroundColor(.textSecondary)
                        Text(highlightKeyword(in: snippet, query: query))
                            .font(.system(size: 11))
                            .foregroundColor(.textSecondary)
                            .lineLimit(2)
                    }
                }
                .padding(.top, 4)
            }
        }
        .padding(.vertical, 10)
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

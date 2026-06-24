import SwiftUI

struct MemoTimelineItem: View {
    let memo: Memo
    var snippet: String? = nil
    var searchQuery: String? = nil

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack(alignment: .top, spacing: 10) {
                MemoBody(bodyMd: memo.bodyMd, labels: memo.labels, searchQuery: searchQuery)
                    .frame(maxWidth: .infinity, alignment: .leading)

                Spacer(minLength: 0)

                // Sync indicator (clock / warning) for offline-tracked rows
                syncGlyph
                    .font(.system(size: 11))
                    .padding(.top, 2)

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
    }

    @ViewBuilder
    private var syncGlyph: some View {
        switch memo.syncState {
        case "pendingCreate", "pendingUpdate", "pendingDelete":
            Image(systemName: "clock.arrow.circlepath")
                .foregroundColor(.textSecondary)
        case "conflict":
            Image(systemName: "exclamationmark.triangle.fill")
                .foregroundColor(.red)
        default:
            EmptyView()
        }
    }
}

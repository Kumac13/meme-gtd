import SwiftUI

struct MemoTimelineItem: View {
    let memo: Memo

    var body: some View {
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
        .padding(.vertical, 10)
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

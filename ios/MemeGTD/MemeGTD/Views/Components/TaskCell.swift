import SwiftUI

struct TaskCell: View {
    let task: TaskItem
    var snippet: String? = nil
    var searchQuery: String? = nil

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            // Title (with keyword highlight during search)
            if let query = searchQuery, !query.isEmpty {
                Text(highlightKeyword(in: task.title, query: query, fontSize: 14, baseColor: .textPrimary))
                    .lineLimit(2)
            } else {
                Text(task.title)
                    .font(.system(size: 14))
                    .foregroundColor(.textPrimary)
                    .lineLimit(2)
            }

            if let snippet = snippet, let query = searchQuery, !query.isEmpty {
                Text(highlightKeyword(in: snippet, query: query))
                    .lineLimit(2)
                    .padding(.top, 4)
            }

            // #id time | bookmark | labels — spacing で視覚的にグループ分け
            HStack(spacing: 6) {
                // The integer id is a SERVER identity; rows that only exist
                // on this device (Standalone / not-yet-synced, id = -rowid)
                // have no meaningful number to show.
                if task.id > 0 {
                    Text(verbatim: "#\(task.id)")
                        .font(.system(size: 11))
                        .foregroundColor(.textSecondary)
                }

                CompactRelativeTimeText(iso: task.createdAt)

                if !task.labels.isEmpty {
                    IssueLabelChips(labels: task.labels)
                }
            }
            .padding(.top, 6)
        }
        .padding(.vertical, 10)
        .frame(maxWidth: .infinity, alignment: .leading)
    }

}

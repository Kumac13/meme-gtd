import SwiftUI

struct TaskCell: View {
    let task: TaskItem
    var snippet: String? = nil
    var searchQuery: String? = nil

    var body: some View {
        IssueCellLayout(title: task.title, snippet: snippet, searchQuery: searchQuery) {
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
    }

}

import SwiftUI

struct ThreadItem: View {
    let bodyMd: String
    let createdAt: String
    let showGapTimestamp: Bool
    let gapTimestampText: String
    var isOriginalMemo: Bool = false
    var onEdit: (() -> Void)?
    var onDelete: (() -> Void)?
    var onCopy: (() -> Void)?

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            // Gap timestamp
            if showGapTimestamp {
                Text(gapTimestampText)
                    .font(.caption2)
                    .foregroundColor(.textSecondary)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 8)
            }

            // Content
            VStack(alignment: .leading, spacing: 8) {
                // Markdown body
                MarkdownBody(bodyMd, fontSize: 16, color: .textPrimary)
                    .textSelection(.enabled)

                // Timestamp
                Text(TimelineHelpers.formatTimelineTime(iso: createdAt))
                    .font(.caption2)
                    .foregroundColor(.textSecondary)
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 12)
            .frame(maxWidth: .infinity, alignment: .leading)
            .contextMenu {
                if let onCopy = onCopy {
                    Button(action: onCopy) {
                        Label("Copy", systemImage: "doc.on.doc")
                    }
                }
                if let onEdit = onEdit {
                    Button(action: onEdit) {
                        Label("Edit", systemImage: "pencil")
                    }
                }
                if let onDelete = onDelete {
                    Button(role: .destructive, action: onDelete) {
                        Label("Delete", systemImage: "trash")
                    }
                }
            }
        }
    }
}

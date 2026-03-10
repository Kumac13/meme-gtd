import SwiftUI

/// Thread item matching MemoTimelineItem layout. Uses shared MemoBody.
/// Timestamps and date bucket headers are rendered externally in MemoDetailView.
struct ThreadItem: View {
    let bodyMd: String
    var labels: [String]?
    var showMenu: Bool = true
    var onEdit: (() -> Void)?
    var onDelete: (() -> Void)?
    var onCopy: (() -> Void)?

    var body: some View {
        HStack(alignment: .top, spacing: 4) {
            MemoBody(bodyMd: bodyMd, labels: labels)
                .frame(maxWidth: .infinity, alignment: .leading)

            if showMenu {
                // Three-dot menu
                Menu {
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
                } label: {
                    Image(systemName: "ellipsis")
                        .font(.system(size: 13))
                        .foregroundColor(.textSecondary)
                        .frame(width: 28, height: 20)
                        .contentShape(Rectangle())
                }
            }
        }
        .padding(.vertical, 10)
        .padding(.horizontal, 16)
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

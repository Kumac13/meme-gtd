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
    var onIssueTap: ((Int, String) -> Void)?
    var onTodoToggle: ((Int, Bool) -> Void)?

    var body: some View {
        HStack(alignment: .top, spacing: 4) {
            MemoBody(bodyMd: bodyMd, labels: labels, onIssueTap: onIssueTap, onTodoToggle: onTodoToggle)
                .frame(maxWidth: .infinity, alignment: .leading)

            if showMenu {
                IssueItemMenu(onCopy: onCopy, onEdit: onEdit, onDelete: onDelete)
            }
        }
        .padding(.vertical, 10)
        .padding(.horizontal, 16)
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

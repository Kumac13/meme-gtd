import SwiftUI

struct IssueItemMenu: View {
    var onCopy: (() -> Void)?
    var onEdit: (() -> Void)?
    var onDelete: (() -> Void)?
    var mutationsDisabled = false

    var body: some View {
        Menu {
            if let onCopy {
                Button(action: onCopy) {
                    Label("Copy", systemImage: "doc.on.doc")
                }
            }
            if let onEdit {
                Button(action: onEdit) {
                    Label("Edit", systemImage: "pencil")
                }
                .disabled(mutationsDisabled)
            }
            if let onDelete {
                Button(role: .destructive, action: onDelete) {
                    Label("Delete", systemImage: "trash")
                }
                .disabled(mutationsDisabled)
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

struct IssueContentCard: View {
    let bodyMd: String
    let createdAt: String
    let updatedAt: String
    let emptyText: String
    var copyText: String? = nil
    var mutationsDisabled = false
    var onEdit: (() -> Void)?
    var onDelete: (() -> Void)?
    var onIssueTap: ((Int, String) -> Void)?
    var onTodoToggle: ((Int, Bool) -> Void)?

    var body: some View {
        IssueAreaCard {
            VStack(alignment: .leading, spacing: 0) {
                HStack {
                    IssueContentTimestamp(createdAt: createdAt, updatedAt: updatedAt)
                    Spacer()
                    IssueItemMenu(
                        onCopy: {
                            UIPasteboard.general.string = copyText ?? bodyMd
                            HapticManager.notification(.success)
                        },
                        onEdit: onEdit,
                        onDelete: onDelete,
                        mutationsDisabled: mutationsDisabled
                    )
                }
                .padding(.horizontal, 16)
                .padding(.top, 8)
                .padding(.bottom, -2)

                if bodyMd.isEmpty {
                    Text(emptyText)
                        .font(.system(size: 14))
                        .foregroundColor(.textSecondary)
                        .italic()
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .padding(.vertical, 10)
                        .padding(.horizontal, 16)
                } else {
                    ThreadItem(
                        bodyMd: bodyMd,
                        labels: nil,
                        showMenu: false,
                        onIssueTap: onIssueTap,
                        onTodoToggle: onTodoToggle
                    )
                }
            }
        }
    }
}

struct IssueTimeline: View {
    let entries: [TimelineEntry]
    let issueId: Int
    var mutationsDisabled = false
    let onEditComment: (Comment) -> Void
    let onDeleteComment: (Comment) -> Void
    var onIssueTap: ((Int, String) -> Void)?
    var onTodoToggle: ((Comment, Int, Bool) -> Void)?

    var body: some View {
        ForEach(entries) { entry in
            IssueSectionConnector()

            switch entry {
            case .comment(let comment):
                IssueContentCard(
                    bodyMd: comment.bodyMd,
                    createdAt: comment.createdAt,
                    updatedAt: comment.updatedAt,
                    emptyText: "No comment provided.",
                    mutationsDisabled: mutationsDisabled,
                    onEdit: { onEditComment(comment) },
                    onDelete: { onDeleteComment(comment) },
                    onIssueTap: onIssueTap,
                    onTodoToggle: onTodoToggle.map { toggle in
                        { index, checked in toggle(comment, index, checked) }
                    }
                )
            case .activity(let activity):
                ActivityItemView(activity: activity, issueId: issueId)
            }
        }
    }
}

private struct IssueContentTimestamp: View {
    let createdAt: String
    let updatedAt: String

    var body: some View {
        HStack(spacing: 4) {
            let isEdited = updatedAt != createdAt
            Text(TimelineHelpers.relativeTimeString(iso: isEdited ? updatedAt : createdAt))
            if isEdited {
                Text("(edited)")
            }
        }
        .font(.system(size: 11))
        .foregroundColor(Color(.systemGray))
    }
}

import SwiftUI

/// Bottom sheet shown when a highlight is tapped: Add Comment / Copy / Remove.
struct HighlightActionSheet: View {
    let highlight: Highlight
    let onAddComment: () -> Void
    let onCopy: () -> Void
    let onRemove: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            Capsule()
                .fill(Color(.systemGray3))
                .frame(width: 40, height: 5)
                .frame(maxWidth: .infinity)
                .padding(.top, 8)
                .padding(.bottom, 14)

            Text("\u{201C}\(highlight.exact)\u{201D}")
                .font(.system(size: 14))
                .italic()
                .foregroundColor(.textSecondary)
                .padding(.leading, 10)
                .overlay(alignment: .leading) {
                    RoundedRectangle(cornerRadius: 1.5)
                        .fill(Color.accent)
                        .frame(width: 3)
                }
                .padding(.horizontal, 16)
                .padding(.bottom, 16)

            VStack(spacing: 0) {
                actionRow(title: "Add Comment", systemImage: "text.bubble", action: onAddComment)
                actionRow(title: "Copy", systemImage: "doc.on.doc", action: onCopy)
                actionRow(title: "Remove", systemImage: "trash", role: .destructive, action: onRemove)
            }
            .padding(.horizontal, 8)

            Spacer(minLength: 0)
        }
        .padding(.bottom, 12)
    }

    private func actionRow(
        title: String,
        systemImage: String,
        role: ButtonRole? = nil,
        action: @escaping () -> Void
    ) -> some View {
        Button(role: role, action: action) {
            HStack(spacing: 12) {
                Image(systemName: systemImage)
                    .font(.system(size: 16))
                    .frame(width: 24)
                Text(title)
                    .font(.system(size: 16))
                Spacer()
            }
            .foregroundColor(role == .destructive ? .red : .textPrimary)
            .padding(.vertical, 12)
            .padding(.horizontal, 8)
            .contentShape(Rectangle())
        }
    }
}

/// Sheet for adding or editing a highlight comment. Same simple markdown text
/// entry used across the app's lightweight editors.
struct HighlightCommentEditor: View {
    let title: String
    @State private var text: String
    let onSave: (String) -> Void
    @Environment(\.dismiss) private var dismiss
    @FocusState private var focused: Bool

    init(title: String, initialText: String = "", onSave: @escaping (String) -> Void) {
        self.title = title
        self._text = State(initialValue: initialText)
        self.onSave = onSave
    }

    var body: some View {
        NavigationStack {
            TextEditor(text: $text)
                .font(.system(size: 15))
                .padding(12)
                .focused($focused)
                .navigationTitle(title)
                .navigationBarTitleDisplayMode(.inline)
                .toolbar {
                    ToolbarItem(placement: .cancellationAction) {
                        Button("Cancel") { dismiss() }
                    }
                    ToolbarItem(placement: .confirmationAction) {
                        Button("Save") {
                            let trimmed = text.trimmingCharacters(in: .whitespacesAndNewlines)
                            if !trimmed.isEmpty { onSave(text) }
                            dismiss()
                        }
                        .disabled(text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
                    }
                }
        }
        .presentationDetents([.medium])
        .onAppear { focused = true }
    }
}

/// Bottom-of-article timeline: each highlight's quote followed by its comments,
/// with the standard three-dot Copy/Edit/Delete menu and an Add-comment button.
struct HighlightsTimelineSection: View {
    let highlights: [Highlight]
    let commentsByHighlight: [Int: [Comment]]
    let onIssueTap: ((Int, String) -> Void)?
    let onAddComment: (Int) -> Void
    let onEditComment: (Int, Comment) -> Void
    let onDeleteComment: (Int, Int) -> Void

    private var withComments: [Highlight] {
        highlights.filter { !(commentsByHighlight[$0.id] ?? []).isEmpty }
    }

    var body: some View {
        if !withComments.isEmpty {
            VStack(alignment: .leading, spacing: 16) {
                Text("Highlights & Comments")
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundColor(.textPrimary)
                    .padding(.horizontal, 16)

                ForEach(withComments) { highlight in
                    VStack(alignment: .leading, spacing: 6) {
                        Text("\u{201C}\(highlight.exact)\u{201D}")
                            .font(.system(size: 13))
                            .italic()
                            .foregroundColor(.textSecondary)
                            .padding(.horizontal, 16)

                        ForEach(commentsByHighlight[highlight.id] ?? []) { comment in
                            ThreadItem(
                                bodyMd: comment.bodyMd,
                                onEdit: { onEditComment(highlight.id, comment) },
                                onDelete: { onDeleteComment(highlight.id, comment.id) },
                                onCopy: {
                                    UIPasteboard.general.string = comment.bodyMd
                                    HapticManager.notification(.success)
                                },
                                onIssueTap: onIssueTap
                            )
                        }

                        Button {
                            onAddComment(highlight.id)
                        } label: {
                            HStack(spacing: 4) {
                                Image(systemName: "plus")
                                Text("Add comment")
                            }
                            .font(.system(size: 13))
                            .foregroundColor(.accent)
                        }
                        .padding(.horizontal, 16)
                    }
                    .padding(.leading, 6)
                    .overlay(alignment: .leading) {
                        RoundedRectangle(cornerRadius: 1)
                            .fill(Color.accent.opacity(0.5))
                            .frame(width: 2)
                    }
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.top, 8)
        }
    }
}

import SwiftUI

struct TaskCell: View {
    let task: TaskItem

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            // Layer 1: Title + Labels
            HStack(alignment: .center, spacing: 6) {
                Text(task.title)
                    .font(.system(size: 16, weight: .semibold))
                    .foregroundColor(.textPrimary)
                    .lineLimit(2)

                if !task.labels.isEmpty {
                    ForEach(task.labels.prefix(3), id: \.self) { label in
                        Text(label)
                            .font(.system(size: 10, weight: .medium))
                            .padding(.horizontal, 6)
                            .padding(.vertical, 2)
                            .background(LabelColorHelper.bgColor(for: label))
                            .foregroundColor(LabelColorHelper.textColor(for: label))
                            .clipShape(Capsule())
                    }
                    if task.labels.count > 3 {
                        Text("+\(task.labels.count - 3)")
                            .font(.system(size: 10, weight: .medium))
                            .padding(.horizontal, 6)
                            .padding(.vertical, 2)
                            .background(Color(.systemGray5))
                            .foregroundColor(.textSecondary)
                            .clipShape(Capsule())
                    }
                }
            }

            // Layer 2: Bookmark + Comment count
            if task.isBookmarked || task.resolvedCommentCount > 0 {
                HStack(spacing: 8) {
                    if task.isBookmarked {
                        Image(systemName: "bookmark.fill")
                            .font(.system(size: 11))
                            .foregroundColor(.accent)
                    }

                    if task.resolvedCommentCount > 0 {
                        HStack(spacing: 2) {
                            Image(systemName: "bubble.right")
                                .font(.system(size: 11))
                            Text("\(task.resolvedCommentCount)")
                                .font(.system(size: 11))
                        }
                        .foregroundColor(.textSecondary)
                    }
                }
            }

            // Layer 3: #id + scheduled date + relative time
            HStack(spacing: 8) {
                Text("#\(task.id)")
                    .font(.system(size: 12))
                    .foregroundColor(.textSecondary)

                if let scheduledOn = task.scheduledOn {
                    Text("Scheduled: \(scheduledOn)")
                        .font(.system(size: 12))
                        .foregroundColor(.textSecondary)
                }

                Text(formatRelativeTime(task.createdAt))
                    .font(.system(size: 12))
                    .foregroundColor(.textSecondary)
            }
        }
        .padding(.vertical, 10)
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    // MARK: - Relative time formatting

    private func formatRelativeTime(_ iso: String) -> String {
        guard let date = parseISO(iso) else { return "" }
        let formatter = RelativeDateTimeFormatter()
        formatter.unitsStyle = .short
        return formatter.localizedString(for: date, relativeTo: Date())
    }

    private func parseISO(_ iso: String) -> Date? {
        let isoFormatter = ISO8601DateFormatter()
        isoFormatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        if let date = isoFormatter.date(from: iso) { return date }
        isoFormatter.formatOptions = [.withInternetDateTime]
        return isoFormatter.date(from: iso)
    }
}

import SwiftUI

struct MemoTimelineItem: View {
    let memo: Memo
    let showTimestamp: Bool
    let timestampText: String

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            // Gap timestamp
            if showTimestamp {
                Text(timestampText)
                    .font(.caption2)
                    .foregroundColor(.textSecondary)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 8)
            }

            // Memo content
            HStack(alignment: .top, spacing: 0) {
                VStack(alignment: .leading, spacing: 6) {
                    // Body preview
                    Text(markdownPreview(memo.bodyMd))
                        .font(.system(size: 15))
                        .foregroundColor(.textPrimary)
                        .lineLimit(4)
                        .multilineTextAlignment(.leading)

                    // Bottom row: labels + comment count + time
                    HStack(spacing: 8) {
                        // Labels
                        if let labels = memo.labels, !labels.isEmpty {
                            ForEach(labels.prefix(3), id: \.self) { label in
                                Text(label)
                                    .font(.caption2)
                                    .padding(.horizontal, 6)
                                    .padding(.vertical, 2)
                                    .background(Color.accent.opacity(0.1))
                                    .foregroundColor(.accent)
                                    .cornerRadius(4)
                            }
                        }

                        Spacer()

                        // Comment count
                        if let count = memo.commentCount, count > 0 {
                            HStack(spacing: 2) {
                                Image(systemName: "bubble.right")
                                    .font(.caption2)
                                Text("\(count)")
                                    .font(.caption2)
                            }
                            .foregroundColor(.textSecondary)
                        }

                        // Bookmark indicator
                        if memo.isBookmarked {
                            Image(systemName: "bookmark.fill")
                                .font(.caption2)
                                .foregroundColor(.accent)
                        }

                        // Relative time
                        Text(TimelineHelpers.relativeTimeString(iso: memo.createdAt))
                            .font(.caption2)
                            .foregroundColor(.textSecondary)
                    }
                }
                .padding(.horizontal, 16)
                .padding(.vertical, 12)

                // Chevron
                Image(systemName: "chevron.right")
                    .font(.caption)
                    .foregroundColor(.textSecondary.opacity(0.5))
                    .padding(.trailing, 12)
                    .padding(.top, 16)
            }
            .background(Color(.systemBackground))
        }
    }

    private func markdownPreview(_ text: String) -> String {
        // Strip markdown syntax for preview
        var preview = text
        // Remove headers
        preview = preview.replacingOccurrences(of: #"^#{1,6}\s+"#, with: "", options: .regularExpression)
        // Remove bold/italic markers
        preview = preview.replacingOccurrences(of: #"\*{1,3}"#, with: "", options: .regularExpression)
        // Remove links, keep text
        preview = preview.replacingOccurrences(of: #"\[([^\]]+)\]\([^\)]+\)"#, with: "$1", options: .regularExpression)
        // Remove code backticks
        preview = preview.replacingOccurrences(of: "`", with: "")
        return preview
    }
}

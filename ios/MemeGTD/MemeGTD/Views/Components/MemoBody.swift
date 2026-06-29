import SwiftUI

/// Shared memo body component used by both MemoTimelineItem and ThreadItem.
/// Renders markdown body + optional labels with consistent styling.
struct MemoBody: View {
    let bodyMd: String
    var labels: [String]?
    var searchQuery: String?
    var onIssueTap: ((Int, String) -> Void)?

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            MarkdownBody(bodyMd, fontSize: 14, searchQuery: searchQuery, onIssueTap: onIssueTap)

            if let labels = labels, !labels.isEmpty {
                HStack(spacing: 4) {
                    ForEach(labels.prefix(3), id: \.self) { label in
                        Text(label)
                            .font(.system(size: 10, weight: .medium))
                            .padding(.horizontal, 6)
                            .padding(.vertical, 2)
                            .background(Color.accent.opacity(0.12))
                            .foregroundColor(.accent)
                            .cornerRadius(4)
                    }
                }
                .padding(.top, 6)
            }
        }
    }
}

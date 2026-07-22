import SwiftUI

/// Shared title/snippet/metadata anatomy for issue list rows.
struct IssueCellLayout<Metadata: View>: View {
    let title: String
    var snippet: String? = nil
    var searchQuery: String? = nil
    @ViewBuilder let metadata: () -> Metadata

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            if let searchQuery, !searchQuery.isEmpty {
                Text(highlightKeyword(in: title, query: searchQuery, fontSize: 14, baseColor: .textPrimary))
                    .lineLimit(2)
            } else {
                Text(title)
                    .font(.system(size: 14))
                    .foregroundColor(.textPrimary)
                    .lineLimit(2)
            }

            if let snippet, let searchQuery, !searchQuery.isEmpty {
                Text(highlightKeyword(in: snippet, query: searchQuery))
                    .lineLimit(2)
                    .padding(.top, 4)
            }

            HStack(spacing: 6) { metadata() }
                .padding(.top, 6)
        }
        .padding(.vertical, 10)
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

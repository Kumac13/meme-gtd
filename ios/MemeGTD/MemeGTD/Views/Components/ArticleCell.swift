import SwiftUI

struct ArticleCell: View {
    let article: Article
    var snippet: String? = nil
    var searchQuery: String? = nil

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            // Title (with keyword highlight during search)
            if let query = searchQuery, !query.isEmpty {
                Text(highlightKeyword(in: article.title, query: query, fontSize: 14, baseColor: .textPrimary))
                    .lineLimit(2)
            } else {
                Text(article.title)
                    .font(.system(size: 14))
                    .foregroundColor(.textPrimary)
                    .lineLimit(2)
            }

            if let snippet = snippet, let query = searchQuery, !query.isEmpty {
                Text(highlightKeyword(in: snippet, query: query))
                    .lineLimit(2)
                    .padding(.top, 4)
            }

            // site name | time | labels
            HStack(spacing: 6) {
                if let siteName = siteDisplayName {
                    Text(siteName)
                        .font(.system(size: 11))
                        .foregroundColor(.textSecondary)
                }

                CompactRelativeTimeText(iso: article.createdAt)

                if let labels = article.labels, !labels.isEmpty {
                    IssueLabelChips(labels: labels)
                }
            }
            .padding(.top, 6)
        }
        .padding(.vertical, 10)
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    // MARK: - Site name (from meta.siteName or domain extraction)

    private var siteDisplayName: String? {
        if let siteName = article.meta?.siteName, !siteName.isEmpty {
            return siteName
        }
        guard let originalUrl = article.meta?.originalUrl,
              let url = URL(string: originalUrl),
              let host = url.host else {
            return nil
        }
        return host.hasPrefix("www.") ? String(host.dropFirst(4)) : host
    }

}

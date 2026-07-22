import SwiftUI

struct ArticleCell: View {
    let article: Article
    var snippet: String? = nil
    var searchQuery: String? = nil

    var body: some View {
        IssueCellLayout(title: article.title, snippet: snippet, searchQuery: searchQuery) {
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

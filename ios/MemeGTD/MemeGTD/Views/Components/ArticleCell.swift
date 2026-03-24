import SwiftUI

struct ArticleCell: View {
    let article: Article
    var matchInfo: SearchMatchInfo? = nil
    var searchQuery: String? = nil

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            // Title (with keyword highlight during search)
            if let query = searchQuery, !query.isEmpty {
                Text(highlightKeyword(in: article.title, query: query))
                    .font(.system(size: 14))
                    .foregroundColor(.textPrimary)
                    .lineLimit(2)
            } else {
                Text(article.title)
                    .font(.system(size: 14))
                    .foregroundColor(.textPrimary)
                    .lineLimit(2)
            }

            // Search match info (label + optional snippet)
            if let info = matchInfo {
                HStack(spacing: 4) {
                    Text(info.label)
                        .font(.system(size: 11, weight: .medium))
                        .foregroundColor(.textSecondary)
                    if let snippet = info.snippet, let query = searchQuery, !query.isEmpty {
                        Text("-")
                            .font(.system(size: 11))
                            .foregroundColor(.textSecondary)
                        Text(highlightKeyword(in: snippet, query: query))
                            .font(.system(size: 11))
                            .foregroundColor(.textSecondary)
                            .lineLimit(2)
                    }
                }
                .padding(.top, 4)
            }

            // site name | time | labels
            HStack(spacing: 6) {
                if let siteName = siteDisplayName {
                    Text(siteName)
                        .font(.system(size: 11))
                        .foregroundColor(.textSecondary)
                }

                Text(formatCompactTime(article.createdAt))
                    .font(.system(size: 11))
                    .foregroundColor(.textSecondary)

                if let labels = article.labels, !labels.isEmpty {
                    HStack(spacing: 3) {
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

    // MARK: - Compact relative time

    private func formatCompactTime(_ iso: String) -> String {
        guard let date = parseISO(iso) else { return "" }
        let seconds = Int(Date().timeIntervalSince(date))
        if seconds < 60 { return "now" }
        let minutes = seconds / 60
        if minutes < 60 { return "\(minutes)m" }
        let hours = minutes / 60
        if hours < 24 { return "\(hours)h" }
        let days = hours / 24
        if days < 7 { return "\(days)d" }
        let weeks = days / 7
        if weeks < 5 { return "\(weeks)w" }
        let months = days / 30
        if months < 12 { return "\(months)mo" }
        let years = days / 365
        return "\(years)y"
    }

    private func parseISO(_ iso: String) -> Date? {
        let isoFormatter = ISO8601DateFormatter()
        isoFormatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        if let date = isoFormatter.date(from: iso) { return date }
        isoFormatter.formatOptions = [.withInternetDateTime]
        return isoFormatter.date(from: iso)
    }
}

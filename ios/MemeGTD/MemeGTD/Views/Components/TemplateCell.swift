import SwiftUI

/// Row for the Templates list. Same anatomy as TaskCell (title line, then
/// "#id time | labels" metadata row).
struct TemplateCell: View {
    let template: Template

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            Text(template.title ?? "Template #\(template.id)")
                .font(.system(size: 14))
                .foregroundColor(.textPrimary)
                .lineLimit(2)

            HStack(spacing: 6) {
                Text(verbatim: "#\(template.id)")
                    .font(.system(size: 11))
                    .foregroundColor(.textSecondary)

                Text(formatCompactTime(template.createdAt))
                    .font(.system(size: 11))
                    .foregroundColor(.textSecondary)

                if let labels = template.labels, !labels.isEmpty {
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

    // MARK: - Compact relative time (same as TaskCell)

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

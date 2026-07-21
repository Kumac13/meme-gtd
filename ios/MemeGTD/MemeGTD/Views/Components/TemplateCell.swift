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

                CompactRelativeTimeText(iso: template.createdAt)

                if let labels = template.labels, !labels.isEmpty {
                    IssueLabelChips(labels: labels)
                }
            }
            .padding(.top, 6)
        }
        .padding(.vertical, 10)
        .frame(maxWidth: .infinity, alignment: .leading)
    }

}

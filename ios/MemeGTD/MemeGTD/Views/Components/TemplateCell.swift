import SwiftUI

/// Row for the Templates list. Same anatomy as TaskCell (title line, then
/// "#id time | labels" metadata row).
struct TemplateCell: View {
    let template: Template

    var body: some View {
        IssueCellLayout(title: template.title ?? "Template #\(template.id)") {
                Text(verbatim: "#\(template.id)")
                    .font(.system(size: 11))
                    .foregroundColor(.textSecondary)

                CompactRelativeTimeText(iso: template.createdAt)

                if let labels = template.labels, !labels.isEmpty {
                    IssueLabelChips(labels: labels)
                }
        }
    }

}

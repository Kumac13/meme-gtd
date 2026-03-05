import SwiftUI

struct TaskTitleSection: View {
    let title: String
    let status: String
    var onEdit: (() -> Void)?

    var body: some View {
        HStack(alignment: .top, spacing: 4) {
            VStack(alignment: .leading, spacing: 8) {
                Text(title)
                    .font(.system(size: 18, weight: .semibold))
                    .foregroundColor(.textPrimary)

                // Status pill
                Text(statusDisplayLabel(status))
                    .font(.system(size: 12, weight: .medium))
                    .padding(.horizontal, 10)
                    .padding(.vertical, 4)
                    .background(statusColor(status).opacity(0.15))
                    .foregroundColor(statusColor(status))
                    .clipShape(Capsule())
            }
            .frame(maxWidth: .infinity, alignment: .leading)

            // Three-dot menu (Edit only)
            if let onEdit = onEdit {
                Menu {
                    Button(action: onEdit) {
                        Label("Edit", systemImage: "pencil")
                    }
                } label: {
                    Image(systemName: "ellipsis")
                        .font(.system(size: 13))
                        .foregroundColor(.textSecondary)
                        .frame(width: 28, height: 20)
                        .contentShape(Rectangle())
                }
            }
        }
        .padding(.vertical, 10)
        .padding(.horizontal, 16)
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    // MARK: - Status helpers

    private func statusDisplayLabel(_ status: String) -> String {
        switch status {
        case "inbox": return "Inbox"
        case "open": return "Open"
        case "next": return "Next"
        case "waiting": return "Waiting"
        case "scheduled": return "Scheduled"
        case "someday": return "Someday"
        case "done": return "Done"
        case "canceled": return "Canceled"
        default: return status.capitalized
        }
    }

    private func statusColor(_ status: String) -> Color {
        switch status {
        case "next": return .accent
        case "done": return Color(hex: "#8250df")
        case "canceled": return Color(.systemGray)
        case "waiting": return Color(hex: "#bf8700")
        case "scheduled": return Color(hex: "#0969da")
        case "someday": return Color(.systemTeal)
        default: return .textSecondary
        }
    }
}

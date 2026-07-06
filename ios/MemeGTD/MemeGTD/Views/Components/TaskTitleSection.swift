import SwiftUI

struct TaskTitleSection: View {
    let title: String
    let status: String
    /// Offline read-only cache state (offline support plan Phase 7): shows a
    /// "Read-only" chip beside the status pill, iWork-style.
    var isReadOnly: Bool = false
    var onStatusTap: (() -> Void)?

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(title)
                .font(.system(size: 18, weight: .semibold))
                .foregroundColor(.textPrimary)

            HStack(spacing: 8) {
                // Status pill (tappable)
                Button(action: { onStatusTap?() }) {
                    HStack(spacing: 4) {
                        Text(statusDisplayLabel(status))
                            .font(.system(size: 12, weight: .medium))
                        Image(systemName: "chevron.down")
                            .font(.system(size: 8, weight: .semibold))
                    }
                    .padding(.horizontal, 10)
                    .padding(.vertical, 4)
                    .background(statusColor(status).opacity(0.15))
                    .foregroundColor(statusColor(status))
                    .clipShape(Capsule())
                }
                .disabled(onStatusTap == nil)

                if isReadOnly {
                    OfflineReadOnlyBadge()
                }
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.vertical, 10)
        .padding(.horizontal, 16)
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

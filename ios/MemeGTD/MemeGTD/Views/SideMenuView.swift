import SwiftUI

enum AppTab: Hashable {
    case memos
    case tasks
    case articles
    case settings
}

struct SideMenuView: View {
    @Binding var selectedTab: AppTab
    let onNavigate: (AppTab) -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            // Product name (aligned with navigation bar)
            Text("M\u{00EB}mo")
                .font(.system(size: 28, weight: .bold))
                .foregroundColor(.textPrimary)
                .padding(.top, 4)
                .padding(.horizontal, 24)
                .padding(.bottom, 32)

            // Navigation items
            VStack(spacing: 4) {
                MenuRow(
                    icon: "doc.text",
                    label: "Memos",
                    isSelected: selectedTab == .memos
                ) {
                    HapticManager.selection()
                    onNavigate(.memos)
                }

                MenuRow(
                    icon: "checklist",
                    label: "Tasks",
                    isSelected: selectedTab == .tasks
                ) {
                    HapticManager.selection()
                    onNavigate(.tasks)
                }

                MenuRow(
                    icon: "doc.richtext",
                    label: "Articles",
                    isSelected: selectedTab == .articles
                ) {
                    HapticManager.selection()
                    onNavigate(.articles)
                }
            }
            .padding(.horizontal, 12)

            Spacer()

            // Bottom: settings gear button
            Button(action: {
                HapticManager.selection()
                onNavigate(.settings)
            }) {
                Image(systemName: "gearshape")
                    .font(.system(size: 20))
                    .foregroundColor(.menuText)
                    .frame(width: 44, height: 44)
            }
            .padding(.horizontal, 16)
            .padding(.bottom, 10)
        }
        .frame(maxHeight: .infinity)
        .background(Color.menuBackground)
    }
}

private struct MenuRow: View {
    let icon: String
    let label: String
    var isSelected: Bool = false
    var disabled: Bool = false
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: 14) {
                Image(systemName: icon)
                    .font(.system(size: 18))
                    .frame(width: 24)
                    .foregroundColor(foregroundColor)

                Text(label)
                    .font(.system(size: 16, weight: isSelected ? .semibold : .regular))
                    .foregroundColor(foregroundColor)

                Spacer()
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 12)
            .background(isSelected ? Color.accent.opacity(0.1) : Color.clear)
            .cornerRadius(10)
        }
        .disabled(disabled)
    }

    private var foregroundColor: Color {
        if isSelected { return .accent }
        return .menuTextMuted
    }
}

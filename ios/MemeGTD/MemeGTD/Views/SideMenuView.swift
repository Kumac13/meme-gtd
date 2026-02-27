import SwiftUI

enum AppTab: Hashable {
    case memos
    case settings
}

struct SideMenuView: View {
    @Binding var selectedTab: AppTab
    @Binding var isOpen: Bool
    let onNavigate: (AppTab) -> Void

    private let menuWidth: CGFloat = 280

    var body: some View {
        ZStack(alignment: .leading) {
            // Dim overlay
            Color.black.opacity(0.3)
                .ignoresSafeArea()
                .onTapGesture {
                    HapticManager.impact(.light)
                    withAnimation(.easeOut(duration: 0.25)) {
                        isOpen = false
                    }
                }

            // Menu panel
            HStack(spacing: 0) {
                VStack(alignment: .leading, spacing: 0) {
                    // Product name
                    Text("Memo")
                        .font(.system(size: 28, weight: .bold))
                        .foregroundColor(.textPrimary)
                        .padding(.top, 60)
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
                            isSelected: false,
                            disabled: true
                        ) {}
                    }
                    .padding(.horizontal, 12)

                    Spacer()

                    // Bottom settings
                    VStack(spacing: 4) {
                        MenuRow(
                            icon: "gearshape",
                            label: "Settings",
                            isSelected: selectedTab == .settings
                        ) {
                            HapticManager.selection()
                            onNavigate(.settings)
                        }
                    }
                    .padding(.horizontal, 12)
                    .padding(.bottom, 40)
                }
                .frame(width: menuWidth)
                .background(Color(.systemBackground))

                Spacer()
            }
        }
        .transition(.opacity)
        .animation(.easeOut(duration: 0.25), value: isOpen)
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
        if disabled { return .textSecondary.opacity(0.5) }
        if isSelected { return .accent }
        return .textPrimary
    }
}

import SwiftUI

struct FilterPill: View {
    let label: String
    let isActive: Bool
    var activeColor: Color = .textPrimary
    let action: () -> Void

    var body: some View {
        Button(action: {
            HapticManager.impact(.light)
            action()
        }) {
            Text(label)
                .font(.system(size: 14))
                .lineLimit(1)
                .foregroundColor(isActive ? activeColor : .textSecondary)
                .padding(.horizontal, 10)
                .padding(.vertical, 6)
        }
        .modifier(PillSurface(radius: 16))
    }
}

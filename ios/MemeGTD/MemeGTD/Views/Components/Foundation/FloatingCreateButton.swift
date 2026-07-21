import SwiftUI

/// 一覧画面の右下に表示する共通作成ボタン。
struct FloatingCreateButton: View {
    var disabled: Bool = false
    let action: () -> Void

    var body: some View {
        Button(action: {
            HapticManager.impact(.medium)
            action()
        }) {
            Image(systemName: "plus")
                .font(.system(size: 20, weight: .semibold))
                .foregroundColor(.white)
                .frame(width: 52, height: 52)
                .background(Color.accent)
                .clipShape(Circle())
        }
        .disabled(disabled)
        .opacity(disabled ? 0.4 : 1)
        .accessibilityLabel("Create new item")
    }
}

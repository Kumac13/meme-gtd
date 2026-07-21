import SwiftUI

/// モーダル共通のヘッダー。タイトルを中央に保ったまま、用途に応じた
/// trailing action を表示する。
struct ModalHeader: View {
    enum TrailingAction {
        case placeholder
        case confirm(isEnabled: Bool, action: () -> Void)
        case create(isEnabled: Bool, isSubmitting: Bool, action: () -> Void)
        case clear(isEnabled: Bool, action: () -> Void)
    }

    let title: String
    let onDismiss: () -> Void
    var trailingAction: TrailingAction = .placeholder

    var body: some View {
        HStack {
            Button(action: {
                HapticManager.impact(.light)
                onDismiss()
            }) {
                dismissIcon
            }
            .accessibilityLabel("Close")

            Spacer()

            Text(title)
                .font(.system(size: 17, weight: .semibold))

            Spacer()

            trailingView
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 12)
    }

    private var dismissIcon: some View {
        Image(systemName: "xmark.circle.fill")
            .font(.system(size: 28))
            .symbolRenderingMode(.hierarchical)
            .foregroundColor(Color(.tertiaryLabel))
    }

    @ViewBuilder
    private var trailingView: some View {
        switch trailingAction {
        case .placeholder:
            dismissIcon.hidden()

        case .confirm(let isEnabled, let action):
            Button(action: action) {
                Image(systemName: "checkmark.circle.fill")
                    .font(.system(size: 28))
                    .foregroundColor(isEnabled ? .accent : Color(.systemGray3))
            }
            .disabled(!isEnabled)
            .accessibilityLabel("Confirm")

        case .create(let isEnabled, let isSubmitting, let action):
            Button(action: action) {
                if isSubmitting {
                    ProgressView()
                        .frame(width: 28, height: 28)
                } else {
                    Text("Create")
                        .font(.system(size: 17, weight: .semibold))
                        .foregroundColor(isEnabled ? .accent : Color(.systemGray3))
                }
            }
            .disabled(!isEnabled || isSubmitting)

        case .clear(let isEnabled, let action):
            Button("Clear", action: action)
                .font(.system(size: 16))
                .foregroundColor(isEnabled ? .accent : Color(.systemGray3))
                .disabled(!isEnabled)
        }
    }
}

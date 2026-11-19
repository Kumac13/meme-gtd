import SwiftUI

/// 確認する内容と、明示的な確定時だけ実行する処理。
struct ConfirmationRequest {
    let title: String
    let message: String
    let confirmLabel: String
    var role: ButtonRole? = nil
    let onConfirm: () -> Void
}

/// アプリ共通の実行前確認。キャンセルと通常の閉じる操作では実行しない。
private struct ConfirmationModal: ViewModifier {
    @Binding var request: ConfirmationRequest?

    func body(content: Content) -> some View {
        content.alert(
            request?.title ?? "",
            isPresented: Binding(
                get: { request != nil },
                set: { if !$0 { request = nil } }
            ),
            presenting: request
        ) { confirmation in
            Button("Cancel", role: .cancel) {}
            Button(confirmation.confirmLabel, role: confirmation.role) {
                confirmation.onConfirm()
            }
        } message: { confirmation in
            Text(confirmation.message)
        }
    }
}

extension View {
    func confirmationModal(_ request: Binding<ConfirmationRequest?>) -> some View {
        modifier(ConfirmationModal(request: request))
    }
}

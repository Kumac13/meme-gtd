import SwiftUI

/// 画面上部に一時表示する共通フィードバック。
struct FeedbackToast: View {
    let message: String

    var body: some View {
        Text(message)
            .font(.system(size: 13, weight: .semibold))
            .padding(.horizontal, 16)
            .padding(.vertical, 8)
            .background(.regularMaterial, in: Capsule())
            .padding(.top, 8)
            .transition(.move(edge: .top).combined(with: .opacity))
            .accessibilityAddTraits(.isStaticText)
    }
}

/// 一覧・詳細画面で共有するローディングオーバーレイ。
struct LoadingOverlay: View {
    let isPresented: Bool
    let message: String

    var body: some View {
        if isPresented {
            ProgressView(message)
                .foregroundColor(.textSecondary)
        }
    }
}

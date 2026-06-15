import SwiftUI

/// Thin banner that floats at the top of the screen when one or more memos
/// hit the sync retry ceiling. Intentionally low-key — the plan calls for
/// a transparent UX in the success case, so the only visible offline state
/// is "something the user needs to fix".
struct FailedMemosBanner: View {
    let count: Int
    let onTap: () -> Void

    var body: some View {
        Button(action: onTap) {
            HStack(spacing: 8) {
                Image(systemName: "exclamationmark.triangle.fill")
                    .font(.system(size: 13, weight: .semibold))
                Text("\(count) memo\(count == 1 ? "" : "s") failed to sync — tap to review")
                    .font(.system(size: 13, weight: .medium))
                    .lineLimit(1)
                Spacer(minLength: 0)
                Image(systemName: "chevron.right")
                    .font(.system(size: 11, weight: .semibold))
            }
            .padding(.horizontal, 14)
            .padding(.vertical, 8)
            .background(Color(red: 0.95, green: 0.6, blue: 0.3).opacity(0.92))
            .foregroundColor(.white)
            .cornerRadius(10)
            .padding(.horizontal, 12)
            .padding(.top, 4)
            .shadow(color: .black.opacity(0.12), radius: 4, y: 1)
        }
        .buttonStyle(.plain)
    }
}

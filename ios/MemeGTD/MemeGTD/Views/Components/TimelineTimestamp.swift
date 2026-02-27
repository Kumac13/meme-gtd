import SwiftUI

/// Shared timestamp view used in both MemoListView and MemoDetailView.
/// Matches the list timeline timestamp style: left-aligned, size 11, systemGray.
struct TimelineTimestamp: View {
    let text: String

    var body: some View {
        Text(text)
            .font(.system(size: 11))
            .foregroundColor(Color(.systemGray))
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.horizontal, 16)
            .padding(.top, 4)
            .padding(.bottom, -2)
    }
}

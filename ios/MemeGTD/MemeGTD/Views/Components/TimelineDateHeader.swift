import SwiftUI

struct TimelineDateHeader: View {
    let bucket: TimelineDateBucket

    var body: some View {
        HStack(spacing: 12) {
            Text(bucket.rawValue)
                .font(.system(size: 13, weight: .medium))
                .foregroundColor(.textSecondary)

            Rectangle()
                .fill(Color(.systemGray4).opacity(0.5))
                .frame(height: 1)
        }
        .padding(.horizontal, 16)
        .padding(.top, 8)
        .padding(.bottom, 2)
    }
}

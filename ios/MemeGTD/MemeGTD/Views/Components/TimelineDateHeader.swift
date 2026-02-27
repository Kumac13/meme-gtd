import SwiftUI

struct TimelineDateHeader: View {
    let bucket: TimelineDateBucket

    var body: some View {
        HStack(spacing: 12) {
            Rectangle()
                .fill(Color.border.opacity(0.5))
                .frame(height: 1)

            Text(bucket.rawValue)
                .font(.caption)
                .fontWeight(.medium)
                .foregroundColor(.textSecondary)
                .layoutPriority(1)

            Rectangle()
                .fill(Color.border.opacity(0.5))
                .frame(height: 1)
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 8)
    }
}

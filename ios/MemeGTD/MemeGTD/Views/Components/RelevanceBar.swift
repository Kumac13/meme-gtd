import SwiftUI

/// A thin horizontal bar showing semantic search relevance score.
struct RelevanceBar: View {
    let score: Double

    private var barColor: Color {
        if score >= 0.70 { return .accent }
        if score >= 0.45 { return Color(hex: "#f59e0b") } // amber
        return Color(.systemGray3)
    }

    private var badgeColor: Color {
        if score >= 0.70 { return .accentDarker }
        if score >= 0.45 { return Color(hex: "#d97706") } // amber-600
        return .textSecondary
    }

    private var percent: Int {
        Int(round(score * 100))
    }

    var body: some View {
        HStack(spacing: 6) {
            GeometryReader { geometry in
                ZStack(alignment: .leading) {
                    RoundedRectangle(cornerRadius: 1)
                        .fill(Color(.systemGray5))
                        .frame(height: 2)

                    RoundedRectangle(cornerRadius: 1)
                        .fill(barColor)
                        .frame(
                            width: geometry.size.width * max(CGFloat(score), 0.05),
                            height: 2
                        )
                }
            }
            .frame(height: 2)

            Text("\(percent)%")
                .font(.system(size: 10, weight: .medium))
                .monospacedDigit()
                .foregroundColor(badgeColor)
                .frame(width: 28, alignment: .trailing)
        }
    }
}

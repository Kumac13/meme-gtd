import SwiftUI

/// Subtle text indicator for semantic search relevance score.
struct RelevanceBar: View {
    let score: Double

    private var badgeColor: Color {
        if score >= 0.70 { return .accentDarker }
        if score >= 0.45 { return Color(hex: "#d97706") } // amber-600
        return .textSecondary
    }

    private var percent: Int {
        Int(round(score * 100))
    }

    var body: some View {
        Text("\(percent)% match")
            .font(.system(size: 10, weight: .medium))
            .monospacedDigit()
            .foregroundColor(badgeColor)
    }
}

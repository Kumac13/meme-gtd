import SwiftUI

extension Color {
    // Initialize from hex string
    init(hex: String) {
        let hex = hex.trimmingCharacters(in: CharacterSet.alphanumerics.inverted)
        var int: UInt64 = 0
        Scanner(string: hex).scanHexInt64(&int)
        let a, r, g, b: UInt64
        switch hex.count {
        case 3: // RGB (12-bit)
            (a, r, g, b) = (255, (int >> 8) * 17, (int >> 4 & 0xF) * 17, (int & 0xF) * 17)
        case 6: // RGB (24-bit)
            (a, r, g, b) = (255, int >> 16, int >> 8 & 0xFF, int & 0xFF)
        case 8: // ARGB (32-bit)
            (a, r, g, b) = (int >> 24, int >> 16 & 0xFF, int >> 8 & 0xFF, int & 0xFF)
        default:
            (a, r, g, b) = (255, 0, 0, 0)
        }
        self.init(
            .sRGB,
            red: Double(r) / 255,
            green: Double(g) / 255,
            blue: Double(b) / 255,
            opacity: Double(a) / 255
        )
    }
}

extension Color {
    // GitHub Green (accent color)
    static let accent = Color(hex: "#2da44e")       // github-green-500
    static let accentDark = Color(hex: "#238636")   // github-green-600
    static let accentDarker = Color(hex: "#1a7f37") // github-green-700

    // Background
    static let appBackground = Color(hex: "#f9fafb") // gray-50
    static let surface = Color.white

    // Text
    static let textPrimary = Color(hex: "#111827")   // gray-900
    static let textSecondary = Color(hex: "#6b7280") // gray-500

    // Border
    static let border = Color(hex: "#d1d5db")        // gray-300
}

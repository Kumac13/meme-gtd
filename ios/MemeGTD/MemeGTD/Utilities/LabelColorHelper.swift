import SwiftUI

/// Shared label color utilities matching Web UI LabelBadge.tsx getLabelColor.
enum LabelColorHelper {
    static func hash(for name: String) -> Int {
        var hash = 0
        for scalar in name.unicodeScalars {
            hash = Int(scalar.value) &+ ((hash << 5) &- hash)
        }
        return abs(hash) % 360
    }

    /// Convert CSS HSL to SwiftUI Color.
    /// CSS hsl(h, s%, l%) uses Hue-Saturation-Lightness.
    /// SwiftUI Color(hue:saturation:brightness:) uses HSB/HSV.
    static func colorFromHSL(h: Double, s: Double, l: Double) -> Color {
        let v = l + s * min(l, 1.0 - l)
        let sv = v == 0 ? 0 : 2.0 * (1.0 - l / v)
        return Color(hue: h, saturation: sv, brightness: v)
    }

    static func bgColor(for name: String) -> Color {
        let hue = Double(hash(for: name)) / 360.0
        // Web UI: hsl(hue, 70%, 85%)
        return colorFromHSL(h: hue, s: 0.70, l: 0.85)
    }

    static func textColor(for name: String) -> Color {
        let hue = Double(hash(for: name)) / 360.0
        // Web UI: hsl(hue, 60%, 25%)
        return colorFromHSL(h: hue, s: 0.60, l: 0.25)
    }
}

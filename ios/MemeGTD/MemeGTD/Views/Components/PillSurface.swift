import SwiftUI

struct PillSurface: ViewModifier {
    let radius: CGFloat

    func body(content: Content) -> some View {
        content
            .clipShape(RoundedRectangle(cornerRadius: radius, style: .continuous))
            .glassEffect(.regular, in: RoundedRectangle(cornerRadius: radius, style: .continuous))
    }
}

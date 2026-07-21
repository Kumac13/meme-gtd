import SwiftUI

struct CompactRelativeTimeText: View {
    let iso: String

    var body: some View {
        Text(TimelineHelpers.compactRelativeTimeString(iso: iso))
            .font(.system(size: 11))
            .foregroundColor(.textSecondary)
    }
}

struct IssueLabelChip: View {
    let name: String

    var body: some View {
        Text(name)
            .font(.system(size: 10, weight: .medium))
            .padding(.horizontal, 6)
            .padding(.vertical, 2)
            .background(Color.accent.opacity(0.12))
            .foregroundColor(.accent)
            .clipShape(RoundedRectangle(cornerRadius: 4))
    }
}

struct IssueLabelChips: View {
    let labels: [String]
    var limit: Int = 3

    var body: some View {
        HStack(spacing: 3) {
            ForEach(labels.prefix(limit), id: \.self) { label in
                IssueLabelChip(name: label)
            }
        }
    }
}

struct IssueTypeBadge: View {
    static let defaultWidth: CGFloat = 56

    let type: String
    var width: CGFloat = Self.defaultWidth

    var body: some View {
        let colors = colors(for: type)
        Text(type.capitalized)
            .font(.system(size: 12, weight: .medium))
            .padding(.horizontal, 8)
            .padding(.vertical, 4)
            .frame(width: width)
            .background(colors.background)
            .foregroundColor(colors.foreground)
            .clipShape(Capsule())
    }

    private func colors(for type: String) -> (background: Color, foreground: Color) {
        switch type {
        case "task":
            return (Color(hex: "#1a7f37"), .white)
        case "memo":
            return (Color(hex: "#dafbe1"), Color(hex: "#1a7f37"))
        case "article":
            return (Color(hex: "#b4e6be"), Color(hex: "#0d5821"))
        default:
            return (Color.accent.opacity(0.15), Color.accentDark)
        }
    }
}

/// 詳細画面を構成する全幅のLiquid Glassカード。
struct IssueAreaCard<Content: View>: View {
    @ViewBuilder let content: () -> Content

    var body: some View {
        content()
            .frame(maxWidth: .infinity)
            .glassEffect(.regular, in: Rectangle())
    }
}

/// 詳細カード間をつなぐ共通のタイムライン線。
struct IssueSectionConnector: View {
    var body: some View {
        Rectangle()
            .fill(Color(.systemGray3))
            .frame(width: 2, height: 12)
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.leading, 24)
            .accessibilityHidden(true)
    }
}

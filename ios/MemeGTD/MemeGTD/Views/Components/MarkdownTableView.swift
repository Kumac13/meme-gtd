import Markdown
import SwiftUI
import UIKit

struct MarkdownTableView: View {
    let table: MarkdownTable
    let color: Color
    let searchQuery: String?
    let issueReferenceTitles: IssueReferenceTitles

    @ScaledMetric private var fontSize: CGFloat
    @ScaledMetric(relativeTo: .body) private var minimumComfortableWidth: CGFloat = 112
    @ScaledMetric(relativeTo: .body) private var maximumColumnWidth: CGFloat = 224
    @State private var availableWidth: CGFloat = 0

    private let horizontalPadding: CGFloat = 10
    private let verticalPadding: CGFloat = 6

    init(
        table: MarkdownTable, fontSize: CGFloat, color: Color, searchQuery: String?,
        issueReferenceTitles: IssueReferenceTitles = .init()
    ) {
        self.table = table
        self.issueReferenceTitles = issueReferenceTitles
        self.color = color
        self.searchQuery = searchQuery
        self._fontSize = ScaledMetric(wrappedValue: fontSize, relativeTo: .body)
    }

    var body: some View {
        let rows = table.rows(issueReferenceTitles: issueReferenceTitles).enumerated().map { rowIndex, row in
            let isHeader = rowIndex == 0
            let font = UIFont.systemFont(ofSize: fontSize, weight: isHeader ? .semibold : .regular)
            let textColor = isHeader ? UIColor.label : UIColor(color)
            return row.enumerated().map { column, cell in
                renderedMarkdownText(cell, font: font, color: textColor,
                                     alignment: alignment(for: column), searchQuery: searchQuery)
            }
        }

        ScrollView(.horizontal) {
            MarkdownTableLayout(columnWidths: columnWidths(for: rows)) {
                ForEach(rows.indices, id: \.self) { row in
                    ForEach(rows[row].indices, id: \.self) { column in
                        cell(rows[row][column], isHeader: row == 0)
                    }
                }
            }
        }
        .scrollBounceBehavior(.basedOnSize, axes: .horizontal)
        .onGeometryChange(for: CGFloat.self, of: { $0.size.width }) { availableWidth = $0 }
        .padding(.vertical, 4)
    }

    private func cell(_ text: NSAttributedString, isHeader: Bool) -> some View {
        SelectableText(content: text)
            .frame(minHeight: UIFont.systemFont(ofSize: fontSize).lineHeight)
            .padding(.horizontal, horizontalPadding)
            .padding(.vertical, verticalPadding)
            .frame(maxHeight: .infinity, alignment: .top)
            .background(isHeader ? Color(.secondarySystemBackground) : Color.clear)
            .border(Color(.separator), width: 0.5)
            .accessibilityAddTraits(isHeader ? .isHeader : [])
    }

    private func alignment(for column: Int) -> NSTextAlignment {
        switch table.alignments[column] {
        case .left: .left
        case .center: .center
        case .right: .right
        case nil: .natural
        }
    }

    private func columnWidths(for rows: [[NSAttributedString]]) -> [CGFloat] {
        let idealWidths = table.alignments.indices.map { column in
            let textWidth = rows.map { $0[column].size().width }.max() ?? 0
            return min(maximumColumnWidth, max(44, ceil(textWidth) + horizontalPadding * 2))
        }
        let idealWidth = idealWidths.reduce(0, +)
        let minimumWidths = idealWidths.map { min($0, minimumComfortableWidth) }
        let minimumWidth = minimumWidths.reduce(0, +)
        guard idealWidth > minimumWidth, availableWidth < idealWidth else { return idealWidths }

        let fraction = max(0, availableWidth - minimumWidth) / (idealWidth - minimumWidth)
        return zip(minimumWidths, idealWidths).map { minimum, ideal in
            minimum + (ideal - minimum) * fraction
        }
    }
}

private struct MarkdownTableLayout: Layout {
    let columnWidths: [CGFloat]

    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
        CGSize(width: columnWidths.reduce(0, +), height: rowHeights(subviews).reduce(0, +))
    }

    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        var y = bounds.minY
        for (row, height) in rowHeights(subviews).enumerated() {
            var x = bounds.minX
            for (column, width) in columnWidths.enumerated() {
                subviews[row * columnWidths.count + column].place(
                    at: CGPoint(x: x, y: y), anchor: .topLeading,
                    proposal: ProposedViewSize(width: width, height: height)
                )
                x += width
            }
            y += height
        }
    }

    private func rowHeights(_ subviews: Subviews) -> [CGFloat] {
        stride(from: 0, to: subviews.count, by: columnWidths.count).map { rowStart in
            columnWidths.enumerated().map { column, width in
                subviews[rowStart + column].sizeThatFits(ProposedViewSize(width: width, height: nil)).height
            }.max() ?? 0
        }
    }
}

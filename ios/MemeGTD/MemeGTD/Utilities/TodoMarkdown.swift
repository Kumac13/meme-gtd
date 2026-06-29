import Foundation

/// Pure functions to manipulate GFM-style task list checkboxes (`- [ ]` / `- [x]`)
/// in a markdown body. Mirrors the TypeScript implementation in
/// `packages/web/src/utils/todoMarkdown.ts` (Web has additional reorder support).
enum TodoMarkdown {
    struct TodoItem {
        let todoIndex: Int
        let lineIndex: Int
        let indent: Int
        let checked: Bool
    }

    private static let todoLineRegex: NSRegularExpression = {
        // (?<indent>^\s*)(?<marker>[-*+])(?<spaceAfterMarker>\s+)\[(?<box> |x|X)\](?<spaceAfterBox>\s+)
        // We compile the simpler non-named pattern.
        try! NSRegularExpression(pattern: #"^(\s*)([-*+])(\s+)\[([ xX])\](\s+)"#)
    }()

    private static let fenceRegex: NSRegularExpression = {
        try! NSRegularExpression(pattern: #"^\s*(```|~~~)"#)
    }()

    private static let blockquoteRegex: NSRegularExpression = {
        try! NSRegularExpression(pattern: #"^\s*>"#)
    }()

    /// Returns the list of interactive todo items in document order, skipping
    /// code fences and blockquotes.
    static func enumerateTodos(_ md: String) -> [TodoItem] {
        let lines = md.components(separatedBy: "\n")
        var items: [TodoItem] = []
        var inFence = false
        var fenceMarker: String? = nil

        for (i, line) in lines.enumerated() {
            let range = NSRange(line.startIndex..<line.endIndex, in: line)

            if let m = fenceRegex.firstMatch(in: line, range: range), let r = Range(m.range(at: 1), in: line) {
                let marker = String(line[r])
                if !inFence {
                    inFence = true
                    fenceMarker = marker
                } else if marker == fenceMarker {
                    inFence = false
                    fenceMarker = nil
                }
                continue
            }
            if inFence { continue }
            if blockquoteRegex.firstMatch(in: line, range: range) != nil { continue }

            if let m = todoLineRegex.firstMatch(in: line, range: range),
               let indentRange = Range(m.range(at: 1), in: line),
               let boxRange = Range(m.range(at: 4), in: line) {
                let indent = line.distance(from: indentRange.lowerBound, to: indentRange.upperBound)
                let boxChar = line[boxRange]
                let checked = boxChar == "x" || boxChar == "X"
                items.append(TodoItem(
                    todoIndex: items.count,
                    lineIndex: i,
                    indent: indent,
                    checked: checked,
                ))
            }
        }

        return items
    }

    /// Flips the `[ ]` / `[x]` character of the N-th todo. Returns the new markdown,
    /// or `nil` if the index is out of range.
    static func toggleTodo(_ md: String, at todoIndex: Int) -> String? {
        let items = enumerateTodos(md)
        guard todoIndex >= 0, todoIndex < items.count else { return nil }
        let target = items[todoIndex]

        var lines = md.components(separatedBy: "\n")
        guard target.lineIndex < lines.count else { return nil }
        let line = lines[target.lineIndex]
        let range = NSRange(line.startIndex..<line.endIndex, in: line)
        guard let m = todoLineRegex.firstMatch(in: line, range: range) else { return nil }

        // Match groups: (indent)(marker)(space)(box)(space). Position of box char:
        let indentLen = m.range(at: 1).length
        let markerLen = m.range(at: 2).length
        let spaceLen = m.range(at: 3).length
        let charPos = indentLen + markerLen + spaceLen + 1 // skip opening '['

        let utf16Chars = Array(line.utf16)
        guard charPos < utf16Chars.count else { return nil }
        var modified = utf16Chars
        modified[charPos] = target.checked ? UInt16(UnicodeScalar(" ").value) : UInt16(UnicodeScalar("x").value)
        lines[target.lineIndex] = String(utf16CodeUnits: modified, count: modified.count)

        return lines.joined(separator: "\n")
    }
}

// MARK: - Body-replacement helpers

extension TaskItem {
    /// Returns a copy of this TaskItem with `bodyMd` replaced. Used for optimistic UI
    /// updates when toggling todos in the task body.
    func withBody(_ newBody: String) -> TaskItem {
        return TaskItem(
            id: id,
            type: type,
            title: title,
            bodyMd: newBody,
            status: status,
            taskKind: taskKind,
            scheduledStart: scheduledStart,
            scheduledEnd: scheduledEnd,
            isAllDay: isAllDay,
            actualStart: actualStart,
            actualEnd: actualEnd,
            scheduledOn: scheduledOn,
            startTime: startTime,
            endDate: endDate,
            endTime: endTime,
            duration: duration,
            isBookmarked: isBookmarked,
            isDeleted: isDeleted,
            createdAt: createdAt,
            updatedAt: updatedAt,
            labels: labels,
            commentCount: commentCount,
            preview: preview,
            projectIds: projectIds,
            linkIds: linkIds,
        )
    }
}

extension Comment {
    /// Returns a copy of this Comment with `bodyMd` replaced. Used for optimistic UI
    /// updates when toggling todos inside comments.
    func withBody(_ newBody: String) -> Comment {
        return Comment(
            id: id,
            issueId: issueId,
            bodyMd: newBody,
            createdAt: createdAt,
            updatedAt: updatedAt,
        )
    }
}

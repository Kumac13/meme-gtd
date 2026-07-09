import Foundation

/// A W3C TextQuoteSelector: the highlighted text plus surrounding context.
/// Mirrors the Web `QuoteSelector` in `packages/web/src/utils/highlightAnchor.ts`.
struct QuoteSelector {
    let exact: String
    let prefix: String?
    let suffix: String?
}

/// TextQuoteSelector anchoring over a plain string (a rendered block's visible
/// text). The article body is an immutable snapshot rendered deterministically,
/// so a highlight is anchored by its exact text plus context — no offsets.
///
/// iOS renders per block, so matching runs within a single block's text. The
/// exact-unique-match path resolves Web-created highlights even when the stored
/// prefix/suffix span the whole body (they are only used to disambiguate
/// repeats). Uses NSString/NSRange throughout to line up with UITextView.
enum HighlightAnchor {
    static let contextLength = 32

    /// Derive a quote from a selected range within `text`.
    static func computeQuote(text: NSString, selectedRange: NSRange) -> QuoteSelector? {
        guard selectedRange.length > 0,
              selectedRange.location >= 0,
              selectedRange.location + selectedRange.length <= text.length
        else { return nil }

        let exact = text.substring(with: selectedRange)
        if exact.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty { return nil }

        let prefixStart = max(0, selectedRange.location - contextLength)
        let prefix = text.substring(with: NSRange(location: prefixStart, length: selectedRange.location - prefixStart))

        let afterExact = selectedRange.location + selectedRange.length
        let suffixLen = min(contextLength, text.length - afterExact)
        let suffix = text.substring(with: NSRange(location: afterExact, length: suffixLen))

        return QuoteSelector(
            exact: exact,
            prefix: prefix.isEmpty ? nil : prefix,
            suffix: suffix.isEmpty ? nil : suffix
        )
    }

    /// Locate a quote within `text`, disambiguating repeats by context.
    /// Returns the NSRange of `exact`, or nil if not found.
    static func locate(_ quote: QuoteSelector, in text: NSString) -> NSRange? {
        let prefix = quote.prefix ?? ""
        let suffix = quote.suffix ?? ""
        let exact = quote.exact as NSString

        // 1. prefix + exact + suffix as one contiguous match (most precise).
        if !prefix.isEmpty || !suffix.isEmpty {
            let combined = prefix + quote.exact + suffix
            let r = text.range(of: combined)
            if r.location != NSNotFound {
                return NSRange(location: r.location + (prefix as NSString).length, length: exact.length)
            }
        }

        // 2. All occurrences of exact, scored by surrounding context.
        var occurrences: [NSRange] = []
        var searchStart = 0
        while searchStart <= text.length {
            let r = text.range(
                of: quote.exact,
                options: [],
                range: NSRange(location: searchStart, length: text.length - searchStart)
            )
            if r.location == NSNotFound { break }
            occurrences.append(r)
            searchStart = r.location + 1
        }

        if occurrences.count == 1 { return occurrences[0] }
        if occurrences.count > 1 {
            var best = occurrences[0]
            var bestScore = -1
            for r in occurrences {
                var score = 0
                if !prefix.isEmpty {
                    let bStart = max(0, r.location - (prefix as NSString).length)
                    let before = text.substring(with: NSRange(location: bStart, length: r.location - bStart))
                    if before.hasSuffix(prefix) { score += (prefix as NSString).length }
                }
                if !suffix.isEmpty {
                    let after0 = r.location + r.length
                    let aLen = min((suffix as NSString).length, text.length - after0)
                    let after = text.substring(with: NSRange(location: after0, length: aLen))
                    if after.hasPrefix(suffix) { score += (suffix as NSString).length }
                }
                if score > bestScore { bestScore = score; best = r }
            }
            return best
        }

        return nil
    }
}

import Foundation

/// A text highlight on an article body. Hand-written mirror of the API's
/// `HighlightSchema` (`packages/api/src/schemas/highlightSchemas.ts`).
///
/// Anchored with a W3C TextQuoteSelector: `exact` is the highlighted text,
/// `prefix`/`suffix` are the surrounding context that disambiguate repeats.
/// The article body is an immutable snapshot, so the quote alone is a robust
/// anchor (no character offsets).
struct Highlight: Codable, Identifiable {
    let id: Int
    let issueId: Int
    let exact: String
    let prefix: String?
    let suffix: String?
    let color: String
    let createdAt: String
    let updatedAt: String
    let commentCount: Int?
}

struct CreateHighlightRequest: Codable {
    let exact: String
    let prefix: String?
    let suffix: String?
    let color: String?

    init(exact: String, prefix: String? = nil, suffix: String? = nil, color: String? = nil) {
        self.exact = exact
        self.prefix = prefix
        self.suffix = suffix
        self.color = color
    }
}

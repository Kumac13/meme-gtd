/**
 * Parse search queries into filter objects
 *
 * The search query is now purely free-text search.
 * Label and status filtering is handled via dedicated dropdown UI controls.
 *
 * @example
 * parseSearchQuery("login screen")
 * // Returns: { freeText: "login screen" }
 */

export interface ParsedSearchQuery {
  freeText?: string;
  rawQuery?: string;
}

/**
 * Parse a search query string into structured filters
 */
export function parseSearchQuery(query: string): ParsedSearchQuery {
  if (!query || query.trim() === '') {
    return {};
  }

  return {
    rawQuery: query,
    freeText: query.trim() || undefined,
  };
}

/**
 * Parse GitHub-style search queries into filter objects
 *
 * Supported syntax:
 * - label:bug → Filter by single label
 * - label:bug,enhancement → Filter by multiple labels (OR logic)
 * - status:open → Filter by status
 * - label:bug status:open → Combine filters (AND logic)
 *
 * @example
 * parseSearchQuery("label:bug status:open")
 * // Returns: { labels: ["bug"], status: "open" }
 */

export interface ParsedSearchQuery {
  labels?: string[];
  status?: string;
  rawQuery?: string;
}

/**
 * Parse a search query string into structured filters
 */
export function parseSearchQuery(query: string): ParsedSearchQuery {
  if (!query || query.trim() === '') {
    return {};
  }

  const result: ParsedSearchQuery = {
    rawQuery: query,
  };

  // Extract label: filters
  const labelMatches = query.match(/label:([^\s]+)/g);
  if (labelMatches) {
    const allLabels: string[] = [];
    labelMatches.forEach(match => {
      // Extract value after "label:"
      const value = match.substring(6); // "label:".length === 6
      // Split by comma and trim each label
      const labels = value.split(',').map(l => l.trim()).filter(Boolean);
      allLabels.push(...labels);
    });
    if (allLabels.length > 0) {
      result.labels = allLabels;
    }
  }

  // Extract status: filter
  const statusMatch = query.match(/status:([^\s,]+)/);
  if (statusMatch) {
    result.status = statusMatch[1];
  }

  return result;
}

/**
 * Build a search query string from filter objects
 */
export function buildSearchQuery(filters: ParsedSearchQuery): string {
  const parts: string[] = [];

  if (filters.labels && filters.labels.length > 0) {
    parts.push(`label:${filters.labels.join(',')}`);
  }

  if (filters.status) {
    parts.push(`status:${filters.status}`);
  }

  return parts.join(' ');
}

/**
 * Validate if a status value is valid
 */
export function isValidStatus(status: string): boolean {
  const validStatuses = ['open', 'next', 'waiting', 'scheduled', 'done', 'canceled'];
  return validStatuses.includes(status);
}

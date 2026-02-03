import type { IssueType } from 'meme-gtd-shared';

/**
 * Parse GitHub-style search queries into filter objects
 *
 * Supported syntax:
 * - label:bug → Filter by single label
 * - label:bug,enhancement → Filter by multiple labels (OR logic)
 * - status:open → Filter by status
 * - label:bug status:open → Combine filters (AND logic)
 * - Free-text terms → Search in title/body (e.g., "login screen")
 *
 * @example
 * parseSearchQuery("label:bug status:open login screen")
 * // Returns: { labels: ["bug"], status: "open", freeText: "login screen" }
 */

export interface ParsedSearchQuery {
  labels?: string[];
  status?: string;
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

  const result: ParsedSearchQuery = {
    rawQuery: query,
  };

  // Extract label: filters
  const labelMatches = query.match(/label:([^\s]+)/gi);
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

  // Extract free-text (remove all key:value patterns)
  const freeText = query
    .replace(/\w+:[^\s]+/g, '')  // Remove structured filters
    .trim();

  if (freeText) {
    result.freeText = freeText;
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

  if (filters.freeText) {
    parts.push(filters.freeText);
  }

  return parts.join(' ');
}

/**
 * Validate if a status value is valid
 */
export function isValidStatus(status: string): boolean {
  const validStatuses = ['inbox', 'open', 'next', 'waiting', 'scheduled', 'someday', 'done', 'canceled'];
  return validStatuses.includes(status);
}

export interface QueryValidationError {
  type: 'syntax' | 'status' | 'warning';
  message: string;
}

interface ValidateOptions {
  itemType?: IssueType;
}

/**
 * Validate search query syntax and return errors if any
 */
export function validateSearchQuery(query: string, options: ValidateOptions = {}): QueryValidationError | null {
  if (!query || query.trim() === '') {
    return null;
  }

  // Check for common syntax errors: using = instead of :
  const invalidSyntax = query.match(/\b(label|status)=([^\s]*)/i);
  if (invalidSyntax) {
    const keyword = invalidSyntax[1].toLowerCase();
    const value = invalidSyntax[2];
    return {
      type: 'syntax',
      message: `Invalid syntax: "${invalidSyntax[0]}". Use colon instead: ${keyword}:${value}`,
    };
  }

  const parsed = parseSearchQuery(query);

  // Warning for status filter on memos/articles
  if ((options.itemType === 'memo' || options.itemType === 'article') && parsed.status) {
    return {
      type: 'warning',
      message: `Note: Status filters do not apply to ${options.itemType}s`,
    };
  }

  // Validate status value if present
  if (parsed.status && !isValidStatus(parsed.status)) {
    return {
      type: 'status',
      message: `Invalid status: "${parsed.status}". Valid: inbox, open, next, waiting, scheduled, someday, done, canceled`,
    };
  }

  return null;
}

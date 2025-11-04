/**
 * URL Query Parameter Helpers for Tasks Page Filter State
 *
 * This file defines the TypeScript types and validation functions for
 * URL-based filter state management on the /tasks/ page.
 *
 * @see specs/021-tasks-status-url/data-model.md for detailed parameter specifications
 */

/**
 * Valid task status filter values
 */
export const VALID_STATUSES = [
  'open',
  'next',
  'waiting',
  'scheduled',
  'done',
  'canceled',
] as const;

/**
 * Task status filter type (includes 'all' as default state)
 */
export type StatusFilter = typeof VALID_STATUSES[number] | 'all';

/**
 * Bookmark filter type
 */
export type BookmarkFilter = boolean;

/**
 * Validates and parses the 'status' URL parameter
 *
 * @param value - Raw value from URLSearchParams.get('status')
 * @returns Validated status filter or 'all' if invalid/absent
 *
 * @example
 * validateStatus('open') // 'open'
 * validateStatus('invalid') // 'all'
 * validateStatus(null) // 'all'
 */
export function validateStatus(value: string | null): StatusFilter {
  if (!value) return 'all';
  return VALID_STATUSES.includes(value as any) ? (value as StatusFilter) : 'all';
}

/**
 * Validates and parses the 'bookmarked' URL parameter
 *
 * @param value - Raw value from URLSearchParams.get('bookmarked')
 * @returns true if value is exactly 'true', false otherwise
 *
 * @example
 * validateBookmarked('true') // true
 * validateBookmarked('false') // false
 * validateBookmarked('yes') // false
 * validateBookmarked(null) // false
 */
export function validateBookmarked(value: string | null): BookmarkFilter {
  return value === 'true';
}

/**
 * Updates only the status filter in URLSearchParams
 *
 * @param currentParams - Current URLSearchParams object
 * @param newStatus - New status filter value
 * @returns New URLSearchParams object with updated status
 */
export function updateStatusParam(
  currentParams: URLSearchParams,
  newStatus: StatusFilter
): URLSearchParams {
  const params = new URLSearchParams(currentParams);

  if (newStatus === 'all') {
    params.delete('status');
  } else {
    params.set('status', newStatus);
  }

  return params;
}

/**
 * Updates only the bookmark filter in URLSearchParams
 *
 * @param currentParams - Current URLSearchParams object
 * @param newBookmarked - New bookmark filter value
 * @returns New URLSearchParams object with updated bookmark
 */
export function updateBookmarkedParam(
  currentParams: URLSearchParams,
  newBookmarked: BookmarkFilter
): URLSearchParams {
  const params = new URLSearchParams(currentParams);

  if (newBookmarked) {
    params.set('bookmarked', 'true');
  } else {
    params.delete('bookmarked');
  }

  return params;
}

/**
 * Updates the search query parameter in URLSearchParams
 *
 * @param currentParams - Current URLSearchParams object
 * @param searchQuery - New search query string (e.g., "label:bug status:open")
 * @returns New URLSearchParams object with updated query
 */
export function updateSearchParam(
  currentParams: URLSearchParams,
  searchQuery: string
): URLSearchParams {
  const params = new URLSearchParams(currentParams);

  if (searchQuery && searchQuery.trim() !== '') {
    params.set('q', searchQuery);
  } else {
    params.delete('q');
  }

  return params;
}

/**
 * Gets the search query from URLSearchParams
 *
 * @param params - URLSearchParams object
 * @returns Search query string or empty string if not present
 */
export function getSearchParam(params: URLSearchParams): string {
  return params.get('q') || '';
}

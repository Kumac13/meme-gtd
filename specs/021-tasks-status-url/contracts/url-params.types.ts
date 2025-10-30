/**
 * URL Query Parameter Types for Tasks Page Filter State
 *
 * This file defines the TypeScript types and validation functions for
 * URL-based filter state management on the /tasks/ page.
 *
 * @see data-model.md for detailed parameter specifications
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
 * Complete filter state derived from URL parameters
 */
export interface TasksFilterState {
  status: StatusFilter;
  bookmarked: BookmarkFilter;
}

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
 * Parses complete filter state from URLSearchParams
 *
 * @param searchParams - URLSearchParams object from useSearchParams()
 * @returns Validated filter state object
 *
 * @example
 * const [searchParams] = useSearchParams();
 * const filters = parseFiltersFromURL(searchParams);
 * // { status: 'open', bookmarked: true }
 */
export function parseFiltersFromURL(searchParams: URLSearchParams): TasksFilterState {
  return {
    status: validateStatus(searchParams.get('status')),
    bookmarked: validateBookmarked(searchParams.get('bookmarked')),
  };
}

/**
 * Updates URLSearchParams with new filter values
 *
 * @param currentParams - Current URLSearchParams object
 * @param newStatus - New status filter value
 * @param newBookmarked - New bookmark filter value
 * @returns New URLSearchParams object with updated values
 *
 * @example
 * const params = new URLSearchParams();
 * const updated = updateFilterParams(params, 'open', true);
 * // URLSearchParams { 'status' => 'open', 'bookmarked' => 'true' }
 *
 * @example
 * // Removing default values (clean URLs)
 * const updated = updateFilterParams(params, 'all', false);
 * // URLSearchParams {} (empty)
 */
export function updateFilterParams(
  currentParams: URLSearchParams,
  newStatus: StatusFilter,
  newBookmarked: BookmarkFilter
): URLSearchParams {
  const params = new URLSearchParams(currentParams);

  // Handle status parameter
  if (newStatus === 'all') {
    params.delete('status'); // Clean URL for default state
  } else {
    params.set('status', newStatus);
  }

  // Handle bookmarked parameter
  if (newBookmarked) {
    params.set('bookmarked', 'true');
  } else {
    params.delete('bookmarked'); // Clean URL for default state
  }

  return params;
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

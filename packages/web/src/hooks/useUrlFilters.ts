import { useSearchParams } from 'react-router-dom';
import { parseSearchQuery, type ParsedSearchQuery } from '../utils/queryParser';
import {
  validateStatus,
  validateBookmarked,
  updateSearchParam,
  getSearchParam,
  type StatusFilter,
  type BookmarkFilter,
} from '../utils/urlFilterHelpers';

export interface UrlFilters {
  searchQuery: string;
  parsedQuery: ParsedSearchQuery;
  status: StatusFilter;
  bookmarked: BookmarkFilter;
}

export interface UrlFiltersActions {
  setSearchQuery: (query: string) => void;
  setStatus: (status: StatusFilter) => void;
  setBookmarked: (bookmarked: BookmarkFilter) => void;
  clearFilters: () => void;
}

/**
 * Hook to manage filter state synchronized with URL search parameters
 *
 * Manages the following URL parameters:
 * - q: Search query (e.g., "label:bug status:open")
 * - status: Task status filter
 * - bookmarked: Bookmark filter
 *
 * @example
 * const { filters, actions } = useUrlFilters();
 * actions.setSearchQuery('label:bug');
 * // URL becomes: ?q=label:bug
 *
 * @returns Object with current filters and actions to update them
 */
export function useUrlFilters(): { filters: UrlFilters; actions: UrlFiltersActions } {
  const [searchParams, setSearchParams] = useSearchParams();

  // Parse current URL parameters
  const searchQuery = getSearchParam(searchParams);
  const parsedQuery = parseSearchQuery(searchQuery);
  const status = validateStatus(searchParams.get('status'));
  const bookmarked = validateBookmarked(searchParams.get('bookmarked'));

  const filters: UrlFilters = {
    searchQuery,
    parsedQuery,
    status,
    bookmarked,
  };

  const actions: UrlFiltersActions = {
    setSearchQuery: (query: string) => {
      setSearchParams(updateSearchParam(searchParams, query), { replace: true });
    },

    setStatus: (newStatus: StatusFilter) => {
      const params = new URLSearchParams(searchParams);
      if (newStatus === 'all') {
        params.delete('status');
      } else {
        params.set('status', newStatus);
      }
      setSearchParams(params, { replace: true });
    },

    setBookmarked: (newBookmarked: BookmarkFilter) => {
      const params = new URLSearchParams(searchParams);
      if (newBookmarked) {
        params.set('bookmarked', 'true');
      } else {
        params.delete('bookmarked');
      }
      setSearchParams(params, { replace: true });
    },

    clearFilters: () => {
      setSearchParams(new URLSearchParams(), { replace: true });
    },
  };

  return { filters, actions };
}

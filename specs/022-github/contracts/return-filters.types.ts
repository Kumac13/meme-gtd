/**
 * Type definitions for return filter preservation in item detail navigation
 *
 * @see ../data-model.md for complete data model documentation
 * @see ../../021-tasks-status-url/ for related PR #65 filter types
 */

/**
 * Item types supporting filter preservation
 */
export type ItemType = 'task' | 'memo' | 'project';

/**
 * Filter map for return navigation
 * Keys are filter parameter names (e.g., 'status', 'bookmarked')
 * Values are string representations of filter values
 */
export type FilterMap = Record<string, string>;

/**
 * Encoded return filter context in URL
 */
export interface ReturnFilterContext {
  /** Type of item (determines valid filter parameters) */
  itemType: ItemType;
  /** Filter parameters from the originating list page */
  filters: FilterMap;
}

/**
 * Validation result for return filter parameters
 */
export interface FilterValidationResult {
  /** Whether the filters are valid after sanitization */
  valid: boolean;
  /** Sanitized filter map (only whitelisted parameters with valid values) */
  sanitizedFilters?: FilterMap;
  /** Error message if validation failed */
  error?: string;
}

/**
 * Configuration for creating item detail URLs with return filters
 */
export interface ItemDetailUrlConfig {
  /** Base path for the item type (e.g., '/tasks/', '/memos/') */
  basePath: string;
  /** Item ID */
  itemId: number | string;
  /** Current filter state from list page (optional) */
  currentFilters?: URLSearchParams;
}

/**
 * Configuration for creating back-to-list URLs from detail pages
 */
export interface BackUrlConfig {
  /** Base path for the item type (e.g., '/tasks/', '/memos/') */
  basePath: string;
  /** Encoded return filters from URL parameter (optional) */
  returnFiltersEncoded?: string | null;
}

/**
 * Result of decoding return filters from URL
 */
export interface DecodedReturnFilters {
  /** Whether decoding succeeded */
  success: boolean;
  /** Decoded and validated filter map */
  filters: FilterMap;
  /** Error message if decoding failed */
  error?: string;
}

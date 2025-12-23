/**
 * Navigation helpers for filter preservation across item list/detail pages
 */

/** Item types supporting filter preservation */
type ItemType = 'task' | 'memo' | 'project';

/** Filter map for return navigation */
type FilterMap = Record<string, string>;

/** Result of decoding return filters from URL */
interface DecodedReturnFilters {
  success: boolean;
  filters: FilterMap;
  error?: string;
}

/** Configuration for creating item detail URLs with return filters */
interface ItemDetailUrlConfig {
  basePath: string;
  itemId: number | string;
  currentFilters?: URLSearchParams;
}

/** Configuration for creating back-to-list URLs from detail pages */
interface BackUrlConfig {
  basePath: string;
  returnFiltersEncoded?: string | null;
}

/**
 * Encodes current filter state for inclusion in detail page URL
 *
 * @param currentFilters - URLSearchParams from list page
 * @returns URL-encoded string for returnFilters parameter
 *
 * @example
 * const filters = new URLSearchParams('status=open&bookmarked=true');
 * encodeReturnFilters(filters); // 'status=open&bookmarked=true'
 */
export function encodeReturnFilters(currentFilters: URLSearchParams): string {
  // Whitelist: only allow 'status' and 'bookmarked' parameters
  const allowedParams = ['status', 'bookmarked'];
  const filtered = new URLSearchParams();

  allowedParams.forEach((param) => {
    const value = currentFilters.get(param);
    if (value) {
      filtered.set(param, value);
    }
  });

  return filtered.toString();
}

/**
 * Decodes and validates return filter parameters from URL
 *
 * @param encoded - Encoded returnFilters string from URL
 * @param itemType - Type of item (determines valid filter parameters)
 * @returns Decoded filters with validation result
 *
 * @example
 * decodeReturnFilters('status=open', 'task');
 * // { success: true, filters: { status: 'open' }, error: undefined }
 */
export function decodeReturnFilters(
  encoded: string,
  itemType: ItemType
): DecodedReturnFilters {
  try {
    const params = new URLSearchParams(encoded);
    const filters: FilterMap = {};

    // Item-type-specific parameter whitelist
    const allowedParams = itemType === 'task'
      ? ['status', 'bookmarked']
      : ['bookmarked'];

    allowedParams.forEach((param) => {
      const value = params.get(param);
      if (value) {
        filters[param] = value;
      }
    });

    // Log validation if filters were sanitized
    const originalParamCount = Array.from(params.keys()).length;
    const filteredParamCount = Object.keys(filters).length;

    if (originalParamCount > filteredParamCount) {
      console.error('[ReturnFilters] Validation removed invalid parameters:', {
        itemType,
        encoded,
        allowedParams,
        timestamp: new Date().toISOString(),
      });
    }

    return {
      success: true,
      filters,
    };
  } catch (error) {
    console.error('[ReturnFilters] Decoding failed:', {
      itemType,
      encoded,
      error: error instanceof Error ? error.message : String(error),
      timestamp: new Date().toISOString(),
    });

    return {
      success: false,
      filters: {},
      error: 'Decoding failed',
    };
  }
}

/**
 * Creates item detail URL with return filter context
 *
 * @param config - Configuration for detail URL
 * @returns Complete URL with returnFilters parameter
 *
 * @example
 * createItemDetailUrl({
 *   basePath: '/tasks/',
 *   itemId: 123,
 *   currentFilters: new URLSearchParams('status=open')
 * });
 * // '/tasks/123?returnFilters=status%3Dopen'
 */
export function createItemDetailUrl(config: ItemDetailUrlConfig): string {
  const { basePath, itemId, currentFilters } = config;

  // Base URL without trailing slash
  const basePathClean = basePath.endsWith('/') ? basePath.slice(0, -1) : basePath;
  const detailUrl = `${basePathClean}/${itemId}`;

  // If no filters, return plain detail URL
  if (!currentFilters || currentFilters.toString() === '') {
    return detailUrl;
  }

  // Encode and append return filters
  const encodedFilters = encodeReturnFilters(currentFilters);
  if (encodedFilters === '') {
    return detailUrl;
  }

  return `${detailUrl}?returnFilters=${encodeURIComponent(encodedFilters)}`;
}

/**
 * Creates back-to-list URL with restored filters
 *
 * @param config - Configuration for back URL
 * @returns Complete list URL with restored filters
 *
 * @example
 * createBackUrl({
 *   basePath: '/tasks/',
 *   returnFiltersEncoded: 'status%3Dopen'
 * });
 * // '/tasks/?status=open'
 */
export function createBackUrl(config: BackUrlConfig): string {
  const { basePath, returnFiltersEncoded } = config;

  // If no return filters, use base path
  if (!returnFiltersEncoded || returnFiltersEncoded === '') {
    return basePath;
  }

  // Decode the URI component and append to base path
  try {
    const decoded = decodeURIComponent(returnFiltersEncoded);
    return `${basePath}?${decoded}`;
  } catch (error) {
    // If decoding fails, fall back to base path
    console.error('[ReturnFilters] Failed to decode returnFilters for back URL:', {
      returnFiltersEncoded,
      error: error instanceof Error ? error.message : String(error),
      timestamp: new Date().toISOString(),
    });
    return basePath;
  }
}

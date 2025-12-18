/**
 * Pagination Component
 *
 * GitHub style pagination with:
 * - Previous/Next with chevron icons
 * - Page numbers with current page highlighted
 * - Ellipsis for large page counts
 */

interface PaginationProps {
  /** Current page number (1-indexed) */
  currentPage: number;
  /** Total number of pages */
  totalPages: number;
  /** Callback when page changes */
  onPageChange: (page: number) => void;
}

/**
 * Generate array of page numbers to display with ellipsis
 */
function getPageNumbers(currentPage: number, totalPages: number): (number | 'ellipsis')[] {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }

  const pages: (number | 'ellipsis')[] = [];

  // Always show first page
  pages.push(1);

  if (currentPage > 3) {
    pages.push('ellipsis');
  }

  // Pages around current
  const start = Math.max(2, currentPage - 1);
  const end = Math.min(totalPages - 1, currentPage + 1);

  for (let i = start; i <= end; i++) {
    pages.push(i);
  }

  if (currentPage < totalPages - 2) {
    pages.push('ellipsis');
  }

  // Always show last page
  if (totalPages > 1) {
    pages.push(totalPages);
  }

  return pages;
}

export default function Pagination({
  currentPage,
  totalPages,
  onPageChange,
}: PaginationProps) {
  if (totalPages <= 1) {
    return null;
  }

  const pageNumbers = getPageNumbers(currentPage, totalPages);
  const hasPrevious = currentPage > 1;
  const hasNext = currentPage < totalPages;

  return (
    <nav
      className="flex items-center justify-center gap-2 mt-6"
      aria-label="Pagination"
    >
      {/* Previous Button */}
      <button
        onClick={() => onPageChange(currentPage - 1)}
        disabled={!hasPrevious}
        className={`flex items-center gap-1 px-2 py-1 text-sm ${
          hasPrevious
            ? 'text-github-green-500 hover:text-github-green-600 cursor-pointer'
            : 'text-gray-400 cursor-not-allowed'
        }`}
        aria-label="Previous page"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Previous
      </button>

      {/* Page Numbers */}
      <div className="flex items-center gap-1">
        {pageNumbers.map((page, index) => {
          if (page === 'ellipsis') {
            return (
              <span
                key={`ellipsis-${index}`}
                className="px-2 py-1 text-sm text-gray-400"
              >
                ...
              </span>
            );
          }

          const isCurrentPage = page === currentPage;
          return (
            <button
              key={page}
              onClick={() => onPageChange(page)}
              disabled={isCurrentPage}
              className={`min-w-[2rem] px-3 py-1 text-sm rounded-md ${
                isCurrentPage
                  ? 'bg-github-green-600 text-white font-medium'
                  : 'text-gray-300 hover:bg-gray-700'
              }`}
              aria-label={`Page ${page}`}
              aria-current={isCurrentPage ? 'page' : undefined}
            >
              {page}
            </button>
          );
        })}
      </div>

      {/* Next Button */}
      <button
        onClick={() => onPageChange(currentPage + 1)}
        disabled={!hasNext}
        className={`flex items-center gap-1 px-2 py-1 text-sm ${
          hasNext
            ? 'text-github-green-500 hover:text-github-green-600 cursor-pointer'
            : 'text-gray-400 cursor-not-allowed'
        }`}
        aria-label="Next page"
      >
        Next
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </button>
    </nav>
  );
}

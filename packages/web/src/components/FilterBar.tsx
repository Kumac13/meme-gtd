interface FilterBarProps {
  showStatusFilter?: boolean;
  statusFilter?: string;
  bookmarkFilter?: boolean;
  onStatusFilterChange?: (status: string) => void;
  onBookmarkFilterChange?: (bookmarked: boolean) => void;
  statusOptions?: string[];
  statusLabels?: Record<string, string>;
  showBookmarkFilter?: boolean;
}

const defaultStatusLabels: Record<string, string> = {
  inbox: 'Inbox',
  open: 'Open',
  next: 'Next',
  waiting: 'Waiting',
  scheduled: 'Scheduled',
  someday: 'Someday',
  done: 'Done',
  canceled: 'Canceled',
};

const defaultStatusOptions = ['all', 'inbox', 'open', 'next', 'waiting', 'scheduled', 'someday', 'done', 'canceled'];

export default function FilterBar({
  showStatusFilter = false,
  statusFilter = 'all',
  bookmarkFilter = false,
  onStatusFilterChange,
  onBookmarkFilterChange,
  statusOptions = defaultStatusOptions,
  statusLabels = defaultStatusLabels,
  showBookmarkFilter = true,
}: FilterBarProps) {
  return (
    <div className="mb-6 flex flex-wrap gap-2">
      {/* Bookmark filter */}
      {showBookmarkFilter && onBookmarkFilterChange && (
        <button
          onClick={() => onBookmarkFilterChange(!bookmarkFilter)}
          className={`px-3 py-1 rounded-lg text-sm font-medium transition-all ${
            bookmarkFilter
              ? 'bg-github-green-600 text-white shadow-raised'
              : 'bg-gray-100/80 text-gray-700 shadow-inner-highlight hover:bg-gray-200/80'
          }`}
        >
          Bookmarked
        </button>
      )}

      {/* Status filter */}
      {showStatusFilter && onStatusFilterChange && (
        <>
          {statusOptions.map((status) => (
            <button
              key={status}
              onClick={() => onStatusFilterChange(status)}
              className={`px-3 py-1 rounded-lg text-sm font-medium transition-all ${
                statusFilter === status
                  ? 'bg-github-green-600 text-white shadow-raised'
                  : 'bg-gray-100/80 text-gray-700 shadow-inner-highlight hover:bg-gray-200/80'
              }`}
            >
              {status === 'all' ? 'All' : statusLabels[status] || status}
            </button>
          ))}
        </>
      )}
    </div>
  );
}

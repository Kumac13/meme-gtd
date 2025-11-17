interface FilterBarProps {
  showStatusFilter?: boolean;
  statusFilter?: string;
  bookmarkFilter: boolean;
  onStatusFilterChange?: (status: string) => void;
  onBookmarkFilterChange: (bookmarked: boolean) => void;
}

const statusLabels: Record<string, string> = {
  inbox: 'Inbox',
  open: 'Open',
  next: 'Next',
  waiting: 'Waiting',
  scheduled: 'Scheduled',
  someday: 'Someday',
  done: 'Done',
  canceled: 'Canceled',
};

export default function FilterBar({
  showStatusFilter = false,
  statusFilter = 'all',
  bookmarkFilter,
  onStatusFilterChange,
  onBookmarkFilterChange,
}: FilterBarProps) {
  return (
    <div className="mb-6 flex flex-wrap gap-2">
      {/* Bookmark filter */}
      <button
        onClick={() => onBookmarkFilterChange(!bookmarkFilter)}
        className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
          bookmarkFilter
            ? 'bg-github-green-600 text-white'
            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
        }`}
      >
        Bookmarked
      </button>

      {/* Status filter (tasks only) */}
      {showStatusFilter && onStatusFilterChange && (
        <>
          {['all', 'inbox', 'open', 'next', 'waiting', 'scheduled', 'someday', 'done', 'canceled'].map((status) => (
            <button
              key={status}
              onClick={() => onStatusFilterChange(status)}
              className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                statusFilter === status
                  ? 'bg-github-green-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
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

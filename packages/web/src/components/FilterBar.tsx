import { ToggleFilterButton } from './FilterControls';

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
        <ToggleFilterButton active={bookmarkFilter} onToggle={() => onBookmarkFilterChange(!bookmarkFilter)}>Bookmarked</ToggleFilterButton>
      )}

      {/* Status filter */}
      {showStatusFilter && onStatusFilterChange && (
        <>
          {statusOptions.map((status) => (
            <ToggleFilterButton
              key={status}
              onToggle={() => onStatusFilterChange(status)}
              active={statusFilter === status}
            >
              {status === 'all' ? 'All' : statusLabels[status] || status}
            </ToggleFilterButton>
          ))}
        </>
      )}
    </div>
  );
}

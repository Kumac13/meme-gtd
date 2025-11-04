import { useState, useEffect, useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { MemosService } from '../api/services/MemosService';
import ItemList from '../components/ItemList';
import FilterBar from '../components/FilterBar';
import SearchInput from '../components/SearchInput';
import LoadingState from '../components/LoadingState';
import ErrorState from '../components/ErrorState';
import EmptyState from '../components/EmptyState';
import { useUrlFilters } from '../hooks/useUrlFilters';
import { validateBookmarked, updateBookmarkedParam } from '../utils/urlFilterHelpers';

interface Memo {
  id: number;
  title: string | null;
  bodyMd: string;
  isBookmarked: boolean;
  commentCount?: number;
  labels?: string[];
  createdAt: string;
  updatedAt: string;
}

export default function MemosList() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { filters, actions } = useUrlFilters();
  const bookmarkFilter = validateBookmarked(searchParams.get('bookmarked'));

  const [memos, setMemos] = useState<Memo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchMemos() {
      try {
        setLoading(true);
        setError(null);

        // Build label parameter from parsed query
        const labelParam = filters.parsedQuery.labels?.join(',');

        const response = await MemosService.listMemos(undefined, labelParam);
        setMemos(response || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load memos');
        console.error('Error fetching memos:', err);
      } finally {
        setLoading(false);
      }
    }

    fetchMemos();
  }, [filters.searchQuery]);

  const filteredMemos = useMemo(() => {
    return memos.filter((memo) => {
      if (bookmarkFilter && !memo.isBookmarked) return false;
      return true;
    });
  }, [memos, bookmarkFilter]);

  const handleBookmarkFilterChange = (newBookmarked: boolean) => {
    const params = updateBookmarkedParam(searchParams, newBookmarked);
    setSearchParams(params);
  };

  const handleDelete = async (id: number) => {
    await MemosService.deleteMemo(String(id));
    setMemos(memos.filter((memo) => memo.id !== id));
  };

  if (loading) {
    return <LoadingState message="Loading memos..." />;
  }

  if (error) {
    return <ErrorState error={error} title="Error loading memos" />;
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-2">
      <div className="flex items-center gap-2 mb-4">
        <SearchInput
          value={filters.searchQuery}
          onChange={actions.setSearchQuery}
          placeholder="Search memos"
          itemType="memo"
        />
        <Link
          to="/memos/new"
          className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-github-green-600 hover:bg-github-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-github-green-500 whitespace-nowrap"
        >
          New Memo
        </Link>
      </div>

      <FilterBar
        bookmarkFilter={bookmarkFilter}
        onBookmarkFilterChange={handleBookmarkFilterChange}
      />

      {filteredMemos.length === 0 ? (
        <EmptyState
          message={bookmarkFilter ? 'No bookmarked memos' : 'No memos yet'}
          submessage={!bookmarkFilter ? 'Create your first memo to get started' : undefined}
        />
      ) : (
        <ItemList items={filteredMemos} itemType="memo" basePath="/memos" currentFilters={searchParams} onDelete={handleDelete} />
      )}
    </div>
  );
}

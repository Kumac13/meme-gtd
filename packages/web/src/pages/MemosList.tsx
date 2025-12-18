import { useState, useEffect, useMemo, useCallback } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { MemosService } from '../api/services/MemosService';
import ItemList from '../components/ItemList';
import FilterBar from '../components/FilterBar';
import SearchInput from '../components/SearchInput';
import LoadingState from '../components/LoadingState';
import ErrorState from '../components/ErrorState';
import EmptyState from '../components/EmptyState';
import Pagination from '../components/Pagination';
import { useUrlFilters } from '../hooks/useUrlFilters';
import { validateBookmarked, updateBookmarkedParam } from '../utils/urlFilterHelpers';
import { useDocumentTitle } from '../hooks/useDocumentTitle';

interface Memo {
  id: number;
  title: string | null;
  bodyMd: string;
  isBookmarked: boolean;
  commentCount?: number;
  labels?: string[];
  preview?: string;
  createdAt: string;
  updatedAt: string;
}

const PAGE_SIZE = 20;

export default function MemosList() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { filters, actions } = useUrlFilters();
  const bookmarkFilter = validateBookmarked(searchParams.get('bookmarked'));

  // Pagination state from URL
  const currentPage = Math.max(1, parseInt(searchParams.get('page') || '1', 10));

  // Set document title for memos list
  useDocumentTitle('Memos');

  const [memos, setMemos] = useState<Memo[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const totalPages = Math.ceil(total / PAGE_SIZE);

  useEffect(() => {
    async function fetchMemos() {
      try {
        setLoading(true);
        setError(null);

        // Build label parameter from parsed query
        const labelParam = filters.parsedQuery.labels?.join(',');

        // Extract free-text search from parsed query
        const searchParam = filters.parsedQuery.freeText;

        // Calculate offset for pagination
        const offset = (currentPage - 1) * PAGE_SIZE;

        const response = await MemosService.listMemos(
          undefined,
          labelParam,
          searchParam,
          PAGE_SIZE,
          offset
        );
        setMemos(response?.data || []);
        setTotal(response?.total || 0);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load memos');
        console.error('Error fetching memos:', err);
      } finally {
        setLoading(false);
      }
    }

    fetchMemos();
  }, [filters.searchQuery, currentPage]);

  const filteredMemos = useMemo(() => {
    return memos.filter((memo) => {
      if (bookmarkFilter && !memo.isBookmarked) return false;
      return true;
    });
  }, [memos, bookmarkFilter]);

  const handleBookmarkFilterChange = (newBookmarked: boolean) => {
    const params = updateBookmarkedParam(searchParams, newBookmarked);
    params.delete('page'); // Reset to page 1
    setSearchParams(params);
  };

  const handlePageChange = useCallback((page: number) => {
    const params = new URLSearchParams(searchParams);
    if (page === 1) {
      params.delete('page');
    } else {
      params.set('page', String(page));
    }
    setSearchParams(params);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [searchParams, setSearchParams]);

  const handleDelete = async (id: number) => {
    await MemosService.deleteMemo(String(id));
    setMemos(memos.filter((memo) => memo.id !== id));
    setTotal(prev => prev - 1);
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
          onChange={(value) => {
            actions.setSearchQuery(value);
            // Reset to page 1 when searching
            const params = new URLSearchParams(searchParams);
            params.delete('page');
            setSearchParams(params);
          }}
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
        <>
          <div className="text-sm text-gray-500 mb-2">
            {total} {total === 1 ? 'memo' : 'memos'}
          </div>
          <ItemList items={filteredMemos} itemType="memo" basePath="/memos" currentFilters={searchParams} onDelete={handleDelete} />
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={handlePageChange}
          />
        </>
      )}
    </div>
  );
}

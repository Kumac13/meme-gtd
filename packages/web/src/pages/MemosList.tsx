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
import { validateBookmarked, updateBookmarkedParam, updateSearchParam } from '../utils/urlFilterHelpers';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { MarkdownRenderer } from '../utils/markdown';
import MobileFloatingComposer from '../components/MobileFloatingComposer';
import { createItemDetailUrl } from '../utils/navigationHelpers';
import { LabelBadge } from '../components/LabelBadge';
import {
  formatTimelineTime,
  getTimelineDateBucket,
  shouldShowGapTimestamp,
} from '../utils/memoTimeline';

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
  const { filters } = useUrlFilters();
  const bookmarkFilter = validateBookmarked(searchParams.get('bookmarked'));

  // Pagination state from URL
  const currentPage = Math.max(1, parseInt(searchParams.get('page') || '1', 10));

  // Set document title for memos list
  useDocumentTitle('Memos');

  const [memos, setMemos] = useState<Memo[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [newMemoBody, setNewMemoBody] = useState('');
  const [creatingMemo, setCreatingMemo] = useState(false);

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

  const handleLoadMore = useCallback(async () => {
    if (loadingMore || memos.length >= total) return;

    try {
      setLoadingMore(true);

      const labelParam = filters.parsedQuery.labels?.join(',');
      const searchParam = filters.parsedQuery.freeText;
      const response = await MemosService.listMemos(
        undefined,
        labelParam,
        searchParam,
        PAGE_SIZE,
        memos.length
      );

      setMemos((prev) => [...prev, ...(response?.data || [])]);
      setTotal(response?.total || 0);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load more memos');
      console.error('Error loading more memos:', err);
    } finally {
      setLoadingMore(false);
    }
  }, [filters.parsedQuery.freeText, filters.parsedQuery.labels, loadingMore, memos.length, total]);

  const handleCreateMemo = useCallback(async () => {
    const bodyMd = newMemoBody.trim();
    if (!bodyMd || creatingMemo) return;

    try {
      setCreatingMemo(true);
      const created = await MemosService.createMemo({ bodyMd });
      setMemos((prev) => [created as Memo, ...prev]);
      setTotal((prev) => prev + 1);
      setNewMemoBody('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create memo');
      console.error('Error creating memo:', err);
    } finally {
      setCreatingMemo(false);
    }
  }, [creatingMemo, newMemoBody]);

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
    <div className="max-w-4xl mx-auto min-h-screen bg-white px-4 py-2 sm:min-h-0 sm:bg-transparent">
      <div className="flex items-center gap-2 mb-4">
        <SearchInput
          value={filters.searchQuery}
          onChange={(value) => {
            const params = updateSearchParam(searchParams, value);
            params.delete('page');
            setSearchParams(params);
          }}
          placeholder="Search memos"
          itemType="memo"
        />
        <Link
          to="/memos/new"
          className="hidden sm:inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-github-green-600 hover:bg-github-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-github-green-500 whitespace-nowrap"
        >
          New Memo
        </Link>
      </div>

      <FilterBar
        bookmarkFilter={bookmarkFilter}
        onBookmarkFilterChange={handleBookmarkFilterChange}
      />

      <div className="text-sm text-gray-500 mb-2">
        {total} {total === 1 ? 'memo' : 'memos'}
      </div>

      <div className="sm:hidden pb-[calc(env(safe-area-inset-bottom,0px)+128px)]">
        {filteredMemos.length === 0 ? (
          <EmptyState
            message={bookmarkFilter ? 'No bookmarked memos' : 'No memos yet'}
            submessage={!bookmarkFilter ? 'Create your first memo to get started' : undefined}
          />
        ) : (
          <>
            <div>
              {filteredMemos.map((memo, index) => {
                const prev = index > 0 ? filteredMemos[index - 1] : null;
                const currentBucket = getTimelineDateBucket(memo.createdAt);
                const previousBucket = prev ? getTimelineDateBucket(prev.createdAt) : null;
                const itemPath = createItemDetailUrl({ basePath: '/memos', itemId: memo.id, currentFilters: searchParams });

                return (
                  <div key={memo.id} className="py-1.5">
                    {currentBucket !== previousBucket && (
                      <div className="flex items-center gap-3 py-2">
                        <span className="text-[13px] font-medium text-gray-500">{currentBucket}</span>
                        <span className="h-px flex-1 bg-gray-200" />
                      </div>
                    )}
                    {(currentBucket !== previousBucket || shouldShowGapTimestamp(prev?.createdAt ?? null, memo.createdAt)) && (
                      <div className="pb-0.5 text-[11px] text-gray-400">{formatTimelineTime(memo.createdAt)}</div>
                    )}

                    <div className="flex items-start gap-2.5">
                      <Link to={itemPath} className="min-w-0 flex-1">
                        <div className="prose prose-sm prose-p:mb-2 prose-li:my-0 prose-p:text-[13px] prose-p:leading-6 max-w-none break-words text-gray-700">
                          <MarkdownRenderer content={memo.bodyMd} />
                        </div>
                        {memo.labels && memo.labels.length > 0 && (
                          <div className="mt-1.5 flex flex-wrap gap-1">
                            {memo.labels.map((label) => (
                              <LabelBadge key={`${memo.id}-${label}`} name={label} />
                            ))}
                          </div>
                        )}
                      </Link>

                      {(memo.commentCount ?? 0) > 0 && (
                        <Link to={itemPath} className="mt-0.5 flex items-center gap-1 text-[11px] text-gray-500">
                          <svg className="h-3.5 w-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
                            <path d="M2.5 2.5h11v8h-4l-3 3v-3h-4z" />
                          </svg>
                          {memo.commentCount ?? 0}
                        </Link>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {memos.length < total && (
              <div className="pt-4">
                <button
                  type="button"
                  onClick={handleLoadMore}
                  disabled={loadingMore}
                  className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {loadingMore ? 'Loading...' : 'Load more'}
                </button>
              </div>
            )}
          </>
        )}

        <MobileFloatingComposer
          value={newMemoBody}
          onChange={setNewMemoBody}
          onSubmit={handleCreateMemo}
          placeholder="Write a memo..."
          submitLabel="Create memo"
          disabled={creatingMemo}
          submitting={creatingMemo}
        />
      </div>

      <div className="hidden sm:block">
        {filteredMemos.length === 0 ? (
          <EmptyState
            message={bookmarkFilter ? 'No bookmarked memos' : 'No memos yet'}
            submessage={!bookmarkFilter ? 'Create your first memo to get started' : undefined}
          />
        ) : (
          <>
            <ItemList items={filteredMemos} itemType="memo" basePath="/memos" currentFilters={searchParams} onDelete={handleDelete} />
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={handlePageChange}
            />
          </>
        )}
      </div>
    </div>
  );
}

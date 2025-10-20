import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { MemosService } from '../api/services/MemosService';
import ItemList from '../components/ItemList';
import FilterBar from '../components/FilterBar';
import LoadingState from '../components/LoadingState';
import ErrorState from '../components/ErrorState';
import EmptyState from '../components/EmptyState';

interface Memo {
  id: number;
  title: string | null;
  bodyMd: string;
  isBookmarked: boolean;
  commentCount?: number;
  createdAt: string;
  updatedAt: string;
}

export default function MemosList() {
  const [memos, setMemos] = useState<Memo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [bookmarkFilter, setBookmarkFilter] = useState(false);

  useEffect(() => {
    async function fetchMemos() {
      try {
        setLoading(true);
        setError(null);
        const response = await MemosService.listMemos();
        setMemos(response || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load memos');
        console.error('Error fetching memos:', err);
      } finally {
        setLoading(false);
      }
    }

    fetchMemos();
  }, []);

  const filteredMemos = useMemo(() => {
    return memos.filter((memo) => {
      if (bookmarkFilter && !memo.isBookmarked) return false;
      return true;
    });
  }, [memos, bookmarkFilter]);

  if (loading) {
    return <LoadingState message="Loading memos..." />;
  }

  if (error) {
    return <ErrorState error={error} title="Error loading memos" />;
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="flex items-center justify-end mb-6">
        <Link
          to="/memos/new"
          className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
        >
          New Memo
        </Link>
      </div>

      <FilterBar
        bookmarkFilter={bookmarkFilter}
        onBookmarkFilterChange={setBookmarkFilter}
      />

      {filteredMemos.length === 0 ? (
        <EmptyState
          message={bookmarkFilter ? 'No bookmarked memos' : 'No memos yet'}
          submessage={!bookmarkFilter ? 'Create your first memo to get started' : undefined}
        />
      ) : (
        <ItemList items={filteredMemos} itemType="memo" basePath="/memos" />
      )}
    </div>
  );
}

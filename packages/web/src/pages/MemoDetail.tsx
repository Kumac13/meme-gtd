import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import type { IssueType } from 'meme-gtd-shared';
import { MemosService } from '../api/services/MemosService';
import ItemDetail, { type Item } from '../components/ItemDetail';
import { ItemDetailPanel } from '../components/ItemDetailPanel';
import LoadingState from '../components/LoadingState';
import ErrorState from '../components/ErrorState';
import { useDocumentTitle, truncateForTitle } from '../hooks/useDocumentTitle';

interface Memo {
  id: number;
  title: string | null;
  bodyMd: string;
  isBookmarked: boolean;
  labels?: string[];
  createdAt: string;
  updatedAt: string;
}

export default function MemoDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [memo, setMemo] = useState<Memo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [bookmarking, setBookmarking] = useState(false);
  const [selectedItem, setSelectedItem] = useState<{ id: number; type: IssueType } | null>(null);

  // Set document title based on memo body preview (memos don't have titles)
  const titleText = memo?.bodyMd ? truncateForTitle(memo.bodyMd) : null;
  useDocumentTitle(titleText);

  useEffect(() => {
    async function fetchMemo() {
      if (!id) {
        setError('Memo ID is required');
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);
        const response = await MemosService.getMemo(id);
        setMemo(response as Memo);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load memo');
        console.error('Error fetching memo:', err);
      } finally {
        setLoading(false);
      }
    }

    fetchMemo();
  }, [id]);

  const handleDelete = async () => {
    if (!id) return;

    try {
      setDeleting(true);
      await MemosService.deleteMemo(id);
      navigate('/memos');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete memo');
      console.error('Error deleting memo:', err);
      setDeleting(false);
    }
  };

  const handleBookmarkToggle = async () => {
    if (!id || !memo) return;

    try {
      setBookmarking(true);
      if (memo.isBookmarked) {
        await MemosService.unbookmarkMemo(id);
      } else {
        await MemosService.bookmarkMemo(id);
      }
      setMemo({ ...memo, isBookmarked: !memo.isBookmarked });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update bookmark');
      console.error('Error toggling bookmark:', err);
    } finally {
      setBookmarking(false);
    }
  };

  const handleItemClick = useCallback((itemId: number, itemType: IssueType) => {
    setSelectedItem({ id: itemId, type: itemType });
  }, []);

  const handlePanelClose = useCallback(() => {
    setSelectedItem(null);
  }, []);

  if (loading) {
    return <LoadingState message="Loading memo..." />;
  }

  if (error || !memo) {
    return <ErrorState error={error || 'Memo not found'} title="Error loading memo" />;
  }

  const handleUpdate = (updatedItem: Item) => {
    setMemo(updatedItem as Memo);
  };

  // Sidebar action for promoting to task
  const sidebarActions = (
    <Link
      to={`/tasks/new?fromMemo=${id}`}
      className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900"
    >
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
      </svg>
      Promote to Task
    </Link>
  );

  return (
    <>
      <ItemDetail
        item={memo}
        itemType="memo"
        onDelete={handleDelete}
        onBookmarkToggle={handleBookmarkToggle}
        onUpdate={handleUpdate}
        deleting={deleting}
        bookmarking={bookmarking}
        sidebarActions={sidebarActions}
        onItemClick={handleItemClick}
      />
      <ItemDetailPanel
        itemId={selectedItem?.id ?? null}
        itemType={selectedItem?.type ?? null}
        onClose={handlePanelClose}
      />
    </>
  );
}

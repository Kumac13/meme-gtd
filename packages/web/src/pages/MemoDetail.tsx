import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { MemosService } from '../api/services/MemosService';
import ItemDetail from '../components/ItemDetail';
import LoadingState from '../components/LoadingState';
import ErrorState from '../components/ErrorState';

interface Label {
  name: string;
  color: string;
}

interface Memo {
  id: number;
  title: string | null;
  bodyMd: string;
  isBookmarked: boolean;
  labels?: Label[];
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

  if (loading) {
    return <LoadingState message="Loading memo..." />;
  }

  if (error || !memo) {
    return <ErrorState error={error || 'Memo not found'} title="Error loading memo" />;
  }

  return (
    <ItemDetail
      item={memo}
      itemType="memo"
      basePath="/memos"
      onDelete={handleDelete}
      onBookmarkToggle={handleBookmarkToggle}
      deleting={deleting}
      bookmarking={bookmarking}
    />
  );
}

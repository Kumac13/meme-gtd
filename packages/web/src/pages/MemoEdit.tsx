import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { MemosService } from '../api/services/MemosService';
import MemoForm from '../components/MemoForm';
import LoadingState from '../components/LoadingState';
import ErrorState from '../components/ErrorState';

interface Memo {
  id: number;
  title: string | null;
  bodyMd: string;
  createdAt: string;
  updatedAt: string;
}

export default function MemoEdit() {
  const { id } = useParams<{ id: string }>();
  const [memo, setMemo] = useState<Memo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  if (loading) {
    return <LoadingState message="Loading memo..." />;
  }

  if (error || !memo) {
    return <ErrorState error={error || 'Memo not found'} title="Error loading memo" />;
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-2">
      <div className="mb-6">
        <Link
          to={`/memos/${memo.id}`}
          className="text-github-green-600 hover:text-github-green-800 text-sm font-medium mb-4 inline-block"
        >
          ← Back to memo
        </Link>
        <h1 className="text-3xl font-bold text-gray-900">
          Edit {memo.title || `Memo #${memo.id}`}
        </h1>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <MemoForm mode="edit" memoId={memo.id} initialBodyMd={memo.bodyMd} />
      </div>
    </div>
  );
}

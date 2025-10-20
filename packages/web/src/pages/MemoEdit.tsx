import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { MemosService } from '../api/services/MemosService';
import MemoForm from '../components/MemoForm';

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
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <p className="mt-2 text-gray-600">Loading memo...</p>
        </div>
      </div>
    );
  }

  if (error || !memo) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-start">
            <div className="flex-shrink-0">
              <span className="text-red-600 text-xl">⚠</span>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">Error loading memo</h3>
              <p className="mt-1 text-sm text-red-700">{error || 'Memo not found'}</p>
            </div>
          </div>
        </div>
        <div className="mt-4">
          <Link
            to="/memos"
            className="text-blue-600 hover:text-blue-800 text-sm font-medium"
          >
            ← Back to memos
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="mb-6">
        <Link
          to={`/memos/${memo.id}`}
          className="text-blue-600 hover:text-blue-800 text-sm font-medium mb-4 inline-block"
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

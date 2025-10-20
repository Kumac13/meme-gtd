import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { MemosService } from '../api/services/MemosService';
import { formatDateTime } from '../utils/dates';
import { MarkdownRenderer } from '../utils/markdown';

interface Memo {
  id: number;
  title: string | null;
  bodyMd: string;
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
    if (!id || !memo) return;

    const confirmDelete = window.confirm(
      `Are you sure you want to delete "${memo.title || `Memo #${memo.id}`}"? This action cannot be undone.`
    );

    if (!confirmDelete) return;

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

  if (error) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-start">
            <div className="flex-shrink-0">
              <span className="text-red-600 text-xl">⚠</span>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">Error loading memo</h3>
              <p className="mt-1 text-sm text-red-700">{error}</p>
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

  if (!memo) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <p className="text-gray-500">Memo not found</p>
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
      {/* Header with actions */}
      <div className="mb-6">
        <Link
          to="/memos"
          className="text-blue-600 hover:text-blue-800 text-sm font-medium mb-4 inline-block"
        >
          ← Back to memos
        </Link>
        <div className="flex items-start justify-between">
          <h1 className="text-3xl font-bold text-gray-900">{memo.title || `Memo #${memo.id}`}</h1>
          <div className="flex space-x-2">
            <Link
              to={`/memos/${memo.id}/edit`}
              className="inline-flex items-center px-3 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              Edit
            </Link>
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="inline-flex items-center px-3 py-2 border border-red-300 rounded-md shadow-sm text-sm font-medium text-red-700 bg-white hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {deleting ? 'Deleting...' : 'Delete'}
            </button>
          </div>
        </div>
      </div>

      {/* Metadata */}
      <div className="mb-6 flex items-center text-sm text-gray-500 space-x-4 border-b border-gray-200 pb-4">
        <span>Created: {formatDateTime(memo.createdAt)}</span>
        {memo.updatedAt !== memo.createdAt && (
          <span>Updated: {formatDateTime(memo.updatedAt)}</span>
        )}
      </div>

      {/* Body content */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        {memo.bodyMd ? (
          <div className="prose prose-sm max-w-none">
            <MarkdownRenderer content={memo.bodyMd} />
          </div>
        ) : (
          <p className="text-gray-400 italic">No content</p>
        )}
      </div>
    </div>
  );
}

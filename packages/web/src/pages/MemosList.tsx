import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { MemosService } from '../api/services/MemosService';
import { formatDateTime, formatRelativeTime } from '../utils/dates';
import { truncateMarkdown } from '../utils/markdown';

interface Memo {
  id: number;
  title: string | null;
  bodyMd: string;
  createdAt: string;
  updatedAt: string;
}

export default function MemosList() {
  const [memos, setMemos] = useState<Memo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <p className="mt-2 text-gray-600">Loading memos...</p>
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
              <h3 className="text-sm font-medium text-red-800">Error loading memos</h3>
              <p className="mt-1 text-sm text-red-700">{error}</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Memos</h1>
        <Link
          to="/memos/new"
          className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
        >
          New Memo
        </Link>
      </div>

      {memos.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg">
          <p className="text-gray-500 text-lg">No memos yet</p>
          <p className="text-gray-400 text-sm mt-2">Create your first memo to get started</p>
        </div>
      ) : (
        <div className="space-y-4">
          {memos.map((memo) => (
            <Link
              key={memo.id}
              to={`/memos/${memo.id}`}
              className="block bg-white border border-gray-200 rounded-lg p-6 hover:border-blue-400 hover:shadow-md transition-all"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h2 className="text-xl font-semibold text-gray-900 mb-2">
                    {memo.title || `Memo #${memo.id}`}
                  </h2>
                  {memo.bodyMd && (
                    <p className="text-gray-600 text-sm line-clamp-2">
                      {truncateMarkdown(memo.bodyMd, 150)}
                    </p>
                  )}
                </div>
              </div>
              <div className="mt-4 flex items-center text-xs text-gray-500 space-x-4">
                <span title={formatDateTime(memo.createdAt)}>
                  Created {formatRelativeTime(memo.createdAt)}
                </span>
                {memo.updatedAt !== memo.createdAt && (
                  <span title={formatDateTime(memo.updatedAt)}>
                    Updated {formatRelativeTime(memo.updatedAt)}
                  </span>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

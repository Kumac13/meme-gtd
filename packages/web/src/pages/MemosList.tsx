import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { MemosService } from '../api/services/MemosService';
import { formatDateTime, formatRelativeTime } from '../utils/dates';
import { truncateMarkdown } from '../utils/markdown';

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
      <div className="flex items-center justify-end mb-6">
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
        <div className="bg-white border border-gray-200 rounded-lg divide-y divide-gray-200">
          {memos.map((memo) => (
            <Link
              key={memo.id}
              to={`/memos/${memo.id}`}
              className="block p-4 hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-gray-900 text-sm mb-2">
                    {truncateMarkdown(memo.bodyMd, 150)}
                  </p>
                  <div className="flex items-center text-xs text-gray-500 space-x-3">
                    <span>#{memo.id}</span>
                    <span title={formatDateTime(memo.createdAt)}>
                      {formatRelativeTime(memo.createdAt)}
                    </span>
                    {(memo.commentCount ?? 0) > 0 && (
                      <span className="flex items-center gap-1">
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 16 16">
                          <path d="M1 2.75C1 1.784 1.784 1 2.75 1h10.5c.966 0 1.75.784 1.75 1.75v7.5A1.75 1.75 0 0 1 13.25 12H9.06l-2.573 2.573A1.458 1.458 0 0 1 4 13.543V12H2.75A1.75 1.75 0 0 1 1 10.25Zm1.75-.25a.25.25 0 0 0-.25.25v7.5c0 .138.112.25.25.25h2a.75.75 0 0 1 .75.75v2.19l2.72-2.72a.749.749 0 0 1 .53-.22h4.5a.25.25 0 0 0 .25-.25v-7.5a.25.25 0 0 0-.25-.25Z"></path>
                        </svg>
                        {memo.commentCount ?? 0}
                      </span>
                    )}
                    {memo.isBookmarked && (
                      <span className="flex items-center gap-1 text-yellow-600">
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 16 16">
                          <path d="M8 .25a.75.75 0 0 1 .673.418l1.882 3.815 4.21.612a.75.75 0 0 1 .416 1.279l-3.046 2.97.719 4.192a.751.751 0 0 1-1.088.791L8 12.347l-3.766 1.98a.75.75 0 0 1-1.088-.79l.72-4.194L.818 6.374a.75.75 0 0 1 .416-1.28l4.21-.611L7.327.668A.75.75 0 0 1 8 .25Z"></path>
                        </svg>
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

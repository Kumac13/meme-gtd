import { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { MemosService } from '../api/services/MemosService';
import TaskForm from '../components/TaskForm';
import LoadingState from '../components/LoadingState';
import ErrorState from '../components/ErrorState';

export default function TaskNew() {
  const [searchParams] = useSearchParams();
  const fromMemoId = searchParams.get('fromMemo');

  const [memo, setMemo] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (fromMemoId && fromMemoId !== null) {
      async function fetchMemo() {
        try {
          setLoading(true);
          setError(null);
          const data = await MemosService.getMemo(fromMemoId as string);
          setMemo(data);
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Failed to load memo');
          console.error('Error fetching memo:', err);
        } finally {
          setLoading(false);
        }
      }
      fetchMemo();
    }
  }, [fromMemoId]);

  if (loading) {
    return <LoadingState message="Loading memo..." />;
  }

  if (error) {
    return <ErrorState error={error} title="Error loading memo" />;
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-2">
      <div className="mb-6">
        <Link
          to="/tasks"
          className="text-github-green-600 hover:text-github-green-800 text-sm font-medium mb-4 inline-block"
        >
          ← Back to tasks
        </Link>
        <h1 className="text-3xl font-bold text-gray-900">
          {memo ? 'Promote Memo to Task' : 'Create New Task'}
        </h1>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <TaskForm
          mode="create"
          initialBodyMd={memo?.bodyMd}
          fromMemoId={memo?.id}
        />
      </div>
    </div>
  );
}

import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { TasksService } from '../api/services/TasksService';
import { formatDateTime } from '../utils/dates';
import { MarkdownRenderer } from '../utils/markdown';

interface Label {
  name: string;
  color: string;
}

interface Task {
  id: number;
  title: string | null;
  bodyMd: string;
  status: string | null;
  isBookmarked: boolean;
  scheduledOn: string | null;
  labels?: Label[];
  createdAt: string;
  updatedAt: string;
}

export default function TaskDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [task, setTask] = useState<Task | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [bookmarking, setBookmarking] = useState(false);

  useEffect(() => {
    async function fetchTask() {
      if (!id) {
        setError('Task ID is required');
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);
        const response = await TasksService.getTask(id);
        setTask(response as Task);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load task');
        console.error('Error fetching task:', err);
      } finally {
        setLoading(false);
      }
    }

    fetchTask();
  }, [id]);

  const handleDelete = async () => {
    if (!id || !task) return;

    const confirmDelete = window.confirm(
      `Are you sure you want to delete "${task.title || `Task #${task.id}`}"? This action cannot be undone.`
    );

    if (!confirmDelete) return;

    try {
      setDeleting(true);
      await TasksService.deleteTask(id);
      navigate('/tasks');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete task');
      console.error('Error deleting task:', err);
      setDeleting(false);
    }
  };

  const handleBookmarkToggle = async () => {
    if (!id || !task) return;

    try {
      setBookmarking(true);
      if (task.isBookmarked) {
        await TasksService.unbookmarkTask(id);
      } else {
        await TasksService.bookmarkTask(id);
      }
      // Update local state
      setTask({ ...task, isBookmarked: !task.isBookmarked });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update bookmark');
      console.error('Error toggling bookmark:', err);
    } finally {
      setBookmarking(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <p className="mt-2 text-gray-600">Loading task...</p>
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
              <h3 className="text-sm font-medium text-red-800">Error loading task</h3>
              <p className="mt-1 text-sm text-red-700">{error}</p>
            </div>
          </div>
        </div>
        <div className="mt-4">
          <Link
            to="/tasks"
            className="text-blue-600 hover:text-blue-800 text-sm font-medium"
          >
            ← Back to tasks
          </Link>
        </div>
      </div>
    );
  }

  if (!task) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <p className="text-gray-500">Task not found</p>
        <div className="mt-4">
          <Link
            to="/tasks"
            className="text-blue-600 hover:text-blue-800 text-sm font-medium"
          >
            ← Back to tasks
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
          to="/tasks"
          className="text-blue-600 hover:text-blue-800 text-sm font-medium mb-4 inline-block"
        >
          ← Back to tasks
        </Link>
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2 flex-wrap">
              <h1 className="text-3xl font-bold text-gray-900">
                {task.title || `Task #${task.id}`}
              </h1>
              {task.labels && task.labels.length > 0 && (
                <>
                  {task.labels.map((label, idx) => (
                    <span
                      key={idx}
                      className="px-3 py-1 text-sm font-medium rounded"
                      style={{
                        backgroundColor: `#${label.color}`,
                        color: '#000',
                      }}
                    >
                      {label.name}
                    </span>
                  ))}
                </>
              )}
            </div>
          </div>
          <div className="flex space-x-2">
            <button
              onClick={handleBookmarkToggle}
              disabled={bookmarking}
              className="inline-flex items-center px-3 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {bookmarking ? 'Loading...' : task.isBookmarked ? 'Unbookmark' : 'Bookmark'}
            </button>
            <Link
              to={`/tasks/${task.id}/edit`}
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
        {task.scheduledOn && (
          <span className="font-medium text-gray-700">
            Scheduled: {formatDateTime(task.scheduledOn).split(' ')[0]}
          </span>
        )}
        <span>Created: {formatDateTime(task.createdAt)}</span>
        {task.updatedAt !== task.createdAt && (
          <span>Updated: {formatDateTime(task.updatedAt)}</span>
        )}
      </div>

      {/* Body content */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        {task.bodyMd ? (
          <div className="prose prose-sm max-w-none">
            <MarkdownRenderer content={task.bodyMd} />
          </div>
        ) : (
          <p className="text-gray-400 italic">No description</p>
        )}
      </div>
    </div>
  );
}

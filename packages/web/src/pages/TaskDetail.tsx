import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { TasksService } from '../api/services/TasksService';
import { formatDateTime } from '../utils/dates';
import { MarkdownRenderer } from '../utils/markdown';

interface Task {
  id: number;
  title: string | null;
  bodyMd: string;
  status: string | null;
  scheduledOn: string | null;
  createdAt: string;
  updatedAt: string;
}

const statusColors: Record<string, string> = {
  open: 'bg-blue-100 text-blue-800',
  next: 'bg-purple-100 text-purple-800',
  waiting: 'bg-orange-100 text-orange-800',
  scheduled: 'bg-cyan-100 text-cyan-800',
  done: 'bg-green-100 text-green-800',
  canceled: 'bg-gray-100 text-gray-800',
};

const statusLabels: Record<string, string> = {
  open: 'Open',
  next: 'Next',
  waiting: 'Waiting',
  scheduled: 'Scheduled',
  done: 'Done',
  canceled: 'Canceled',
};

export default function TaskDetail() {
  const { id } = useParams<{ id: string }>();
  const [task, setTask] = useState<Task | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-3xl font-bold text-gray-900">
                {task.title || `Task #${task.id}`}
              </h1>
              {task.status && (
                <span
                  className={`px-3 py-1 text-sm font-medium rounded ${
                    statusColors[task.status] || 'bg-gray-100 text-gray-800'
                  }`}
                >
                  {statusLabels[task.status] || task.status}
                </span>
              )}
            </div>
          </div>
          <div className="flex space-x-2">
            <Link
              to={`/tasks/${task.id}/edit`}
              className="inline-flex items-center px-3 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              Edit
            </Link>
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

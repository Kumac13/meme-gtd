import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { TasksService } from '../api/services/TasksService';
import { formatDateTime, formatRelativeTime } from '../utils/dates';
import { truncateMarkdown } from '../utils/markdown';

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

export default function TasksList() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('all');

  useEffect(() => {
    async function fetchTasks() {
      try {
        setLoading(true);
        setError(null);
        const response = await TasksService.listTasks(
          statusFilter !== 'all' ? (statusFilter as 'open' | 'next' | 'waiting' | 'scheduled' | 'done' | 'canceled') : undefined
        );
        setTasks(response || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load tasks');
        console.error('Error fetching tasks:', err);
      } finally {
        setLoading(false);
      }
    }

    fetchTasks();
  }, [statusFilter]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <p className="mt-2 text-gray-600">Loading tasks...</p>
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
              <h3 className="text-sm font-medium text-red-800">Error loading tasks</h3>
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
          to="/tasks/new"
          className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
        >
          New Task
        </Link>
      </div>

      {/* Status filter */}
      <div className="mb-6 flex flex-wrap gap-2">
        {['all', 'open', 'next', 'waiting', 'scheduled', 'done', 'canceled'].map((status) => (
          <button
            key={status}
            onClick={() => setStatusFilter(status)}
            className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
              statusFilter === status
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {status === 'all' ? 'All' : statusLabels[status] || status}
          </button>
        ))}
      </div>

      {tasks.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg">
          <p className="text-gray-500 text-lg">
            {statusFilter === 'all' ? 'No tasks yet' : `No ${statusLabels[statusFilter] || statusFilter} tasks`}
          </p>
          <p className="text-gray-400 text-sm mt-2">Create your first task to get started</p>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-lg divide-y divide-gray-200">
          {tasks.map((task) => (
            <Link
              key={task.id}
              to={`/tasks/${task.id}`}
              className="block p-4 hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h2 className="text-base font-semibold text-gray-900">
                      {task.title || `Task #${task.id}`}
                    </h2>
                    {task.status && (
                      <span
                        className={`px-2 py-0.5 text-xs font-medium rounded ${
                          statusColors[task.status] || 'bg-gray-100 text-gray-800'
                        }`}
                      >
                        {statusLabels[task.status] || task.status}
                      </span>
                    )}
                  </div>
                  {task.bodyMd && (
                    <p className="text-gray-600 text-sm mb-2">
                      {truncateMarkdown(task.bodyMd, 100)}
                    </p>
                  )}
                  <div className="flex items-center text-xs text-gray-500 space-x-3">
                    <span>#{task.id}</span>
                    {task.scheduledOn && (
                      <span>
                        Scheduled: {formatDateTime(task.scheduledOn).split(' ')[0]}
                      </span>
                    )}
                    <span title={formatDateTime(task.createdAt)}>
                      {formatRelativeTime(task.createdAt)}
                    </span>
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

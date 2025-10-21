import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { TasksService } from '../api/services/TasksService';
import LoadingState from '../components/LoadingState';
import ErrorState from '../components/ErrorState';

interface Task {
  id: number;
  title: string | null;
  bodyMd: string;
  status: 'open' | 'next' | 'waiting' | 'scheduled' | 'done' | 'canceled';
  isBookmarked: boolean;
  scheduledOn: string | null;
  labels?: string[];
  createdAt: string;
  updatedAt: string;
}

const STATUSES = [
  { value: 'open', label: 'Open', color: 'bg-gray-100' },
  { value: 'next', label: 'Next', color: 'bg-blue-50' },
  { value: 'waiting', label: 'Waiting', color: 'bg-yellow-50' },
  { value: 'scheduled', label: 'Scheduled', color: 'bg-purple-50' },
  { value: 'done', label: 'Done', color: 'bg-green-50' },
  { value: 'canceled', label: 'Canceled', color: 'bg-red-50' },
] as const;

export default function TasksKanban() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updatingTaskId, setUpdatingTaskId] = useState<number | null>(null);

  useEffect(() => {
    fetchTasks();
  }, []);

  async function fetchTasks() {
    try {
      setLoading(true);
      setError(null);
      const response = await TasksService.listTasks();
      setTasks(response || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load tasks');
      console.error('Error fetching tasks:', err);
    } finally {
      setLoading(false);
    }
  }

  async function handleStatusChange(taskId: number, newStatus: Task['status']) {
    try {
      setUpdatingTaskId(taskId);
      await TasksService.updateTask(String(taskId), { status: newStatus });
      // Update local state optimistically
      setTasks((prevTasks) =>
        prevTasks.map((task) =>
          task.id === taskId ? { ...task, status: newStatus } : task
        )
      );
    } catch (err) {
      console.error('Error updating task status:', err);
      alert('Failed to update task status');
      // Refresh to get correct state
      fetchTasks();
    } finally {
      setUpdatingTaskId(null);
    }
  }

  const tasksByStatus = useMemo(() => {
    const grouped: Record<string, Task[]> = {
      open: [],
      next: [],
      waiting: [],
      scheduled: [],
      done: [],
      canceled: [],
    };

    tasks.forEach((task) => {
      if (task.status && grouped[task.status]) {
        grouped[task.status].push(task);
      }
    });

    return grouped;
  }, [tasks]);

  if (loading) {
    return <LoadingState message="Loading kanban board..." />;
  }

  if (error) {
    return <ErrorState error={error} title="Error loading kanban board" />;
  }

  return (
    <div className="h-full px-4 py-2">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-bold text-gray-900">Task Board</h2>
        <Link
          to="/tasks/new"
          className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-github-green-600 hover:bg-github-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-github-green-500"
        >
          New Task
        </Link>
      </div>

      <div className="flex gap-4 overflow-x-auto pb-4">
        {STATUSES.map((status) => {
          const columnTasks = tasksByStatus[status.value] || [];
          return (
            <div key={status.value} className="flex-shrink-0 w-80">
              <div className={`rounded-lg ${status.color} border border-gray-200`}>
                <div className="px-4 py-3 border-b border-gray-200">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-gray-900">{status.label}</h3>
                    <span className="text-sm text-gray-500">{columnTasks.length}</span>
                  </div>
                </div>

                <div className="p-2 space-y-2 min-h-[200px] max-h-[calc(100vh-250px)] overflow-y-auto">
                  {columnTasks.map((task) => (
                    <div
                      key={task.id}
                      className="bg-white rounded-md border border-gray-200 shadow-sm hover:shadow-md transition-shadow"
                    >
                      <div className="p-3">
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <Link
                            to={`/tasks/${task.id}`}
                            className="flex-1 text-sm font-medium text-gray-900 hover:text-github-green-600"
                          >
                            {task.title || 'Untitled Task'}
                          </Link>
                          {task.isBookmarked && (
                            <span className="text-yellow-500" title="Bookmarked">
                              ★
                            </span>
                          )}
                        </div>

                        {task.labels && task.labels.length > 0 && (
                          <div className="flex flex-wrap gap-1 mb-2">
                            {task.labels.map((label) => (
                              <span
                                key={label}
                                className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800"
                              >
                                {label}
                              </span>
                            ))}
                          </div>
                        )}

                        {task.scheduledOn && (
                          <div className="text-xs text-gray-500 mb-2">
                            📅 {task.scheduledOn}
                          </div>
                        )}

                        <div className="flex items-center justify-between">
                          <span className="text-xs text-gray-500">#{task.id}</span>
                          <select
                            value={task.status}
                            onChange={(e) =>
                              handleStatusChange(
                                task.id,
                                e.target.value as Task['status']
                              )
                            }
                            disabled={updatingTaskId === task.id}
                            className="text-xs border border-gray-300 rounded px-2 py-1 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-github-green-500 disabled:opacity-50"
                          >
                            {STATUSES.map((s) => (
                              <option key={s.value} value={s.value}>
                                {s.label}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    </div>
                  ))}

                  {columnTasks.length === 0 && (
                    <div className="text-center py-8 text-sm text-gray-400">
                      No tasks
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

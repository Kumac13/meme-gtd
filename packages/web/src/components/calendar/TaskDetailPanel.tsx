import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { TasksService } from '../../api/services/TasksService';
import ItemDetail, { type Item } from '../ItemDetail';
import LoadingState from '../LoadingState';
import ErrorState from '../ErrorState';

interface Task {
  id: number;
  title: string | null;
  bodyMd: string;
  status: string | null;
  isBookmarked: boolean;
  scheduledOn: string | null;
  endDate: string | null;
  labels?: string[];
  createdAt: string;
  updatedAt: string;
}

interface TaskDetailPanelProps {
  taskId: number | null;
  onClose: () => void;
  onTaskUpdated?: () => void;
}

export function TaskDetailPanel({ taskId, onClose, onTaskUpdated }: TaskDetailPanelProps) {
  const [task, setTask] = useState<Task | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [bookmarking, setBookmarking] = useState(false);

  useEffect(() => {
    if (!taskId) {
      setTask(null);
      return;
    }

    const fetchTask = async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await TasksService.getTask(String(taskId));
        setTask(response as Task);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load task');
        console.error('Error fetching task:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchTask();
  }, [taskId]);

  if (!taskId) return null;

  const handleDelete = async () => {
    if (!taskId) return;

    try {
      setDeleting(true);
      await TasksService.deleteTask(String(taskId));
      onTaskUpdated?.();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete task');
      console.error('Error deleting task:', err);
      setDeleting(false);
    }
  };

  const handleBookmarkToggle = async () => {
    if (!taskId || !task) return;

    try {
      setBookmarking(true);
      if (task.isBookmarked) {
        await TasksService.unbookmarkTask(String(taskId));
      } else {
        await TasksService.bookmarkTask(String(taskId));
      }
      setTask({ ...task, isBookmarked: !task.isBookmarked });
      onTaskUpdated?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update bookmark');
      console.error('Error toggling bookmark:', err);
    } finally {
      setBookmarking(false);
    }
  };

  const handleUpdate = (updatedItem: Item) => {
    setTask(updatedItem as Task);
    onTaskUpdated?.();
  };

  const handleStatusChange = async (status: string) => {
    if (!taskId) return;

    try {
      const updatedTask = await TasksService.updateTask(String(taskId), {
        status: status as 'inbox' | 'open' | 'next' | 'waiting' | 'scheduled' | 'someday' | 'done' | 'canceled'
      });
      setTask(updatedTask as Task);
      onTaskUpdated?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update status');
      console.error('Error updating status:', err);
    }
  };

  return (
    <>
      {/* Invisible backdrop for click-outside-to-close */}
      <div
        className="fixed inset-0 z-40"
        onClick={onClose}
      />

      {/* Right 1/2 Panel */}
      <div className="fixed top-0 right-0 bottom-0 w-1/2 bg-white shadow-xl border-l border-gray-200 z-50 flex flex-col overflow-hidden">
        {/* Header with title, #ID link and close button */}
        <div className="flex items-center justify-between p-3 border-b border-gray-200 flex-shrink-0">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <h2 className="text-lg font-semibold text-gray-900 truncate">
              {task?.title || 'Loading...'}
            </h2>
            <Link
              to={`/tasks/${taskId}`}
              className="text-gray-500 hover:text-github-green-600 text-sm font-medium flex-shrink-0"
            >
              #{taskId}
            </Link>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-gray-100 transition-colors flex-shrink-0 ml-2"
            aria-label="Close"
          >
            <svg
              className="w-5 h-5 text-gray-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {loading && <LoadingState message="Loading task..." />}

          {error && !loading && (
            <ErrorState error={error} title="Error loading task" />
          )}

          {!loading && !error && task && (
            <ItemDetail
              item={task}
              itemType="task"
              basePath="/tasks"
              returnFilters={null}
              onDelete={handleDelete}
              onBookmarkToggle={handleBookmarkToggle}
              onUpdate={handleUpdate}
              onStatusChange={handleStatusChange}
              deleting={deleting}
              bookmarking={bookmarking}
              mode="panel"
            />
          )}
        </div>
      </div>
    </>
  );
}

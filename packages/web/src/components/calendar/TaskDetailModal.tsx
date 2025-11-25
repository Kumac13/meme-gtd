import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { TasksService } from '../../api/services/TasksService';
import { LabelBadge } from '../LabelBadge';
import { StatusSelector } from '../StatusSelector';

const TASK_STATUS_OPTIONS = [
  { value: 'inbox', label: 'Inbox' },
  { value: 'someday', label: 'Someday' },
  { value: 'open', label: 'Open' },
  { value: 'next', label: 'Next' },
  { value: 'waiting', label: 'Waiting' },
  { value: 'scheduled', label: 'Scheduled' },
  { value: 'done', label: 'Done' },
  { value: 'canceled', label: 'Canceled' },
];

interface Task {
  id: number;
  title: string | null;
  bodyMd: string;
  status: string | null;
  scheduledOn: string | null;
  startTime: string | null;
  endTime: string | null;
  endDate: string | null;
  labels?: string[];
}

interface TaskDetailModalProps {
  taskId: number | null;
  onClose: () => void;
  onTaskUpdated?: () => void;
}

export function TaskDetailModal({ taskId, onClose, onTaskUpdated }: TaskDetailModalProps) {
  const [task, setTask] = useState<Task | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!taskId) {
      setTask(null);
      return;
    }

    const fetchTask = async () => {
      try {
        setLoading(true);
        setError(null);
        const fetchedTask = await TasksService.getTask(String(taskId));
        setTask(fetchedTask as Task);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load task');
        console.error('Error fetching task:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchTask();
  }, [taskId]);

  const handleStatusChange = async (newStatus: string) => {
    if (!task) return;
    try {
      const updatedTask = await TasksService.updateTask(String(task.id), { status: newStatus as 'inbox' | 'someday' | 'open' | 'next' | 'waiting' | 'scheduled' | 'done' | 'canceled' });
      setTask(updatedTask as Task);
      onTaskUpdated?.();
    } catch (err) {
      console.error('Error updating task status:', err);
    }
  };

  if (!taskId) return null;

  const formatTime = (time: string | null) => {
    if (!time) return null;
    return time.slice(0, 5); // HH:MM
  };

  const formatSchedule = () => {
    if (!task?.scheduledOn) return null;
    const parts = [task.scheduledOn];
    if (task.startTime) {
      parts.push(formatTime(task.startTime) || '');
      if (task.endTime) {
        parts.push(`- ${formatTime(task.endTime)}`);
      }
    }
    if (task.endDate && task.endDate !== task.scheduledOn) {
      parts.push(`~ ${task.endDate}`);
    }
    return parts.join(' ');
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black bg-opacity-50 z-40"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-xl max-w-lg w-full max-h-[80vh] flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900 truncate flex-1 mr-4">
              {loading ? 'Loading...' : task?.title || `Task #${taskId}`}
            </h2>
            <button
              onClick={onClose}
              className="p-1 rounded hover:bg-gray-100 transition-colors flex-shrink-0"
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
          <div className="flex-1 overflow-y-auto p-4">
            {loading && (
              <div className="text-center py-8 text-gray-500">
                Loading task...
              </div>
            )}

            {error && (
              <div className="bg-red-50 border border-red-200 rounded p-3 mb-4">
                <div className="text-red-600 text-sm">{error}</div>
              </div>
            )}

            {!loading && task && (
              <div className="space-y-4">
                {/* Status */}
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-500">Status:</span>
                  <StatusSelector
                    value={task.status || 'inbox'}
                    onChange={handleStatusChange}
                    options={TASK_STATUS_OPTIONS}
                  />
                </div>

                {/* Schedule */}
                {task.scheduledOn && (
                  <div className="flex items-center gap-2">
                    <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <span className="text-sm text-gray-700">{formatSchedule()}</span>
                  </div>
                )}

                {/* Labels */}
                {task.labels && task.labels.length > 0 && (
                  <div className="flex items-center gap-2 flex-wrap">
                    {task.labels.map((label, idx) => (
                      <LabelBadge key={idx} name={label} />
                    ))}
                  </div>
                )}

                {/* Body */}
                {task.bodyMd && (
                  <div className="prose prose-sm max-w-none">
                    <div className="text-gray-700 whitespace-pre-wrap">{task.bodyMd}</div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="p-4 border-t border-gray-200 flex justify-between">
            <Link
              to={`/tasks/${taskId}`}
              className="px-4 py-2 text-sm text-github-green-600 hover:text-github-green-800 font-medium"
            >
              View Details
            </Link>
            <button
              onClick={onClose}
              className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

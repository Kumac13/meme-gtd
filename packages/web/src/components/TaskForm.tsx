import { useState, FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { TasksService } from '../api/services/TasksService';
import { validateTaskForm } from '../utils/validation';

type TaskStatus = 'open' | 'next' | 'waiting' | 'scheduled' | 'done' | 'canceled';

interface TaskFormProps {
  initialTitle?: string;
  initialBodyMd?: string;
  initialStatus?: TaskStatus;
  taskId?: number;
  mode: 'create' | 'edit';
}

export default function TaskForm({
  initialTitle = '',
  initialBodyMd = '',
  initialStatus = 'open',
  taskId,
  mode,
}: TaskFormProps) {
  const navigate = useNavigate();
  const [title, setTitle] = useState(initialTitle);
  const [bodyMd, setBodyMd] = useState(initialBodyMd);
  const [status, setStatus] = useState<TaskStatus>(initialStatus);
  const [error, setError] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    // Validate
    const validation = validateTaskForm(title, bodyMd, status);
    if (!validation.isValid) {
      const errorMessages = Object.values(validation.errors).join(', ');
      setValidationError(errorMessages || 'Invalid task data');
      return;
    }
    setValidationError(null);

    try {
      setSubmitting(true);
      setError(null);

      if (mode === 'create') {
        const response = await TasksService.createTask({
          title,
          bodyMd: bodyMd || undefined,
        });
        navigate(`/tasks/${response.id}`);
      } else if (mode === 'edit' && taskId) {
        await TasksService.updateTask(taskId.toString(), {
          title,
          bodyMd: bodyMd || undefined,
          status,
        });
        navigate(`/tasks/${taskId}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save task');
      console.error('Error saving task:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = () => {
    if (mode === 'edit' && taskId) {
      navigate(`/tasks/${taskId}`);
    } else {
      navigate('/tasks');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-start">
            <div className="flex-shrink-0">
              <span className="text-red-600 text-xl">⚠</span>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">Error saving task</h3>
              <p className="mt-1 text-sm text-red-700">{error}</p>
            </div>
          </div>
        </div>
      )}

      <div>
        <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-2">
          Task Title *
        </label>
        <input
          type="text"
          id="title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className={`w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
            validationError ? 'border-red-300' : 'border-gray-300'
          }`}
          placeholder="Enter task title..."
          required
        />
      </div>

      <div>
        <label htmlFor="bodyMd" className="block text-sm font-medium text-gray-700 mb-2">
          Task Description (Markdown, optional)
        </label>
        <textarea
          id="bodyMd"
          value={bodyMd}
          onChange={(e) => setBodyMd(e.target.value)}
          rows={10}
          className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono text-sm"
          placeholder="Enter task description in Markdown format..."
        />
        <p className="mt-1 text-xs text-gray-500">
          Optional. Supports Markdown formatting. Max 10,000 characters.
        </p>
      </div>

      {mode === 'edit' && (
        <div>
          <label htmlFor="status" className="block text-sm font-medium text-gray-700 mb-2">
            Task Status
          </label>
          <select
            id="status"
            value={status}
            onChange={(e) => setStatus(e.target.value as TaskStatus)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="open">Open</option>
            <option value="next">Next</option>
            <option value="waiting">Waiting</option>
            <option value="scheduled">Scheduled</option>
            <option value="done">Done</option>
            <option value="canceled">Canceled</option>
          </select>
          <p className="mt-1 text-xs text-gray-500">
            Update the task status to track its progress.
          </p>
        </div>
      )}

      {validationError && (
        <p className="text-sm text-red-600">{validationError}</p>
      )}

      <div className="flex items-center justify-end space-x-3">
        <button
          type="button"
          onClick={handleCancel}
          className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          disabled={submitting}
        >
          Cancel
        </button>
        <button
          type="submit"
          className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
          disabled={submitting}
        >
          {submitting ? 'Saving...' : mode === 'create' ? 'Create Task' : 'Update Task'}
        </button>
      </div>
    </form>
  );
}

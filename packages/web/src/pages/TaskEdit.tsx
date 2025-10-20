import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { TasksService } from '../api/services/TasksService';
import TaskForm from '../components/TaskForm';

type TaskStatus = 'open' | 'next' | 'waiting' | 'scheduled' | 'done' | 'canceled';

interface Task {
  id: number;
  title: string;
  bodyMd: string | null;
  status: TaskStatus;
  createdAt: string;
  updatedAt: string;
}

export default function TaskEdit() {
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

  if (error || !task) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-start">
            <div className="flex-shrink-0">
              <span className="text-red-600 text-xl">⚠</span>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">Error loading task</h3>
              <p className="mt-1 text-sm text-red-700">{error || 'Task not found'}</p>
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

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="mb-6">
        <Link
          to={`/tasks/${task.id}`}
          className="text-blue-600 hover:text-blue-800 text-sm font-medium mb-4 inline-block"
        >
          ← Back to task
        </Link>
        <h1 className="text-3xl font-bold text-gray-900">
          Edit {task.title}
        </h1>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <TaskForm
          mode="edit"
          taskId={task.id}
          initialTitle={task.title}
          initialBodyMd={task.bodyMd || ''}
          initialStatus={task.status}
        />
      </div>
    </div>
  );
}

import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { TasksService } from '../api/services/TasksService';
import TaskForm from '../components/TaskForm';
import LoadingState from '../components/LoadingState';
import ErrorState from '../components/ErrorState';

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
    return <LoadingState message="Loading task..." />;
  }

  if (error || !task) {
    return <ErrorState error={error || 'Task not found'} title="Error loading task" />;
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="mb-6">
        <Link
          to={`/tasks/${task.id}`}
          className="text-github-green-600 hover:text-github-green-800 text-sm font-medium mb-4 inline-block"
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

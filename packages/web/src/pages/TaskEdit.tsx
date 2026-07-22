import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import type { TaskKind } from 'meme-gtd-shared';
import { TasksService } from '../api/services/TasksService';
import TaskForm from '../components/TaskForm';
import FormPageLayout from '../components/FormPageLayout';
import LoadingState from '../components/LoadingState';
import ErrorState from '../components/ErrorState';

type TaskStatus = 'open' | 'next' | 'waiting' | 'scheduled' | 'done' | 'canceled';

interface Task {
  id: number;
  title: string;
  bodyMd: string | null;
  status: TaskStatus;
  taskKind: TaskKind;
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
    <FormPageLayout backTo={`/tasks/${task.id}`} backLabel="Back to task" title={task.title ? `Edit ${task.title}` : 'Edit'}>
        <TaskForm
          mode="edit"
          taskId={task.id}
          initialTitle={task.title}
          initialBodyMd={task.bodyMd || ''}
          initialStatus={task.status}
          initialTaskKind={task.taskKind}
        />
    </FormPageLayout>
  );
}

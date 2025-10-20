import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { TasksService } from '../api/services/TasksService';
import ItemDetail, { type Item } from '../components/ItemDetail';
import LoadingState from '../components/LoadingState';
import ErrorState from '../components/ErrorState';

interface Task {
  id: number;
  title: string | null;
  bodyMd: string;
  status: string | null;
  isBookmarked: boolean;
  scheduledOn: string | null;
  labels?: string[];
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
    if (!id) return;

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
      setTask({ ...task, isBookmarked: !task.isBookmarked });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update bookmark');
      console.error('Error toggling bookmark:', err);
    } finally {
      setBookmarking(false);
    }
  };

  if (loading) {
    return <LoadingState message="Loading task..." />;
  }

  if (error || !task) {
    return <ErrorState error={error || 'Task not found'} title="Error loading task" />;
  }

  const handleUpdate = (updatedItem: Item) => {
    setTask(updatedItem as Task);
  };

  const handleStatusChange = async (status: string) => {
    if (!id) return;

    try {
      const updatedTask = await TasksService.updateTask(id, {
        status: status as 'open' | 'next' | 'waiting' | 'scheduled' | 'done' | 'canceled'
      });
      setTask(updatedTask as Task);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update status');
      console.error('Error updating status:', err);
    }
  };

  return (
    <ItemDetail
      item={task}
      itemType="task"
      basePath="/tasks"
      onDelete={handleDelete}
      onBookmarkToggle={handleBookmarkToggle}
      onUpdate={handleUpdate}
      onStatusChange={handleStatusChange}
      deleting={deleting}
      bookmarking={bookmarking}
    />
  );
}

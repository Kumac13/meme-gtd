import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { TasksService } from '../api/services/TasksService';
import ItemDetail, { type Item } from '../components/ItemDetail';
import { ItemDetailPanel } from '../components/ItemDetailPanel';
import LoadingState from '../components/LoadingState';
import ErrorState from '../components/ErrorState';
import CreateTaskModal from '../components/CreateTaskModal';
import { useDocumentTitle, truncateForTitle } from '../hooks/useDocumentTitle';

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
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<{ id: number; type: 'memo' | 'task' } | null>(null);

  // Set document title based on task title or body preview
  const titleText = task?.title || (task?.bodyMd ? truncateForTitle(task.bodyMd) : null);
  useDocumentTitle(titleText);

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

  const handleItemClick = useCallback((itemId: number, itemType: 'memo' | 'task') => {
    setSelectedItem({ id: itemId, type: itemType });
  }, []);

  const handlePanelClose = useCallback(() => {
    setSelectedItem(null);
  }, []);

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
        status: status as 'inbox' | 'open' | 'next' | 'waiting' | 'scheduled' | 'someday' | 'done' | 'canceled'
      });
      setTask(updatedTask as Task);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update status');
      console.error('Error updating status:', err);
    }
  };

  const handleOpenCreateModal = () => setIsCreateModalOpen(true);
  const handleCloseCreateModal = () => setIsCreateModalOpen(false);
  const handleTaskCreated = (newTaskId: number) => {
    // Navigate to the newly created task
    navigate(`/tasks/${newTaskId}`);
  };

  // Custom action buttons for creating new task and archiving to memo
  const customActions = (
    <div className="flex gap-2">
      <Link to={`/memos/new?fromTask=${id}`}>
        <button className="inline-flex items-center px-3 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-github-green-500">
          Archive to Memo
        </button>
      </Link>
      <button
        onClick={handleOpenCreateModal}
        className="inline-flex items-center px-3 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-github-green-600 hover:bg-github-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-github-green-500"
      >
        New Task
      </button>
    </div>
  );

  return (
    <>
      <ItemDetail
        item={task}
        itemType="task"
        onDelete={handleDelete}
        onBookmarkToggle={handleBookmarkToggle}
        onUpdate={handleUpdate}
        onStatusChange={handleStatusChange}
        deleting={deleting}
        bookmarking={bookmarking}
        customActions={customActions}
        onItemClick={handleItemClick}
      />
      <CreateTaskModal
        isOpen={isCreateModalOpen}
        onClose={handleCloseCreateModal}
        sourceTask={{ id: task.id, title: task.title || 'Untitled Task' }}
        onTaskCreated={handleTaskCreated}
      />
      <ItemDetailPanel
        itemId={selectedItem?.id ?? null}
        itemType={selectedItem?.type ?? null}
        onClose={handlePanelClose}
      />
    </>
  );
}

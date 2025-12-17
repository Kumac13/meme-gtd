import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import type { IssueType } from 'meme-gtd-shared';
import { TasksService } from '../api/services/TasksService';
import ItemDetail, { type Item, type Comment } from '../components/ItemDetail';
import { ItemDetailPanel } from '../components/ItemDetailPanel';
import LoadingState from '../components/LoadingState';
import ErrorState from '../components/ErrorState';
import CreateTaskModal from '../components/CreateTaskModal';
import { useDocumentTitle, truncateForTitle } from '../hooks/useDocumentTitle';
import { copyItemContent } from '../utils/copyContent';

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
  const [selectedItem, setSelectedItem] = useState<{ id: number; type: IssueType } | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [isCopied, setIsCopied] = useState(false);

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

  const handleItemClick = useCallback((itemId: number, itemType: IssueType) => {
    setSelectedItem({ id: itemId, type: itemType });
  }, []);

  const handlePanelClose = useCallback(() => {
    setSelectedItem(null);
  }, []);

  const handleCommentsLoaded = useCallback((loadedComments: Comment[]) => {
    setComments(loadedComments);
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

  const handleCopyAllContents = async () => {
    await copyItemContent({
      title: task?.title || null,
      body: task?.bodyMd || '',
      comments,
    });
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  // Custom action button for creating new task (in header)
  const customActions = (
    <button
      onClick={handleOpenCreateModal}
      className="inline-flex items-center px-3 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-github-green-600 hover:bg-github-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-github-green-500"
    >
      New Task
    </button>
  );

  // Sidebar actions for copy and archiving to memo
  const sidebarActions = (
    <>
      <button
        onClick={handleCopyAllContents}
        className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 mb-2"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
        </svg>
        {isCopied ? 'Copied!' : 'Copy All Contents'}
      </button>
      <Link
        to={`/memos/new?fromTask=${id}`}
        className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
        </svg>
        Archive to Memo
      </Link>
    </>
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
        sidebarActions={sidebarActions}
        onItemClick={handleItemClick}
        onCommentsLoaded={handleCommentsLoaded}
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

import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { TasksService } from '../api/services/TasksService';
import ItemList from '../components/ItemList';
import FilterBar from '../components/FilterBar';
import LoadingState from '../components/LoadingState';
import ErrorState from '../components/ErrorState';
import EmptyState from '../components/EmptyState';

interface Task {
  id: number;
  title: string | null;
  bodyMd: string;
  status: string | null;
  isBookmarked: boolean;
  commentCount?: number;
  scheduledOn: string | null;
  labels?: string[];
  createdAt: string;
  updatedAt: string;
}

const statusLabels: Record<string, string> = {
  open: 'Open',
  next: 'Next',
  waiting: 'Waiting',
  scheduled: 'Scheduled',
  done: 'Done',
  canceled: 'Canceled',
};

export default function TasksList() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [bookmarkFilter, setBookmarkFilter] = useState(false);

  useEffect(() => {
    async function fetchTasks() {
      try {
        setLoading(true);
        setError(null);
        const response = await TasksService.listTasks(
          statusFilter !== 'all' ? (statusFilter as 'open' | 'next' | 'waiting' | 'scheduled' | 'done' | 'canceled') : undefined
        );
        setTasks(response || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load tasks');
        console.error('Error fetching tasks:', err);
      } finally {
        setLoading(false);
      }
    }

    fetchTasks();
  }, [statusFilter]);

  const filteredTasks = useMemo(() => {
    return tasks.filter((task) => {
      if (bookmarkFilter && !task.isBookmarked) return false;
      return true;
    });
  }, [tasks, bookmarkFilter]);

  if (loading) {
    return <LoadingState message="Loading tasks..." />;
  }

  if (error) {
    return <ErrorState error={error} title="Error loading tasks" />;
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-2">
      <div className="flex items-center justify-end mb-3">
        <Link
          to="/tasks/new"
          className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-github-green-600 hover:bg-github-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-github-green-500"
        >
          New Task
        </Link>
      </div>

      <FilterBar
        showStatusFilter
        statusFilter={statusFilter}
        bookmarkFilter={bookmarkFilter}
        onStatusFilterChange={setStatusFilter}
        onBookmarkFilterChange={setBookmarkFilter}
      />

      {filteredTasks.length === 0 ? (
        <EmptyState
          message={
            statusFilter === 'all' && !bookmarkFilter
              ? 'No tasks yet'
              : bookmarkFilter && statusFilter !== 'all'
              ? `No bookmarked ${statusLabels[statusFilter] || statusFilter} tasks`
              : bookmarkFilter
              ? 'No bookmarked tasks'
              : `No ${statusLabels[statusFilter] || statusFilter} tasks`
          }
          submessage={statusFilter === 'all' && !bookmarkFilter ? 'Create your first task to get started' : undefined}
        />
      ) : (
        <ItemList items={filteredTasks} itemType="task" basePath="/tasks" />
      )}
    </div>
  );
}

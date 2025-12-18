import { useState, useEffect, useMemo, useCallback } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { TasksService } from '../api/services/TasksService';
import ItemList from '../components/ItemList';
import FilterBar from '../components/FilterBar';
import SearchInput from '../components/SearchInput';
import LoadingState from '../components/LoadingState';
import ErrorState from '../components/ErrorState';
import EmptyState from '../components/EmptyState';
import Pagination from '../components/Pagination';
import { useUrlFilters } from '../hooks/useUrlFilters';
import {
  validateStatus,
  validateBookmarked,
  updateStatusParam,
  updateBookmarkedParam,
} from '../utils/urlFilterHelpers';
import { useDocumentTitle } from '../hooks/useDocumentTitle';

interface Task {
  id: number;
  title: string | null;
  bodyMd: string;
  status: string | null;
  isBookmarked: boolean;
  commentCount?: number;
  scheduledOn: string | null;
  labels?: string[];
  preview?: string;
  createdAt: string;
  updatedAt: string;
}

const statusLabels: Record<string, string> = {
  inbox: 'Inbox',
  open: 'Open',
  next: 'Next',
  waiting: 'Waiting',
  scheduled: 'Scheduled',
  someday: 'Someday',
  done: 'Done',
  canceled: 'Canceled',
};

const PAGE_SIZE = 20;

export default function TasksList() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { filters, actions } = useUrlFilters();
  const statusFilter = validateStatus(searchParams.get('status'));
  const bookmarkFilter = validateBookmarked(searchParams.get('bookmarked'));

  // Pagination state from URL
  const currentPage = Math.max(1, parseInt(searchParams.get('page') || '1', 10));

  // Set document title for tasks list
  useDocumentTitle('Tasks');

  const [tasks, setTasks] = useState<Task[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const totalPages = Math.ceil(total / PAGE_SIZE);

  useEffect(() => {
    async function fetchTasks() {
      try {
        setLoading(true);
        setError(null);

        // Build label parameter from parsed query
        const labelParam = filters.parsedQuery.labels?.join(',');

        // Use parsed status from search query if available, otherwise use FilterBar status
        const effectiveStatus = filters.parsedQuery.status ||
          (statusFilter !== 'all' ? statusFilter : undefined);

        // Extract free-text search from parsed query
        const searchParam = filters.parsedQuery.freeText;

        // Calculate offset for pagination
        const offset = (currentPage - 1) * PAGE_SIZE;

        const response = await TasksService.listTasks(
          effectiveStatus as 'inbox' | 'open' | 'next' | 'waiting' | 'scheduled' | 'someday' | 'done' | 'canceled' | undefined,
          undefined,
          labelParam,
          searchParam,
          undefined,
          undefined,
          PAGE_SIZE,
          offset
        );
        setTasks(response?.data || []);
        setTotal(response?.total || 0);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load tasks');
        console.error('Error fetching tasks:', err);
      } finally {
        setLoading(false);
      }
    }

    fetchTasks();
  }, [statusFilter, filters.searchQuery, currentPage]);

  const filteredTasks = useMemo(() => {
    return tasks.filter((task) => {
      if (bookmarkFilter && !task.isBookmarked) return false;
      return true;
    });
  }, [tasks, bookmarkFilter]);

  const handleStatusFilterChange = (newStatus: string) => {
    const params = updateStatusParam(searchParams, newStatus as any);
    params.delete('page'); // Reset to page 1
    setSearchParams(params);
  };

  const handleBookmarkFilterChange = (newBookmarked: boolean) => {
    const params = updateBookmarkedParam(searchParams, newBookmarked);
    params.delete('page'); // Reset to page 1
    setSearchParams(params);
  };

  const handlePageChange = useCallback((page: number) => {
    const params = new URLSearchParams(searchParams);
    if (page === 1) {
      params.delete('page');
    } else {
      params.set('page', String(page));
    }
    setSearchParams(params);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [searchParams, setSearchParams]);

  const handleDelete = async (id: number) => {
    await TasksService.deleteTask(String(id));
    setTasks(tasks.filter((task) => task.id !== id));
    setTotal(prev => prev - 1);
  };

  if (loading) {
    return <LoadingState message="Loading tasks..." />;
  }

  if (error) {
    return <ErrorState error={error} title="Error loading tasks" />;
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-2">
      <div className="flex items-center gap-2 mb-4">
        <SearchInput
          value={filters.searchQuery}
          onChange={(value) => {
            actions.setSearchQuery(value);
            // Reset to page 1 when searching
            const params = new URLSearchParams(searchParams);
            params.delete('page');
            setSearchParams(params);
          }}
          placeholder="Search tasks"
        />
        <Link
          to="/tasks/new"
          className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-github-green-600 hover:bg-github-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-github-green-500 whitespace-nowrap"
        >
          New Task
        </Link>
      </div>

      <FilterBar
        showStatusFilter
        statusFilter={statusFilter}
        bookmarkFilter={bookmarkFilter}
        onStatusFilterChange={handleStatusFilterChange}
        onBookmarkFilterChange={handleBookmarkFilterChange}
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
        <>
          <div className="text-sm text-gray-500 mb-2">
            {total} {total === 1 ? 'task' : 'tasks'}
          </div>
          <ItemList items={filteredTasks} itemType="task" basePath="/tasks" currentFilters={searchParams} onDelete={handleDelete} />
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={handlePageChange}
          />
        </>
      )}
    </div>
  );
}

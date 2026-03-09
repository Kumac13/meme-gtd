import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { TasksService } from '../api/services/TasksService';
import { ProjectsService } from '../api/services/ProjectsService';
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
  updateSearchParam,
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

interface Project {
  id: number;
  name: string;
  status: string;
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
  const { filters } = useUrlFilters();
  const statusFilter = validateStatus(searchParams.get('status'));
  const bookmarkFilter = validateBookmarked(searchParams.get('bookmarked'));

  // Project filter from URL
  const projectIdParam = searchParams.get('projectId') || '';
  const selectedProjectIds = useMemo(() => {
    if (!projectIdParam) return new Set<number>();
    return new Set(
      projectIdParam.split(',').map(id => parseInt(id.trim(), 10)).filter(id => !isNaN(id))
    );
  }, [projectIdParam]);

  // Pagination state from URL
  const currentPage = Math.max(1, parseInt(searchParams.get('page') || '1', 10));

  // Set document title for tasks list
  useDocumentTitle('Tasks');

  const [tasks, setTasks] = useState<Task[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [showProjectDropdown, setShowProjectDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const totalPages = Math.ceil(total / PAGE_SIZE);

  // Load projects for filter dropdown
  useEffect(() => {
    ProjectsService.listProjects().then(data => {
      setProjects(data.map(p => ({ id: p.id, name: p.name, status: p.status })));
    }).catch(console.error);
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowProjectDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    async function fetchTasks() {
      try {
        setLoading(true);
        setError(null);

        // Build label parameter from parsed query
        const labelParam = filters.parsedQuery.labels?.join(',');

        // Use parsed status from search query if available.
        // If searching (labels or free-text) and on the default "next" view (status param absent),
        // broaden the search to all statuses.
        const isSearching = !!(filters.parsedQuery.labels?.length || filters.parsedQuery.freeText);
        const isDefaultStatusView = !searchParams.get('status');

        const effectiveStatus = filters.parsedQuery.status ||
          (isSearching && isDefaultStatusView ? undefined : (statusFilter !== 'all' ? statusFilter : undefined));

        // Extract free-text search from parsed query
        const searchParam = filters.parsedQuery.freeText;

        // Calculate offset for pagination
        const offset = (currentPage - 1) * PAGE_SIZE;

        // Build projectId parameter
        const projectIdFilter = selectedProjectIds.size > 0
          ? Array.from(selectedProjectIds).join(',')
          : undefined;

        const response = await TasksService.listTasks(
          effectiveStatus as 'inbox' | 'open' | 'next' | 'waiting' | 'scheduled' | 'someday' | 'done' | 'canceled' | undefined,
          undefined,
          labelParam,
          projectIdFilter,
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
  }, [statusFilter, filters.searchQuery, currentPage, projectIdParam]);

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

  const handleProjectToggle = (projectId: number) => {
    const params = new URLSearchParams(searchParams);
    const newIds = new Set(selectedProjectIds);
    if (newIds.has(projectId)) {
      newIds.delete(projectId);
    } else {
      newIds.add(projectId);
    }
    if (newIds.size === 0) {
      params.delete('projectId');
    } else {
      params.set('projectId', Array.from(newIds).join(','));
    }
    params.delete('page');
    setSearchParams(params);
  };

  const handleClearProjects = () => {
    const params = new URLSearchParams(searchParams);
    params.delete('projectId');
    params.delete('page');
    setSearchParams(params);
    setShowProjectDropdown(false);
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

  const projectFilterLabel = useMemo(() => {
    if (selectedProjectIds.size === 0) return 'Project';
    if (selectedProjectIds.size === 1) {
      const id = Array.from(selectedProjectIds)[0];
      const project = projects.find(p => p.id === id);
      return project?.name || 'Project';
    }
    return `${selectedProjectIds.size} Projects`;
  }, [selectedProjectIds, projects]);

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
            // Update search query and reset page number in one atomic operation
            const params = updateSearchParam(searchParams, value);
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

      {/* Project filter dropdown */}
      {projects.length > 0 && (
        <div className="mb-4 flex flex-wrap gap-2" ref={dropdownRef}>
          <div className="relative">
            <button
              onClick={() => setShowProjectDropdown(!showProjectDropdown)}
              className={`px-3 py-1 rounded-md text-sm font-medium transition-colors inline-flex items-center gap-1 ${
                selectedProjectIds.size > 0
                  ? 'bg-github-green-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {projectFilterLabel}
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {showProjectDropdown && (
              <div className="absolute top-full left-0 mt-1 w-56 bg-white border border-gray-200 rounded-md shadow-lg z-10 max-h-64 overflow-y-auto">
                {selectedProjectIds.size > 0 && (
                  <button
                    onClick={handleClearProjects}
                    className="w-full text-left px-3 py-2 text-sm text-gray-500 hover:bg-gray-50 border-b border-gray-100"
                  >
                    Clear
                  </button>
                )}
                {projects.map(project => (
                  <button
                    key={project.id}
                    onClick={() => handleProjectToggle(project.id)}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 flex items-center justify-between"
                  >
                    <span className="text-gray-700">{project.name}</span>
                    {selectedProjectIds.has(project.id) && (
                      <svg className="w-4 h-4 text-github-green-600" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

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

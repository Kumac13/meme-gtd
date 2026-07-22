import { useState, useEffect, useMemo, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { TasksService } from '../api/services/TasksService';
import { SearchService } from '../api/services/SearchService';
import { ProjectsService } from '../api/services/ProjectsService';
import ItemList from '../components/ItemList';

import LabelFilterDropdown from '../components/LabelFilterDropdown';
import DateRangeFilterDropdown from '../components/DateRangeFilterDropdown';
import SearchInput, { type SearchMode } from '../components/SearchInput';
import LoadingState from '../components/LoadingState';
import ErrorState from '../components/ErrorState';
import EmptyState from '../components/EmptyState';
import Pagination from '../components/Pagination';
import CopyResultsButtons from '../components/CopyResultsButtons';
import ProjectFilterDropdown from '../components/ProjectFilterDropdown';
import { ListPageLayout } from '../components/ListPageLayout';
import { ToggleFilterButton } from '../components/FilterControls';
import { useUrlFilters } from '../hooks/useUrlFilters';
import {
  validateStatus,
  validateBookmarked,
  updateStatusParam,
  updateBookmarkedParam,
  updateSearchParam,
  parseLabelParam,
  updateLabelParam,
  parseDateRangeParams,
  updateDateRangeParams,
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
  all: 'All',
  inbox: 'Inbox',
  open: 'Open',
  next: 'Next',
  waiting: 'Waiting',
  scheduled: 'Scheduled',
  someday: 'Someday',
  done: 'Done',
  canceled: 'Canceled',
};

import { sortProjectsByStatus } from '../utils/projectStatus';

const statusOptions = ['all', 'inbox', 'open', 'next', 'waiting', 'scheduled', 'someday', 'done', 'canceled'];

const PAGE_SIZE = 20;

export default function TasksList() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { filters } = useUrlFilters();
  const statusFilter = validateStatus(searchParams.get('status'));
  const bookmarkFilter = validateBookmarked(searchParams.get('bookmarked'));

  // Label filter from URL
  const selectedLabels = useMemo(
    () => parseLabelParam(searchParams.get('label')),
    [searchParams]
  );

  // Project filter from URL
  const projectIdParam = searchParams.get('projectId') || '';
  const selectedProjectIds = useMemo(() => {
    if (!projectIdParam) return new Set<number>();
    return new Set(
      projectIdParam.split(',')
        .map(id => id.trim())
        .filter(id => id !== 'none')
        .map(id => parseInt(id, 10))
        .filter(id => !isNaN(id))
    );
  }, [projectIdParam]);

  const selectedNoneProject = useMemo(() => {
    return projectIdParam.split(',').map(s => s.trim()).includes('none');
  }, [projectIdParam]);

  // Schedule date range filter from URL
  const { from: scheduledFrom, to: scheduledTo } = useMemo(
    () => parseDateRangeParams(searchParams, 'scheduledFrom', 'scheduledTo'),
    [searchParams]
  );

  // Pagination state from URL
  const currentPage = Math.max(1, parseInt(searchParams.get('page') || '1', 10));

  // Set document title for tasks list
  useDocumentTitle('Tasks');

  const [tasks, setTasks] = useState<Task[]>([]);
  const [total, setTotal] = useState(0);
  const [initialLoading, setInitialLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [matchSnippets, setMatchSnippets] = useState<Record<number, string>>({});
  const [relevanceScores, setRelevanceScores] = useState<Record<number, number>>({});
  const [searchMode, setSearchMode] = useState<SearchMode>('keyword');
  const [semanticMeta, setSemanticMeta] = useState<{ totalResults: number; searchTimeMs: number } | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);

  const totalPages = Math.ceil(total / PAGE_SIZE);

  // Load projects for filter dropdown
  useEffect(() => {
    ProjectsService.listProjects().then(data => {
      const mapped = data.map(p => ({ id: p.id, name: p.name, status: p.status }));
      setProjects(sortProjectsByStatus(mapped));
    }).catch(console.error);
  }, []);

  useEffect(() => {
    async function fetchTasks() {
      try {
        setError(null);

        // Build label parameter from URL
        const labelParam = selectedLabels.size > 0
          ? Array.from(selectedLabels).join(',')
          : undefined;

        // Free-text search from parsed query
        const searchParam = filters.parsedQuery.freeText;

        // If searching (labels or free-text) and on the default "next" view (status param absent),
        // broaden the search to all statuses.
        const isSearching = !!(selectedLabels.size > 0 || searchParam);
        const isDefaultStatusView = !searchParams.get('status');

        const effectiveStatus = isSearching && isDefaultStatusView
          ? undefined
          : (statusFilter !== 'all' ? statusFilter : undefined);

        // Calculate offset for pagination
        const offset = (currentPage - 1) * PAGE_SIZE;

        // Build projectId parameter
        const projectIdFilter = (() => {
          const parts: string[] = [];
          if (selectedNoneProject) parts.push('none');
          if (selectedProjectIds.size > 0) parts.push(...Array.from(selectedProjectIds).map(String));
          return parts.length > 0 ? parts.join(',') : undefined;
        })();

        if (searchParam && searchMode === 'semantic') {
          // Use semantic search API
          const response = await SearchService.semanticSearch(
            searchParam,
            50,
            'task',
          );
          const mapped = response.results.map((r) => ({
            id: r.issue.id,
            type: r.issue.type,
            title: r.issue.title,
            bodyMd: r.issue.bodyMd,
            status: r.issue.status ?? null,
            isBookmarked: r.issue.isBookmarked ?? false,
            commentCount: r.issue.commentCount ?? 0,
            scheduledOn: r.issue.scheduledOn ?? null,
            labels: r.issue.labels ?? [],
            createdAt: r.issue.createdAt,
            updatedAt: r.issue.updatedAt,
          }));
          const scores: Record<number, number> = {};
          for (const r of response.results) {
            scores[r.issue.id] = r.score;
          }
          setMatchSnippets({});
          setRelevanceScores(scores);
          setSemanticMeta(response.meta);
          setTasks(mapped);
          setTotal(response.meta.totalResults);
        } else if (searchParam) {
          // Use keyword search API — respect current status filter
          setRelevanceScores({});
          setSemanticMeta(null);
          const searchStatus = statusFilter !== 'all' ? statusFilter : undefined;
          const response = await SearchService.keywordSearch(
            searchParam,
            PAGE_SIZE,
            offset,
            'task',
            searchStatus || undefined,
            labelParam,
            bookmarkFilter ? 'true' : undefined,
          );
          const mapped = response.results.map((r) => ({
            id: r.id,
            type: r.type,
            title: r.title,
            bodyMd: r.bodyMd,
            status: r.status,
            isBookmarked: r.isBookmarked,
            commentCount: r.commentCount,
            scheduledOn: null as string | null,
            labels: r.labels,
            createdAt: r.createdAt,
            updatedAt: r.updatedAt,
          }));
          const snippets: Record<number, string> = {};
          for (const r of response.results) {
            const match = r.matches[0];
            if (match) {
              if (match.field === 'comment') {
                snippets[r.id] = match.text;
              } else {
                const isTitleMatch = r.title && match.text === r.title;
                if (!isTitleMatch) {
                  snippets[r.id] = match.text;
                }
              }
            }
          }
          setMatchSnippets(snippets);
          setTasks(mapped);
          setTotal(response.total);
        } else {
          // Use list API
          setMatchSnippets({});
          setRelevanceScores({});
          setSemanticMeta(null);
          const response = await TasksService.listTasks(
            effectiveStatus as 'inbox' | 'open' | 'next' | 'waiting' | 'scheduled' | 'someday' | 'done' | 'canceled' | undefined,
            undefined,
            labelParam,
            projectIdFilter,
            undefined,
            scheduledFrom || undefined,
            scheduledTo || undefined,
            PAGE_SIZE,
            offset
          );
          setTasks(response?.data || []);
          setTotal(response?.total || 0);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load tasks');
        console.error('Error fetching tasks:', err);
      } finally {
        setInitialLoading(false);
      }
    }

    fetchTasks();
  }, [statusFilter, filters.searchQuery, currentPage, projectIdParam, selectedLabels, bookmarkFilter, searchMode, scheduledFrom, scheduledTo]);

  const filteredTasks = useMemo(() => {
    return tasks.filter((task) => {
      if (bookmarkFilter && !task.isBookmarked) return false;
      return true;
    });
  }, [tasks, bookmarkFilter]);

  // Filter snapshot for the Copy Results buttons. The backend uses this to
  // record a search.exported activity_log entry that reflects what the user
  // was looking at when they triggered copy.
  const copyExportFilters = useMemo(() => {
    const result: {
      query?: string;
      searchMode?: 'keyword' | 'semantic';
      labels?: string[];
      dateFrom?: string;
      dateTo?: string;
      bookmarked?: boolean;
      projectIds?: number[];
      includeNoProject?: boolean;
      status?: string;
    } = {};
    if (filters.parsedQuery.freeText) {
      result.query = filters.parsedQuery.freeText;
      result.searchMode = searchMode;
    }
    if (selectedLabels.size > 0) {
      result.labels = Array.from(selectedLabels);
    }
    if (scheduledFrom) result.dateFrom = scheduledFrom;
    if (scheduledTo) result.dateTo = scheduledTo;
    if (bookmarkFilter) result.bookmarked = true;
    if (selectedProjectIds.size > 0) {
      result.projectIds = Array.from(selectedProjectIds);
    }
    if (selectedNoneProject) result.includeNoProject = true;
    // Mirror the effective status the fetch used so a scope="all" copy resolves
    // the same set the user sees. Label-only filtering on the default status
    // view broadens to all statuses (see fetchTasks's effectiveStatus); the
    // keyword and plain-list paths otherwise respect the selected status.
    const isDefaultStatusView = !searchParams.get('status');
    const broadened =
      !filters.parsedQuery.freeText && selectedLabels.size > 0 && isDefaultStatusView;
    if (!broadened && statusFilter && statusFilter !== 'all') {
      result.status = statusFilter;
    }
    return result;
  }, [
    filters.parsedQuery.freeText,
    searchMode,
    selectedLabels,
    scheduledFrom,
    scheduledTo,
    bookmarkFilter,
    selectedProjectIds,
    selectedNoneProject,
    statusFilter,
    searchParams,
  ]);
  const copyExportItemIds = useMemo(
    () => filteredTasks.map((t) => t.id),
    [filteredTasks]
  );
  // Show Copy buttons only when the user has actively searched or filtered.
  // Status filter defaults to 'next', so we intentionally ignore it as the
  // baseline Tasks view and only count it as "active" when the user picked
  // something other than the default.
  const hasActiveFilters = useMemo(
    () =>
      !!filters.parsedQuery.freeText ||
      selectedLabels.size > 0 ||
      !!scheduledFrom ||
      !!scheduledTo ||
      bookmarkFilter ||
      selectedProjectIds.size > 0 ||
      selectedNoneProject,
    [
      filters.parsedQuery.freeText,
      selectedLabels,
      scheduledFrom,
      scheduledTo,
      bookmarkFilter,
      selectedProjectIds,
      selectedNoneProject,
    ]
  );

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

  const handleLabelToggle = (labelName: string) => {
    const newLabels = new Set(selectedLabels);
    if (newLabels.has(labelName)) {
      newLabels.delete(labelName);
    } else {
      newLabels.add(labelName);
    }
    const params = updateLabelParam(searchParams, newLabels);
    params.delete('page');
    setSearchParams(params);
  };

  const handleClearLabels = () => {
    const params = updateLabelParam(searchParams, new Set());
    params.delete('page');
    setSearchParams(params);
  };

  const handleScheduleChange = (from: string, to: string) => {
    const params = updateDateRangeParams(searchParams, from, to, 'scheduledFrom', 'scheduledTo');
    params.delete('page');
    setSearchParams(params);
  };

  const handleScheduleClear = () => {
    const params = updateDateRangeParams(searchParams, '', '', 'scheduledFrom', 'scheduledTo');
    params.delete('page');
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
    const parts: string[] = [];
    if (selectedNoneProject) parts.push('none');
    parts.push(...Array.from(newIds).map(String));
    if (parts.length === 0) {
      params.delete('projectId');
    } else {
      params.set('projectId', parts.join(','));
    }
    params.delete('page');
    setSearchParams(params);
  };

  const handleNoneProjectToggle = () => {
    const params = new URLSearchParams(searchParams);
    const parts: string[] = [];
    if (!selectedNoneProject) parts.push('none');
    if (selectedProjectIds.size > 0) parts.push(...Array.from(selectedProjectIds).map(String));
    if (parts.length === 0) {
      params.delete('projectId');
    } else {
      params.set('projectId', parts.join(','));
    }
    params.delete('page');
    setSearchParams(params);
  };

  const handleClearProjects = () => {
    const params = new URLSearchParams(searchParams);
    params.delete('projectId');
    params.delete('page');
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

  const projectFilterLabel = useMemo(() => {
    const count = selectedProjectIds.size + (selectedNoneProject ? 1 : 0);
    if (count === 0) return 'Project';
    if (count === 1 && selectedNoneProject) return 'No Project';
    return `${count} Projects`;
  }, [selectedProjectIds, selectedNoneProject]);

  if (initialLoading) {
    return <LoadingState message="Loading tasks..." />;
  }

  if (error) {
    return <ErrorState error={error} title="Error loading tasks" />;
  }

  return (
    <ListPageLayout
      search={<SearchInput
          value={filters.searchQuery}
          onChange={(value) => {
            // Update search query and reset page number in one atomic operation
            const params = updateSearchParam(searchParams, value);
            params.delete('page');
            setSearchParams(params);
          }}
          placeholder="Search tasks"
          searchMode={searchMode}
          onSearchModeChange={setSearchMode}
        />}
      createTo="/tasks/new"
      createLabel="New Task"
      filters={<>
        {/* Label filter dropdown */}
        <LabelFilterDropdown
          selectedLabels={selectedLabels}
          onToggle={handleLabelToggle}
          onClear={handleClearLabels}
          countKey="taskCount"
        />

        <ProjectFilterDropdown
          projects={projects}
          selectedIds={selectedProjectIds}
          includesNoProject={selectedNoneProject}
          label={projectFilterLabel}
          onToggle={handleProjectToggle}
          onToggleNoProject={handleNoneProjectToggle}
          onClear={handleClearProjects}
        />

        {/* Schedule date range filter */}
        <DateRangeFilterDropdown
          dateFrom={scheduledFrom}
          dateTo={scheduledTo}
          onChange={handleScheduleChange}
          onClear={handleScheduleClear}
        />

        {/* Bookmark filter */}
        <ToggleFilterButton active={bookmarkFilter} onToggle={() => handleBookmarkFilterChange(!bookmarkFilter)}>Bookmarked</ToggleFilterButton>
      </>}
      secondaryFilters={<div className="mb-4 flex flex-wrap gap-2">
        {statusOptions.map((status) => (
          <ToggleFilterButton
            key={status}
            onToggle={() => handleStatusFilterChange(status)}
            active={statusFilter === status}
          >
            {statusLabels[status] || status}
          </ToggleFilterButton>
        ))}
      </div>}
      summary={filteredTasks.length > 0 ? <>
        {total} {total === 1 ? 'task' : 'tasks'}
        {semanticMeta && <span className="ml-2 text-gray-400">({semanticMeta.searchTimeMs}ms)</span>}
        {hasActiveFilters && copyExportItemIds.length > 0 && <CopyResultsButtons type="tasks" filters={copyExportFilters} itemIds={copyExportItemIds} matchedComments={matchSnippets} matchedScores={relevanceScores} />}
      </> : undefined}
      empty={filteredTasks.length === 0}
      emptyState={<EmptyState
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
        />}
    >
        <>
          <ItemList items={filteredTasks} itemType="task" basePath="/tasks" currentFilters={searchParams} onDelete={handleDelete} matchSnippets={matchSnippets} searchQuery={searchMode === 'keyword' ? filters.parsedQuery.freeText : undefined} relevanceScores={relevanceScores} />
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={handlePageChange}
          />
        </>
    </ListPageLayout>
  );
}

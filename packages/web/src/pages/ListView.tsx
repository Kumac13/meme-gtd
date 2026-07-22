import { useOutletContext, useSearchParams } from 'react-router-dom';
import { useState, useEffect, useCallback, useMemo } from 'react';
import type { IssueType } from 'meme-gtd-shared';
import { ProjectDetail } from '../types/project';
import ItemList from '../components/ItemList';
import EmptyState from '../components/EmptyState';
import LoadingState from '../components/LoadingState';
import { TasksService } from '../api/services/TasksService';
import { MemosService } from '../api/services/MemosService';
import { ItemDetailPanel } from '../components/ItemDetailPanel';
import FilterBar from '../components/FilterBar';

interface OutletContext {
  project: ProjectDetail;
  setProject: (project: ProjectDetail) => void;
}

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

interface Memo {
  id: number;
  title: string | null;
  bodyMd: string;
  isBookmarked: boolean;
  commentCount?: number;
  labels?: string[];
  createdAt: string;
  updatedAt: string;
}

// Status filter options (matches Kanban columns)
const statusOptions = [
  'all', 'documents', 'inbox', 'open', 'next', 'waiting',
  'scheduled', 'someday', 'done', 'canceled'
];

const statusLabels: Record<string, string> = {
  all: 'All',
  documents: 'Documents',
  inbox: 'Inbox',
  open: 'Open',
  next: 'Next',
  waiting: 'Waiting',
  scheduled: 'Scheduled',
  someday: 'Someday',
  done: 'Done',
  canceled: 'Canceled',
};

const statusOrder: Record<string, number> = {
  next: 0, waiting: 1, scheduled: 2, inbox: 3, open: 4, someday: 5,
  done: 6, canceled: 7
};

export default function ListView() {
  const { project, setProject } = useOutletContext<OutletContext>();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [memos, setMemos] = useState<Memo[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedItem, setSelectedItem] = useState<{ id: number; type: IssueType } | null>(null);

  // Filter state management with URL params
  const [searchParams, setSearchParams] = useSearchParams();
  const statusFilter = searchParams.get('status') || 'all';
  const bookmarkFilter = searchParams.get('bookmarked') === 'true';

  const handleStatusFilterChange = useCallback((newStatus: string) => {
    const params = new URLSearchParams(searchParams);
    if (newStatus === 'all') {
      params.delete('status');
    } else {
      params.set('status', newStatus);
    }
    setSearchParams(params);
  }, [searchParams, setSearchParams]);

  const handleBookmarkFilterChange = useCallback((newBookmarked: boolean) => {
    const params = new URLSearchParams(searchParams);
    if (newBookmarked) {
      params.set('bookmarked', 'true');
    } else {
      params.delete('bookmarked');
    }
    setSearchParams(params);
  }, [searchParams, setSearchParams]);

  const handleItemClick = useCallback((id: number, type: IssueType) => {
    setSelectedItem({ id, type });
  }, []);

  const handlePanelClose = useCallback(() => {
    setSelectedItem(null);
  }, []);

  const handleItemUpdated = useCallback(async () => {
    // Refetch project to update list
    try {
      const response = await fetch(`/api/projects/${project.id}`);
      if (response.ok) {
        const updatedProject = await response.json();
        setProject(updatedProject);
      }
    } catch (err) {
      console.error('Error refetching project:', err);
    }
  }, [project.id, setProject]);

  useEffect(() => {
    async function fetchItems() {
      if (project.items.length === 0) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);

        // Get all tasks and memos lists (with commentCount)
        const [allTasksResponse, allMemosResponse] = await Promise.all([
          TasksService.listTasks(),
          MemosService.listMemos()
        ]);

        // Filter to only items in this project
        const projectIssueIds = new Set(project.items.map(item => item.issueId));

        const projectTasks = (allTasksResponse?.data || []).filter(task => projectIssueIds.has(task.id));
        const projectMemos = (allMemosResponse?.data || []).filter(memo => projectIssueIds.has(memo.id));

        setTasks(projectTasks);
        setMemos(projectMemos);
      } catch (err) {
        console.error('Failed to fetch items:', err);
      } finally {
        setLoading(false);
      }
    }

    fetchItems();
  }, [project.items]);

  // Filter and sort items based on current filter state
  const filteredAndSortedItems = useMemo(() => {
    let items: (Task | Memo)[] = [];

    // Status filter
    if (statusFilter === 'all') {
      items = [...tasks, ...memos];
    } else if (statusFilter === 'documents') {
      items = [...memos];
    } else {
      items = tasks.filter(task => task.status === statusFilter);
    }

    // Bookmark filter
    if (bookmarkFilter) {
      items = items.filter(item => item.isBookmarked);
    }

    // Sort: Active tasks first, then Documents, then Done/Canceled
    return items.sort((a, b) => {
      const aIsMemo = !('status' in a) || (a as Task).status === null;
      const bIsMemo = !('status' in b) || (b as Task).status === null;
      const aStatus = aIsMemo ? null : (a as Task).status;
      const bStatus = bIsMemo ? null : (b as Task).status;
      const aIsDoneOrCanceled = aStatus === 'done' || aStatus === 'canceled';
      const bIsDoneOrCanceled = bStatus === 'done' || bStatus === 'canceled';

      // Done/Canceled always last
      if (aIsDoneOrCanceled && !bIsDoneOrCanceled) return 1;
      if (!aIsDoneOrCanceled && bIsDoneOrCanceled) return -1;

      // Memos after active tasks but before Done/Canceled
      if (aIsMemo && !bIsMemo) return 1;
      if (!aIsMemo && bIsMemo) return -1;
      if (aIsMemo && bIsMemo) return 0;

      const aOrder = statusOrder[aStatus ?? ''] ?? 5;
      const bOrder = statusOrder[bStatus ?? ''] ?? 5;
      return aOrder - bOrder;
    });
  }, [tasks, memos, statusFilter, bookmarkFilter]);

  if (loading) {
    return <LoadingState message="Loading items..." />;
  }

  // Show empty state only when no items exist at all
  if (tasks.length === 0 && memos.length === 0) {
    return <EmptyState message="No items in this project. Add tasks or memos to get started." />;
  }

  return (
    <>
      <FilterBar
        bookmarkFilter={bookmarkFilter}
        onBookmarkFilterChange={handleBookmarkFilterChange}
        showStatusFilter
        statusFilter={statusFilter}
        onStatusFilterChange={handleStatusFilterChange}
        statusOptions={statusOptions}
        statusLabels={statusLabels}
      />
      {filteredAndSortedItems.length === 0 ? (
        <EmptyState
          message={
            statusFilter === 'all' && !bookmarkFilter
              ? "No items in this project. Add tasks or memos to get started."
              : `No ${statusFilter === 'documents' ? 'documents' : statusLabels[statusFilter] || statusFilter} items${bookmarkFilter ? ' (bookmarked)' : ''}.`
          }
        />
      ) : (
        <ItemList items={filteredAndSortedItems} itemType="task" basePath="" onItemClick={handleItemClick} showStatusBadges />
      )}
      <ItemDetailPanel
        itemId={selectedItem?.id ?? null}
        itemType={selectedItem?.type ?? null}
        onClose={handlePanelClose}
        onItemUpdated={handleItemUpdated}
      />
    </>
  );
}

import { useOutletContext } from 'react-router-dom';
import { useState, useEffect, useCallback } from 'react';
import { ProjectDetail } from '../types/project';
import ItemList from '../components/ItemList';
import EmptyState from '../components/EmptyState';
import LoadingState from '../components/LoadingState';
import { TasksService } from '../api/services/TasksService';
import { MemosService } from '../api/services/MemosService';
import { ItemDetailPanel } from '../components/ItemDetailPanel';

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

export default function ListView() {
  const { project, setProject } = useOutletContext<OutletContext>();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [memos, setMemos] = useState<Memo[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedItem, setSelectedItem] = useState<{ id: number; type: 'memo' | 'task' } | null>(null);

  useEffect(() => {
    async function fetchItems() {
      if (project.items.length === 0) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);

        // Get all tasks and memos lists (with commentCount)
        const [allTasks, allMemos] = await Promise.all([
          TasksService.listTasks(),
          MemosService.listMemos()
        ]);

        // Filter to only items in this project
        const projectIssueIds = new Set(project.items.map(item => item.issueId));

        const projectTasks = (allTasks || []).filter(task => projectIssueIds.has(task.id));
        const projectMemos = (allMemos || []).filter(memo => projectIssueIds.has(memo.id));

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

  if (loading) {
    return <LoadingState message="Loading items..." />;
  }

  const handleItemClick = useCallback((id: number, type: 'memo' | 'task') => {
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

  if (tasks.length === 0 && memos.length === 0) {
    return <EmptyState message="No items in this project. Add tasks or memos to get started." />;
  }

  // Combine tasks and memos into a single list
  const allItems = [...tasks, ...memos];

  return (
    <>
      <ItemList items={allItems} itemType="task" basePath="" onItemClick={handleItemClick} />
      <ItemDetailPanel
        itemId={selectedItem?.id ?? null}
        itemType={selectedItem?.type ?? null}
        onClose={handlePanelClose}
        onItemUpdated={handleItemUpdated}
      />
    </>
  );
}

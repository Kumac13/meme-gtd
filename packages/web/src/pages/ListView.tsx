import { useOutletContext } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { ProjectDetail } from '../types/project';
import ItemList from '../components/ItemList';
import EmptyState from '../components/EmptyState';
import LoadingState from '../components/LoadingState';
import { TasksService } from '../api/services/TasksService';
import { MemosService } from '../api/services/MemosService';

interface OutletContext {
  project: ProjectDetail;
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
  const { project } = useOutletContext<OutletContext>();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [memos, setMemos] = useState<Memo[]>([]);
  const [loading, setLoading] = useState(true);

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

  if (tasks.length === 0 && memos.length === 0) {
    return <EmptyState message="No items in this project. Add tasks or memos to get started." />;
  }

  // Combine tasks and memos into a single list
  const allItems = [...tasks, ...memos];

  return <ItemList items={allItems} itemType="task" basePath="" />;
}

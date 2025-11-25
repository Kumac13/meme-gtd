import { useMemo, useState } from 'react';
import { DndContext, DragEndEvent, DragOverlay, DragStartEvent } from '@dnd-kit/core';
import { ProjectDetail, ProjectItemWithIssue } from '../types/project';
import KanbanColumn from './KanbanColumn';
import KanbanCard from './KanbanCard';

interface KanbanBoardProps {
  project: ProjectDetail;
  onProjectUpdate: (project: ProjectDetail) => void;
  onItemClick?: (issueId: number, issueType: 'memo' | 'task') => void;
}

export default function KanbanBoard({ project, onProjectUpdate, onItemClick }: KanbanBoardProps) {
  const [dragError, setDragError] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  // Column order: Documents first, then task status columns
  const allColumns = ['Documents', 'Inbox', 'Open', 'Next', 'Waiting', 'Scheduled', 'Someday', 'Done', 'Canceled'];
  const taskStatusColumns = ['Inbox', 'Open', 'Next', 'Waiting', 'Scheduled', 'Someday', 'Done', 'Canceled'];

  // Group items by column
  const itemsByColumn = useMemo(() => {
    const grouped: Record<string, ProjectItemWithIssue[]> = {};

    // Initialize task status columns
    taskStatusColumns.forEach(col => {
      grouped[col] = [];
    });

    // Initialize Documents column for memos
    grouped['Documents'] = [];

    // Group items
    project.items.forEach(item => {
      if (item.issue.type === 'memo') {
        // All memos go to Documents column
        grouped['Documents'].push(item);
      } else if (item.issue.type === 'task' && item.issue.status) {
        // Tasks go to their status column (only if status is not null)
        const status = item.issue.status;
        // Capitalize first letter to match column names
        const columnName = status.charAt(0).toUpperCase() + status.slice(1);
        if (grouped[columnName]) {
          grouped[columnName].push(item);
        }
      }
    });

    // Sort items within each column by position
    Object.keys(grouped).forEach(col => {
      grouped[col].sort((a, b) => a.position - b.position);
    });

    return grouped;
  }, [project.items]);

  const columns = useMemo(() => {
    // Always show all columns: Documents first, then task status columns
    return allColumns;
  }, []);

  function handleDragStart(event: DragStartEvent) {
    setActiveId(event.active.id as string);
  }

  async function handleDragEnd(event: DragEndEvent) {
    setActiveId(null);
    const { active, over } = event;

    if (!over) return;

    const issueId = Number(active.id);
    const newColumnName = over.id as string;

    // Find the item being dragged
    const item = project.items.find(i => i.issueId === issueId);
    if (!item) return;

    // Memos can't be dragged out of Documents column
    if (item.issue.type === 'memo' && newColumnName !== 'Documents') return;
    if (item.issue.type === 'memo') return; // Memos stay in Documents

    // For tasks, check if status changed
    const oldStatus = item.issue.status;
    if (!oldStatus) return; // Skip if task has no status
    const newStatus = newColumnName.toLowerCase() as 'inbox' | 'open' | 'next' | 'waiting' | 'scheduled' | 'someday' | 'done' | 'canceled';

    if (oldStatus === newStatus) return;

    // Store original project for potential revert
    const originalProject = { ...project, items: [...project.items] };

    // Optimistic update: update task status in local state
    const updatedItems = project.items.map(i => {
      if (i.issueId === issueId && i.issue.type === 'task') {
        return {
          ...i,
          issue: {
            ...i.issue,
            status: newStatus
          }
        };
      }
      return i;
    });

    onProjectUpdate({
      ...project,
      items: updatedItems
    });

    // Clear any previous errors
    setDragError(null);

    try {
      // API call to update task status
      const response = await fetch(`/api/tasks/${issueId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status: newStatus }),
      });

      if (!response.ok) {
        throw new Error(`Failed to update task status: ${response.statusText}`);
      }
    } catch (err) {
      // Revert on error
      onProjectUpdate(originalProject);
      const errorMsg = err instanceof Error ? err.message : 'Failed to move item';
      setDragError(errorMsg);
      console.error('Drag-and-drop failed:', err);
    }
  }

  function handleDragCancel() {
    setActiveId(null);
  }

  return (
    <>
      <DndContext
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragCancel={handleDragCancel}
      >
        <div className="flex gap-4 overflow-x-auto pb-4">
          {columns.map(column => (
            <KanbanColumn
              key={column}
              column={column}
              items={itemsByColumn[column] || []}
              onItemClick={onItemClick}
            />
          ))}
        </div>

        <DragOverlay>
          {activeId ? (
            <div className="opacity-90 rotate-3 scale-105">
              <KanbanCard
                item={project.items.find(i => i.issueId === Number(activeId))!}
              />
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      {/* Error Display */}
      {dragError && (
        <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-red-700 text-sm">{dragError}</p>
        </div>
      )}
    </>
  );
}

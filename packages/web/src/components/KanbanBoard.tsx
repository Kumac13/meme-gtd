import { useMemo, useState } from 'react';
import { DndContext, DragEndEvent, DragOverlay, DragStartEvent } from '@dnd-kit/core';
import { ProjectDetail, ProjectItemWithIssue } from '../types/project';
import { ProjectsService } from '../api/services/ProjectsService';
import KanbanColumn from './KanbanColumn';
import KanbanCard from './KanbanCard';

interface KanbanBoardProps {
  project: ProjectDetail;
  onProjectUpdate: (project: ProjectDetail) => void;
}

export default function KanbanBoard({ project, onProjectUpdate }: KanbanBoardProps) {
  const [dragError, setDragError] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  // Group items by column
  const itemsByColumn = useMemo(() => {
    const columns = project.viewMeta.columns || [];
    const grouped: Record<string, ProjectItemWithIssue[]> = {};

    // Initialize all columns
    columns.forEach(col => {
      grouped[col] = [];
    });

    // Group items
    project.items.forEach(item => {
      const column = item.viewMeta?.column;
      if (column && grouped[column]) {
        grouped[column].push(item);
      } else {
        // Items without valid column go to "Unassigned"
        if (!grouped['Unassigned']) {
          grouped['Unassigned'] = [];
        }
        grouped['Unassigned'].push(item);
      }
    });

    // Sort items within each column by position
    Object.keys(grouped).forEach(col => {
      grouped[col].sort((a, b) => a.position - b.position);
    });

    return grouped;
  }, [project.items, project.viewMeta.columns]);

  const columns = useMemo(() => {
    const cols = project.viewMeta.columns || [];
    // Add "Unassigned" if there are unassigned items
    if (itemsByColumn['Unassigned']?.length > 0) {
      return [...cols, 'Unassigned'];
    }
    return cols;
  }, [project.viewMeta.columns, itemsByColumn]);

  function handleDragStart(event: DragStartEvent) {
    setActiveId(event.active.id as string);
  }

  async function handleDragEnd(event: DragEndEvent) {
    setActiveId(null);
    const { active, over } = event;

    if (!over) return;

    const itemId = Number(active.id);
    const newColumn = over.id as string;

    // Find the item being dragged
    const item = project.items.find(i => i.issueId === itemId);
    if (!item) return;

    // Check if column changed
    const oldColumn = item.viewMeta?.column;
    if (oldColumn === newColumn) return;

    // Store original project for potential revert
    const originalProject = { ...project, items: [...project.items] };

    // Optimistic update: update local state immediately
    const updatedItems = project.items.map(i => {
      if (i.issueId === itemId) {
        return {
          ...i,
          viewMeta: { ...i.viewMeta, column: newColumn }
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
      // API call to persist change
      await ProjectsService.updateProjectItem(project.id, itemId, {
        column: newColumn
      });
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

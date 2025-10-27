import { useMemo } from 'react';
import { DndContext, DragEndEvent } from '@dnd-kit/core';
import { ProjectDetail, ProjectItemWithIssue } from '../types/project';
import KanbanColumn from './KanbanColumn';

interface KanbanBoardProps {
  project: ProjectDetail;
  onProjectUpdate: (project: ProjectDetail) => void;
}

export default function KanbanBoard({ project, onProjectUpdate }: KanbanBoardProps) {
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

  async function handleDragEnd(event: DragEndEvent) {
    // Will be implemented in T009
    console.log('Drag end:', event);
  }

  return (
    <DndContext onDragEnd={handleDragEnd}>
      <div className="flex gap-4 overflow-x-auto pb-4">
        {columns.map(column => (
          <KanbanColumn
            key={column}
            column={column}
            items={itemsByColumn[column] || []}
          />
        ))}
      </div>
    </DndContext>
  );
}

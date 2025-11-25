import { useDroppable } from '@dnd-kit/core';
import { ProjectItemWithIssue } from '../types/project';
import KanbanCard from './KanbanCard';

interface KanbanColumnProps {
  column: string;
  items: ProjectItemWithIssue[];
  onItemClick?: (issueId: number, issueType: 'memo' | 'task') => void;
}

export default function KanbanColumn({ column, items, onItemClick }: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: column,
    data: {
      type: 'kanban-column',
      column
    }
  });

  return (
    <div className="flex flex-col min-w-[320px] max-w-[320px]">
      {/* Column Header */}
      <div className="bg-gray-50 px-4 py-2 rounded-t-lg border border-gray-200 border-b-0">
        <h3 className="font-semibold text-gray-900">
          {column} <span className="text-gray-500 font-normal">({items.length})</span>
        </h3>
      </div>

      {/* Drop Zone */}
      <div
        ref={setNodeRef}
        className={`
          flex-1 bg-gray-50 p-4 rounded-b-lg border border-gray-200
          min-h-[500px] space-y-2
          ${isOver ? 'bg-github-green-50 border-github-green-300' : ''}
        `}
      >
        {items.length === 0 ? (
          <p className="text-gray-400 text-sm text-center py-8">
            No items
          </p>
        ) : (
          items.map(item => <KanbanCard key={item.id} item={item} onItemClick={onItemClick} />)
        )}
      </div>
    </div>
  );
}

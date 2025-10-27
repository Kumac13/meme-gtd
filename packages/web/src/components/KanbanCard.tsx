import { useDraggable } from '@dnd-kit/core';
import { ProjectItemWithIssue } from '../types/project';

interface KanbanCardProps {
  item: ProjectItemWithIssue;
}

export default function KanbanCard({ item }: KanbanCardProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: item.issueId.toString(),
    data: {
      item,
      type: 'kanban-card'
    }
  });

  const style = transform
    ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
      }
    : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={`
        bg-white p-3 rounded border border-gray-200
        cursor-move hover:shadow-md transition-shadow
        ${isDragging ? 'opacity-50' : ''}
      `}
    >
      <div className="flex items-start justify-between mb-2">
        <span className="text-xs text-gray-500">#{item.issueId}</span>
        <span className={`
          text-xs px-2 py-0.5 rounded
          ${item.issue.type === 'task' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'}
        `}>
          {item.issue.type}
        </span>
      </div>
      <p className="text-sm font-medium text-gray-900">
        {item.issue.title}
      </p>
    </div>
  );
}

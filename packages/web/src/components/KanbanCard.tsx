import { useDraggable } from '@dnd-kit/core';
import { ProjectItemWithIssue } from '../types/project';
import { InlineMarkdownRenderer, extractFirstLine } from '../utils/markdown';

interface KanbanCardProps {
  item: ProjectItemWithIssue;
  onItemClick?: (issueId: number, issueType: 'memo' | 'task') => void;
}

export default function KanbanCard({ item, onItemClick }: KanbanCardProps) {
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

  const handleClick = () => {
    // Only handle click if not dragging
    if (!isDragging && onItemClick) {
      onItemClick(item.issueId, item.issue.type);
    }
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      className={`
        bg-white p-3 rounded border border-gray-200
        hover:shadow-md transition-shadow cursor-pointer
        ${isDragging ? 'opacity-50' : ''}
      `}
    >
      <div className="flex items-start justify-between mb-2" {...listeners}>
        <span className="text-xs text-gray-500">#{item.issueId}</span>
        <span className={`
          text-xs px-2 py-0.5 rounded
          ${item.issue.type === 'task' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'}
        `}>
          {item.issue.type}
        </span>
      </div>
      <div
        onClick={handleClick}
        className="text-sm font-medium text-gray-900 hover:text-github-green-600"
      >
        {item.issue.title ? (
          <InlineMarkdownRenderer content={extractFirstLine(item.issue.title, 80)} />
        ) : (
          <span className="text-gray-500">{item.issue.type === 'memo' ? 'Memo' : 'Task'} #{item.issueId}</span>
        )}
      </div>
    </div>
  );
}

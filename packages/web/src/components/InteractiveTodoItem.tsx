import { Children, isValidElement, type CSSProperties, type ReactNode } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface InteractiveTodoItemProps {
  todoIndex: number;
  checked: boolean;
  onToggle: (idx: number, nextChecked: boolean) => void;
  sortable?: boolean;
  disabled?: boolean;
  children: ReactNode;
}

function withoutLeadingInput(children: ReactNode): ReactNode[] {
  const arr = Children.toArray(children);
  let skipped = false;
  return arr.filter((child) => {
    if (!skipped && isValidElement(child) && child.type === 'input') {
      skipped = true;
      return false;
    }
    return true;
  });
}

function GripIcon() {
  return (
    <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 16 16" aria-hidden="true">
      <path d="M5.5 3.5a1 1 0 1 1-2 0 1 1 0 0 1 2 0Zm0 4a1 1 0 1 1-2 0 1 1 0 0 1 2 0Zm0 4a1 1 0 1 1-2 0 1 1 0 0 1 2 0Zm7-8a1 1 0 1 1-2 0 1 1 0 0 1 2 0Zm0 4a1 1 0 1 1-2 0 1 1 0 0 1 2 0Zm0 4a1 1 0 1 1-2 0 1 1 0 0 1 2 0Z" />
    </svg>
  );
}

export function todoSortableId(todoIndex: number): string {
  return `todo-${todoIndex}`;
}

export function todoIndexFromSortableId(id: string | number): number | null {
  const str = String(id);
  if (!str.startsWith('todo-')) return null;
  const n = parseInt(str.slice(5), 10);
  return Number.isNaN(n) ? null : n;
}

export function InteractiveTodoItem({
  todoIndex,
  checked,
  onToggle,
  sortable = false,
  disabled = false,
  children,
}: InteractiveTodoItemProps) {
  const filtered = withoutLeadingInput(children);

  if (!sortable) {
    return (
      <li className="list-none flex items-start gap-2">
        <input
          type="checkbox"
          checked={checked}
          disabled={disabled}
          onChange={(e) => onToggle(todoIndex, e.target.checked)}
          className="mt-1.5 cursor-pointer flex-shrink-0 accent-github-green-600"
          aria-label={`Toggle todo item ${todoIndex + 1}`}
        />
        <span className="flex-1 min-w-0">{filtered}</span>
      </li>
    );
  }

  return (
    <SortableTodoItem
      todoIndex={todoIndex}
      checked={checked}
      onToggle={onToggle}
      disabled={disabled}
    >
      {filtered}
    </SortableTodoItem>
  );
}

interface SortableTodoItemProps {
  todoIndex: number;
  checked: boolean;
  onToggle: (idx: number, nextChecked: boolean) => void;
  disabled: boolean;
  children: ReactNode;
}

function SortableTodoItem({ todoIndex, checked, onToggle, disabled, children }: SortableTodoItemProps) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
    id: todoSortableId(todoIndex),
  });

  const style: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : undefined,
  };

  return (
    <li
      ref={setNodeRef}
      style={style}
      className="list-none flex items-start gap-2 group"
    >
      <button
        ref={setActivatorNodeRef}
        {...listeners}
        {...attributes}
        type="button"
        tabIndex={-1}
        aria-label={`Reorder todo item ${todoIndex + 1}`}
        className="mt-1.5 flex-shrink-0 text-gray-300 hover:text-gray-500 cursor-grab active:cursor-grabbing focus:outline-none"
      >
        <GripIcon />
      </button>
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled || isDragging}
        onChange={(e) => onToggle(todoIndex, e.target.checked)}
        className="mt-1.5 cursor-pointer flex-shrink-0 accent-github-green-600"
        aria-label={`Toggle todo item ${todoIndex + 1}`}
      />
      <span className="flex-1 min-w-0">{children}</span>
    </li>
  );
}

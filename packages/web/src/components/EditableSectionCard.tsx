import { useRef, type ReactNode } from 'react';
import { useOutsideClick } from '../hooks/useOutsideClick';

interface EditableSectionCardProps {
  title: string;
  isEditing: boolean;
  onEditingChange: (isEditing: boolean) => void;
  loading?: boolean;
  error?: string | null;
  children: ReactNode;
}

/** Shared detail card shell for inline editors such as task/project schedules. */
export function EditableSectionCard({
  title,
  isEditing,
  onEditingChange,
  loading = false,
  error,
  children,
}: EditableSectionCardProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useOutsideClick(containerRef, isEditing, () => onEditingChange(false));

  return (
    <div className="bg-gray-50 border border-gray-200 rounded-lg p-4" ref={containerRef}>
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
        {loading && <span className="text-xs text-gray-500">Saving...</span>}
      </div>
      {error && <div className="text-red-600 text-xs mb-2">{error}</div>}
      {children}
    </div>
  );
}

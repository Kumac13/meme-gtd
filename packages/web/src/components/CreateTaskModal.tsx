/**
 * CreateTaskModal Component
 *
 * Modal for creating a new task from the task detail page.
 * Displays TaskForm in a right-half overlay panel (same pattern as TaskDetailPanel).
 * Pre-configures a 'relates' link to the source task.
 */

import TaskForm from './TaskForm';
import type { PendingLink } from '../types/links';

interface CreateTaskModalProps {
  /** Whether the modal is open */
  isOpen: boolean;
  /** Callback when the modal is closed */
  onClose: () => void;
  /** Source task information for creating default link */
  sourceTask: {
    id: number;
    title: string;
  };
  /** Callback when a new task is created */
  onTaskCreated?: (taskId: number) => void;
}

export default function CreateTaskModal({
  isOpen,
  onClose,
  sourceTask,
  onTaskCreated,
}: CreateTaskModalProps) {
  if (!isOpen) return null;

  // Pre-configure a 'relates' link to the source task
  const initialLinks: PendingLink[] = [
    {
      linkKind: 'issue',
      targetIssueId: sourceTask.id,
      linkType: 'relates',
      targetIssue: {
        id: sourceTask.id,
        type: 'task',
        title: sourceTask.title,
      },
    },
  ];

  const handleTaskCreated = (taskId: number) => {
    onTaskCreated?.(taskId);
    onClose();
  };

  return (
    <>
      {/* Backdrop: semi-transparent on mobile, invisible on desktop */}
      <div
        className="fixed inset-0 z-40 bg-black/20 sm:bg-transparent"
        onClick={onClose}
      />

      {/* Panel: full width on mobile, right half on desktop */}
      <div className="fixed top-0 right-0 bottom-0 w-full sm:w-1/2 bg-white shadow-xl border-l border-gray-200 z-50 flex flex-col overflow-hidden rounded-t-xl sm:rounded-none">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 flex-shrink-0">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <h2 className="text-lg font-semibold text-gray-900">
              Create New Task
            </h2>
            <span className="text-sm text-gray-500">
              from #{sourceTask.id}
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-gray-100 transition-colors flex-shrink-0 ml-2"
            aria-label="Close"
          >
            <svg
              className="w-5 h-5 text-gray-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Content - TaskForm */}
        <div className="flex-1 overflow-y-auto p-6">
          <TaskForm
            mode="create"
            initialLinks={initialLinks}
            onTaskCreated={handleTaskCreated}
          />
        </div>
      </div>
    </>
  );
}

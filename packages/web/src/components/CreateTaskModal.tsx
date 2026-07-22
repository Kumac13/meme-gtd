/**
 * CreateTaskModal Component
 *
 * Modal for creating a new task from the task detail page.
 * Displays TaskForm in a right-half overlay panel (same pattern as TaskDetailPanel).
 * Pre-configures a 'relates' link to the source task.
 */

import TaskForm from './TaskForm';
import SidePanel from './SidePanel';
import TemplateCreationFlow from './TemplateCreationFlow';
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
    <SidePanel
      onClose={onClose}
      contentClassName="p-6"
      header={
        <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold text-gray-900">
              Create New Task
            </h2>
            <span className="text-sm text-gray-500">
              from #{sourceTask.id}
            </span>
        </div>
      }
    >
      <TemplateCreationFlow target="task">
        {(initialValues) => (
          <TaskForm
            mode="create"
            initialBodyMd={initialValues.bodyMd}
            initialLabelIds={initialValues.labelIds}
            initialProjectIds={initialValues.projectIds}
            initialLinks={initialLinks}
            onTaskCreated={handleTaskCreated}
          />
        )}
      </TemplateCreationFlow>
    </SidePanel>
  );
}

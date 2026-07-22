/**
 * CreateTaskFromProjectModal Component
 *
 * Modal for creating a new task from the project page (Kanban or List view).
 * Displays TaskForm in a right-half overlay panel (same pattern as CreateTaskModal).
 * Pre-selects and locks the current project so it cannot be deselected.
 */

import TaskForm from './TaskForm';
import SidePanel from './SidePanel';

interface CreateTaskFromProjectModalProps {
  /** Whether the modal is open */
  isOpen: boolean;
  /** Callback when the modal is closed */
  onClose: () => void;
  /** Current project information */
  project: {
    id: number;
    name: string;
  };
  /** Callback when a new task is created */
  onTaskCreated?: (taskId: number) => void;
}

export default function CreateTaskFromProjectModal({
  isOpen,
  onClose,
  project,
  onTaskCreated,
}: CreateTaskFromProjectModalProps) {
  if (!isOpen) return null;

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
            <span className="text-sm text-gray-500 truncate">
              in {project.name}
            </span>
        </div>
      }
    >
      <TaskForm
        mode="create"
        initialProjectId={project.id}
        onTaskCreated={handleTaskCreated}
        onCancel={onClose}
      />
    </SidePanel>
  );
}

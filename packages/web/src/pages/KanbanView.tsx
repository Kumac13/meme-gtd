import { useOutletContext } from 'react-router-dom';
import { ProjectDetail } from '../types/project';
import EmptyState from '../components/EmptyState';

interface OutletContext {
  project: ProjectDetail;
  setProject: (project: ProjectDetail) => void;
}

export default function KanbanView() {
  const { project } = useOutletContext<OutletContext>();

  if (project.items.length === 0) {
    return <EmptyState message="No items in this project. Add tasks or memos to get started." />;
  }

  // TODO: Replace with KanbanBoard component in T008
  return (
    <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
      <p className="text-gray-600">Kanban view - Coming in T008</p>
      <p className="text-sm text-gray-500 mt-2">
        {project.items.length} items in project
      </p>
    </div>
  );
}

import { useOutletContext } from 'react-router-dom';
import { ProjectDetail } from '../types/project';
import KanbanBoard from '../components/KanbanBoard';
import EmptyState from '../components/EmptyState';

interface OutletContext {
  project: ProjectDetail;
  setProject: (project: ProjectDetail) => void;
}

export default function KanbanView() {
  const { project, setProject } = useOutletContext<OutletContext>();

  if (!project.items || project.items.length === 0) {
    return <EmptyState message="No items in this project. Add tasks or memos to get started." />;
  }

  return <KanbanBoard project={project} onProjectUpdate={setProject} />;
}

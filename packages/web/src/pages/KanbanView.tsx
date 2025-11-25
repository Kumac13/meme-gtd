import { useState, useCallback } from 'react';
import { useOutletContext } from 'react-router-dom';
import { ProjectDetail } from '../types/project';
import KanbanBoard from '../components/KanbanBoard';
import EmptyState from '../components/EmptyState';
import { ItemDetailPanel } from '../components/ItemDetailPanel';

interface OutletContext {
  project: ProjectDetail;
  setProject: (project: ProjectDetail) => void;
}

export default function KanbanView() {
  const { project, setProject } = useOutletContext<OutletContext>();
  const [selectedItem, setSelectedItem] = useState<{ id: number; type: 'memo' | 'task' } | null>(null);

  const handleItemClick = useCallback((issueId: number, issueType: 'memo' | 'task') => {
    setSelectedItem({ id: issueId, type: issueType });
  }, []);

  const handlePanelClose = useCallback(() => {
    setSelectedItem(null);
  }, []);

  const handleItemUpdated = useCallback(async () => {
    // Refetch project to update kanban board
    try {
      const response = await fetch(`/api/projects/${project.id}`);
      if (response.ok) {
        const updatedProject = await response.json();
        setProject(updatedProject);
      }
    } catch (err) {
      console.error('Error refetching project:', err);
    }
  }, [project.id, setProject]);

  if (!project.items || project.items.length === 0) {
    return <EmptyState message="No items in this project. Add tasks or memos to get started." />;
  }

  return (
    <>
      <KanbanBoard
        project={project}
        onProjectUpdate={setProject}
        onItemClick={handleItemClick}
      />
      <ItemDetailPanel
        itemId={selectedItem?.id ?? null}
        itemType={selectedItem?.type ?? null}
        onClose={handlePanelClose}
        onItemUpdated={handleItemUpdated}
      />
    </>
  );
}

import { useCallback, useEffect, useState } from 'react';
import type { IssueType } from 'meme-gtd-shared';
import { ProjectsService } from '../api/services/ProjectsService';
import { useRecentProjects } from '../hooks/useRecentProjects';
import type { Project, ProjectWithMeta } from '../types/project';
import { PROJECT_STATUS_LABELS, sortProjectsByStatus } from '../utils/projectStatus';
import { ManagementSection } from './ManagementSection';

interface ProjectsSectionProps {
  itemId: number;
  itemType: IssueType | 'template';
}

export function ProjectsSection({ itemId, itemType: _itemType }: ProjectsSectionProps) {
  const [associatedProjects, setAssociatedProjects] = useState<ProjectWithMeta[]>([]);
  const [allProjects, setAllProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [saving, setSaving] = useState(false);
  const { addRecentProject, getRecentProjects } = useRecentProjects();

  const fetchProjects = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [associated, all] = await Promise.all([
        ProjectsService.getProjectsForIssue(String(itemId)),
        ProjectsService.listProjects(),
      ]);
      setAssociatedProjects(associated.map((project) => ({
        ...project,
        description: project.description || '',
        status: 'In Progress' as const,
      })));
      setAllProjects(all);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Failed to fetch projects');
    } finally {
      setLoading(false);
    }
  }, [itemId]);

  useEffect(() => {
    void fetchProjects();
  }, [fetchProjects]);

  const toggleProject = async (projectId: number, associated: boolean) => {
    try {
      setSaving(true);
      setError(null);
      if (associated) {
        await ProjectsService.removeProjectItem(String(projectId), String(itemId));
      } else {
        await ProjectsService.addProjectItem(String(projectId), { issueId: itemId });
        addRecentProject(projectId);
      }
      await fetchProjects();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Failed to update project');
    } finally {
      setSaving(false);
    }
  };

  const filteredProjects = sortProjectsByStatus(allProjects.filter((project) =>
    !searchQuery.trim() || project.name.toLowerCase().includes(searchQuery.toLowerCase())
  ));
  const recentProjects = getRecentProjects(filteredProjects);
  const associatedIds = new Set(associatedProjects.map((project) => project.id));

  const projectOption = (project: Project) => {
    const associated = associatedIds.has(project.id);
    return (
      <label key={project.id} className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-gray-50 cursor-pointer">
        <input
          type="checkbox"
          checked={associated}
          onChange={() => void toggleProject(project.id, associated)}
          disabled={saving}
          style={{ accentColor: '#16a34a', colorScheme: 'light' }}
          className="w-4 h-4 rounded border-gray-300"
        />
        <span className="text-sm text-gray-900 truncate">{project.name}</span>
        <span className="text-xs text-gray-400 ml-auto shrink-0">
          {PROJECT_STATUS_LABELS[project.status] || project.status}
        </span>
      </label>
    );
  };

  return (
    <ManagementSection
      title="Projects"
      ariaLabel="Manage projects"
      loading={loading}
      loadingMessage="Loading projects..."
      error={error}
      searchQuery={searchQuery}
      onSearchQueryChange={setSearchQuery}
      searchPlaceholder="Filter projects"
      summary={associatedProjects.length === 0 ? (
        <div className="text-gray-500 text-sm">No projects yet</div>
      ) : associatedProjects.map((project) => {
        const status = allProjects.find((candidate) => candidate.id === project.id)?.status;
        return (
          <div key={project.id} className="text-sm">
            <div className="font-medium text-gray-900 truncate">{project.name}</div>
            <div className="text-gray-500 text-xs">{status ? PROJECT_STATUS_LABELS[status] || status : project.status}</div>
          </div>
        );
      })}
    >
      {recentProjects.length > 0 && (
        <div className="mb-4">
          <h4 className="text-xs font-semibold text-gray-500 uppercase px-2 mb-2">Recent</h4>
          <div className="space-y-1">{recentProjects.map(projectOption)}</div>
        </div>
      )}
      <div>
        <h4 className="text-xs font-semibold text-gray-500 uppercase px-2 mb-2">Organization</h4>
        <div className="space-y-1">
          {filteredProjects.length > 0
            ? filteredProjects.map(projectOption)
            : <div className="px-2 py-4 text-sm text-gray-500 text-center">{searchQuery.trim() ? 'No projects match your search' : 'No projects available'}</div>}
        </div>
      </div>
    </ManagementSection>
  );
}

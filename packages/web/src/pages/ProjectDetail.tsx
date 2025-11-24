import { useState, useEffect } from 'react';
import { useParams, Outlet, Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { ProjectsService } from '../api/services/ProjectsService';
import { ProjectDetail as ProjectDetailType } from '../types/project';
import LoadingState from '../components/LoadingState';
import ErrorState from '../components/ErrorState';
import EditableContent from '../components/EditableContent';
import { ProjectScheduleSection } from '../components/ProjectScheduleSection';
import { createBackUrl } from '../utils/navigationHelpers';

export default function ProjectDetail() {
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const returnFiltersEncoded = searchParams.get('returnFilters');

  const [project, setProject] = useState<ProjectDetailType | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchProject() {
      if (!id) return;
      try {
        setLoading(true);
        setError(null);
        const data = await ProjectsService.getProject(id);
        setProject(data as ProjectDetailType);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load project');
      } finally {
        setLoading(false);
      }
    }
    fetchProject();
  }, [id]);

  const handleSave = async (description: string, name?: string) => {
    if (!id) return;
    try {
      const updated = await ProjectsService.updateProject(id, {
        name: name || project?.name,
        description: description || null,
      });
      setProject(updated as ProjectDetailType);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update project');
      throw err;
    }
  };

  const handleStatusChange = async (status: string) => {
    if (!id) return;
    try {
      const updated = await ProjectsService.updateProject(id, {
        status: status as 'planned' | 'active' | 'paused' | 'done' | 'canceled',
      });
      setProject(updated as ProjectDetailType);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update status');
      throw err;
    }
  };

  const handleScheduleChange = async (updates: { startDate?: string | null; endDate?: string | null }) => {
    if (!id) return;
    try {
      const updated = await ProjectsService.updateProject(id, updates);
      setProject(updated as ProjectDetailType);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update schedule');
      throw err;
    }
  };

  const handleDelete = async () => {
    if (!id) return;
    try {
      await ProjectsService.deleteProject(id);
      navigate('/projects');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete project');
      throw err;
    }
  };

  if (loading) return <LoadingState message="Loading project..." />;
  if (error) return <ErrorState error={error} />;
  if (!project) return <ErrorState error="Project not found" />;

  const isKanban = location.pathname.includes('/kanban');
  const isList = location.pathname.includes('/list');
  const backUrl = createBackUrl({
    basePath: '/projects',
    returnFiltersEncoded,
  });

  return (
    <div className="max-w-7xl mx-auto px-4 py-2">
      {/* Header */}
      <div className="mb-4">
        <Link
          to={backUrl}
          className="text-github-green-600 hover:text-github-green-800 text-sm font-medium mb-4 inline-block"
        >
          ← Back to projects
        </Link>
        <h1 className="text-3xl font-bold text-gray-900 mb-4">{project.name}</h1>
      </div>

      {/* Status Selector */}
      <div className="mb-4">
        <select
          value={project.status}
          onChange={(e) => handleStatusChange(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-md shadow-sm text-sm focus:outline-none focus:ring-2 focus:ring-github-green-500 focus:border-github-green-500"
        >
          <option value="planned">Planned</option>
          <option value="active">Active</option>
          <option value="paused">Paused</option>
          <option value="done">Done</option>
          <option value="canceled">Canceled</option>
        </select>
      </div>

      {/* Editable Content Section */}
      <div className="mb-4">
        <EditableContent
          content={project.description || ''}
          createdAt={project.createdAt}
          updatedAt={project.createdAt}
          onSave={handleSave}
          onDelete={handleDelete}
          title={project.name}
          showTitleEdit={true}
        />
      </div>

      {/* Project Schedule */}
      <div className="mb-6">
        <ProjectScheduleSection
          startDate={project.startDate}
          endDate={project.endDate}
          onScheduleChange={handleScheduleChange}
        />
      </div>

      {/* View Tabs */}
      <div className="flex gap-4 mb-4 border-b border-gray-200">
        <Link
          to={`/projects/${id}/kanban`}
          className={`px-4 py-2 ${isKanban
              ? 'border-b-2 border-github-green-500 text-gray-900 font-medium'
              : 'text-gray-500 hover:text-gray-700'
            }`}
        >
          Kanban
        </Link>
        <Link
          to={`/projects/${id}/list`}
          className={`px-4 py-2 ${isList
              ? 'border-b-2 border-github-green-500 text-gray-900 font-medium'
              : 'text-gray-500 hover:text-gray-700'
            }`}
        >
          Lists
        </Link>
      </div>

      {/* Child View (Kanban or List) */}
      <Outlet context={{ project, setProject }} />
    </div>
  );
}

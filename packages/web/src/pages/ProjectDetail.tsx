import { useState, useEffect } from 'react';
import { useParams, Outlet, Link, useLocation } from 'react-router-dom';
import { ProjectsService } from '../api/services/ProjectsService';
import { ProjectDetail as ProjectDetailType } from '../types/project';
import LoadingState from '../components/LoadingState';
import ErrorState from '../components/ErrorState';

export default function ProjectDetail() {
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
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
        setProject(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load project');
      } finally {
        setLoading(false);
      }
    }
    fetchProject();
  }, [id]);

  if (loading) return <LoadingState message="Loading project..." />;
  if (error) return <ErrorState error={error} />;
  if (!project) return <ErrorState error="Project not found" />;

  const isKanban = location.pathname.includes('/kanban');
  const isList = location.pathname.includes('/list');

  return (
    <div className="max-w-7xl mx-auto px-4 py-2">
      {/* Header */}
      <div className="mb-4">
        <h1 className="text-3xl font-bold">{project.name}</h1>
        {project.description && (
          <p className="text-gray-600 mt-2">{project.description}</p>
        )}
      </div>

      {/* View Tabs */}
      <div className="flex gap-4 mb-4 border-b border-gray-200">
        <Link
          to={`/projects/${id}/kanban`}
          className={`px-4 py-2 ${
            isKanban
              ? 'border-b-2 border-github-green-500 text-gray-900 font-medium'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          Kanban
        </Link>
        <Link
          to={`/projects/${id}/list`}
          className={`px-4 py-2 ${
            isList
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

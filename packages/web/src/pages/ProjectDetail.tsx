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
  const [editingName, setEditingName] = useState(false);
  const [editingDescription, setEditingDescription] = useState(false);
  const [nameValue, setNameValue] = useState('');
  const [descriptionValue, setDescriptionValue] = useState('');

  useEffect(() => {
    async function fetchProject() {
      if (!id) return;
      try {
        setLoading(true);
        setError(null);
        const data = await ProjectsService.getProject(id);
        setProject(data as ProjectDetailType);
        setNameValue(data.name);
        setDescriptionValue(data.description || '');
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load project');
      } finally {
        setLoading(false);
      }
    }
    fetchProject();
  }, [id]);

  const handleNameSave = async () => {
    if (!id || !nameValue.trim()) return;
    try {
      const updated = await ProjectsService.updateProject(id, { name: nameValue });
      setProject(updated as ProjectDetailType);
      setEditingName(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update name');
    }
  };

  const handleDescriptionSave = async () => {
    if (!id) return;
    try {
      const updated = await ProjectsService.updateProject(id, { description: descriptionValue || null });
      setProject(updated as ProjectDetailType);
      setEditingDescription(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update description');
    }
  };

  if (loading) return <LoadingState message="Loading project..." />;
  if (error) return <ErrorState error={error} />;
  if (!project) return <ErrorState error="Project not found" />;

  const isKanban = location.pathname.includes('/kanban');
  const isList = location.pathname.includes('/list');

  return (
    <div className="max-w-7xl mx-auto px-4 py-2">
      {/* Header */}
      <div className="mb-4">
        {editingName ? (
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={nameValue}
              onChange={(e) => setNameValue(e.target.value)}
              onBlur={handleNameSave}
              onKeyDown={(e) => e.key === 'Enter' && handleNameSave()}
              className="text-3xl font-bold border-b-2 border-github-green-500 focus:outline-none flex-1"
              autoFocus
            />
          </div>
        ) : (
          <h1
            className="text-3xl font-bold cursor-pointer hover:text-github-green-600"
            onClick={() => setEditingName(true)}
          >
            {project.name}
          </h1>
        )}

        {editingDescription ? (
          <div className="mt-2">
            <textarea
              value={descriptionValue}
              onChange={(e) => setDescriptionValue(e.target.value)}
              onBlur={handleDescriptionSave}
              className="w-full text-gray-600 border border-gray-300 rounded p-2 focus:outline-none focus:border-github-green-500"
              rows={3}
              autoFocus
            />
          </div>
        ) : (
          <p
            className="text-gray-600 mt-2 cursor-pointer hover:text-gray-800"
            onClick={() => setEditingDescription(true)}
          >
            {project.description || 'Click to add description...'}
          </p>
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

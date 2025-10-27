import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ProjectsService } from '../api/services/ProjectsService';
import ItemList from '../components/ItemList';
import LoadingState from '../components/LoadingState';
import ErrorState from '../components/ErrorState';
import EmptyState from '../components/EmptyState';

interface Project {
  id: number;
  name: string;
  description: string | null;
  createdAt: string;
}

export default function ProjectsList() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchProjects() {
      try {
        setLoading(true);
        setError(null);
        const response = await ProjectsService.listProjects();
        setProjects(response || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load projects');
        console.error('Error fetching projects:', err);
      } finally {
        setLoading(false);
      }
    }

    fetchProjects();
  }, []);

  if (loading) {
    return <LoadingState message="Loading projects..." />;
  }

  if (error) {
    return <ErrorState error={error} title="Error loading projects" />;
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-2">
      <div className="flex items-center justify-end mb-3">
        <Link
          to="/projects/new"
          className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-github-green-600 hover:bg-github-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-github-green-500"
        >
          New project
        </Link>
      </div>

      {projects.length === 0 ? (
        <EmptyState
          message="No projects yet"
          submessage="Create your first project to get started"
        />
      ) : (
        <ItemList items={projects} itemType="project" basePath="/projects" />
      )}
    </div>
  );
}

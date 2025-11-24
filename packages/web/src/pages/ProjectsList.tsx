import { useState, useEffect, useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ProjectsService } from '../api/services/ProjectsService';
import ItemList from '../components/ItemList';
import FilterBar from '../components/FilterBar';
import LoadingState from '../components/LoadingState';
import ErrorState from '../components/ErrorState';
import EmptyState from '../components/EmptyState';

interface Project {
  id: number;
  name: string;
  description: string | null;
  status: 'planned' | 'active' | 'paused' | 'done' | 'canceled';
  startDate: string | null;
  endDate: string | null;
  createdAt: string;
}

const statusLabels: Record<string, string> = {
  planned: 'Planned',
  active: 'Active',
  paused: 'Paused',
  done: 'Done',
  canceled: 'Canceled',
};

export default function ProjectsList() {
  const [searchParams, setSearchParams] = useSearchParams();
  const statusParam = searchParams.get('status') || 'active';
  const statusFilter = ['all', 'planned', 'active', 'paused', 'done', 'canceled'].includes(statusParam)
    ? statusParam
    : 'active';

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

  const filteredProjects = useMemo(() => {
    return projects.filter((project) => {
      // Status filter
      if (statusFilter !== 'all' && project.status !== statusFilter) return false;
      return true;
    });
  }, [projects, statusFilter]);

  const handleStatusFilterChange = (newStatus: string) => {
    const params = new URLSearchParams(searchParams);
    if (newStatus === 'active') {
      params.delete('status');
    } else {
      params.set('status', newStatus);
    }
    setSearchParams(params);
  };

  const handleDelete = async (id: number) => {
    await ProjectsService.deleteProject(String(id));
    setProjects(projects.filter((project) => project.id !== id));
  };

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

      <FilterBar
        showStatusFilter
        statusFilter={statusFilter}
        onStatusFilterChange={handleStatusFilterChange}
        statusOptions={['all', 'planned', 'active', 'paused', 'done', 'canceled']}
        statusLabels={statusLabels}
        showBookmarkFilter={false}
      />

      {filteredProjects.length === 0 ? (
        <EmptyState
          message="No projects found"
          submessage="Create your first project or adjust filters"
        />
      ) : (
        <ItemList items={filteredProjects} itemType="project" basePath="/projects" currentFilters={searchParams} onDelete={handleDelete} />
      )}
    </div>
  );
}

import { useState, useEffect, useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ProjectsService } from '../api/services/ProjectsService';
import ItemList from '../components/ItemList';
import FilterBar from '../components/FilterBar';
import LoadingState from '../components/LoadingState';
import ErrorState from '../components/ErrorState';
import EmptyState from '../components/EmptyState';
import { validateBookmarked, updateBookmarkedParam } from '../utils/urlFilterHelpers';

interface Project {
  id: number;
  name: string;
  description: string | null;
  status: string;
  startDate: string | null;
  endDate: string | null;
  createdAt: string;
}

export default function ProjectsList() {
  const [searchParams, setSearchParams] = useSearchParams();
  const bookmarkFilter = validateBookmarked(searchParams.get('bookmarked'));
  const [statusFilter, setStatusFilter] = useState<string>('all');

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

      // Note: Projects don't have isBookmarked property yet
      // This is a placeholder for when bookmark support is added
      // if (bookmarkFilter && !project.isBookmarked) return false;
      return true;
    });
  }, [projects, bookmarkFilter, statusFilter]);

  const handleBookmarkFilterChange = (newBookmarked: boolean) => {
    const params = updateBookmarkedParam(searchParams, newBookmarked);
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
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="block w-32 pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-github-green-500 focus:border-github-green-500 sm:text-sm rounded-md"
          >
            <option value="all">All Status</option>
            <option value="planned">Planned</option>
            <option value="active">Active</option>
            <option value="paused">Paused</option>
            <option value="done">Done</option>
            <option value="canceled">Canceled</option>
          </select>
        </div>
        <Link
          to="/projects/new"
          className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-github-green-600 hover:bg-github-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-github-green-500"
        >
          New project
        </Link>
      </div>

      <FilterBar
        bookmarkFilter={bookmarkFilter}
        onBookmarkFilterChange={handleBookmarkFilterChange}
      />

      {filteredProjects.length === 0 ? (
        <EmptyState
          message={bookmarkFilter ? 'No bookmarked projects' : 'No projects found'}
          submessage={!bookmarkFilter ? 'Create your first project or adjust filters' : undefined}
        />
      ) : (
        <ItemList items={filteredProjects} itemType="project" basePath="/projects" currentFilters={searchParams} onDelete={handleDelete} />
      )}
    </div>
  );
}

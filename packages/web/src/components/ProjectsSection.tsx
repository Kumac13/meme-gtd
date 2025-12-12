/**
 * ProjectsSection component
 * Feature: 017-https-github-com
 * User Story 1: View Associated Projects
 */

import { useState, useEffect, useRef } from 'react';
import { ProjectsService } from '../api/services/ProjectsService';
import type { Project, ProjectWithMeta } from '../types/project';
import { useRecentProjects } from '../hooks/useRecentProjects';

interface ProjectsSectionProps {
  itemId: number;
  itemType: 'memo' | 'task' | 'article';
}

export function ProjectsSection({ itemId, itemType: _ }: ProjectsSectionProps) {
  const [associatedProjects, setAssociatedProjects] = useState<ProjectWithMeta[]>([]);
  const [allProjects, setAllProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [saving, setSaving] = useState(false);
  const gearButtonRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const { addRecentProject, getRecentProjects } = useRecentProjects();

  const fetchProjects = async () => {
    try {
      setLoading(true);
      setError(null);
      const [projects, all] = await Promise.all([
        ProjectsService.getProjectsForIssue(String(itemId)),
        ProjectsService.listProjects(),
      ]);
      // Convert Project[] to ProjectWithMeta[] for associated projects
      const projectsWithMeta: ProjectWithMeta[] = projects.map(p => ({
        ...p,
        description: p.description || '',
        status: 'In Progress' as const
      }));
      setAssociatedProjects(projectsWithMeta);
      setAllProjects(all);
    } catch (err) {
      console.error('Failed to fetch projects:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch projects');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProjects();
  }, [itemId]);

  // Close dropdown when clicking outside
  useEffect(() => {
    if (!isDropdownOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        gearButtonRef.current &&
        !gearButtonRef.current.contains(event.target as Node)
      ) {
        setIsDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isDropdownOpen]);

  const handleToggleProject = async (projectId: number, isCurrentlyAssociated: boolean) => {
    try {
      setSaving(true);
      setError(null);

      if (isCurrentlyAssociated) {
        await ProjectsService.removeProjectItem(String(projectId), String(itemId));
      } else {
        await ProjectsService.addProjectItem(String(projectId), { issueId: itemId });
        addRecentProject(projectId);
      }

      await fetchProjects();
    } catch (err) {
      console.error('Failed to toggle project:', err);
      setError(err instanceof Error ? err.message : 'Failed to update project');
    } finally {
      setSaving(false);
    }
  };

  const filteredProjects = allProjects.filter((project) =>
    searchQuery.trim()
      ? project.name.toLowerCase().includes(searchQuery.toLowerCase())
      : true
  );

  const recentProjects = getRecentProjects(filteredProjects);
  const associatedIds = new Set(associatedProjects.map((p) => p.id));

  // Show loading state
  if (loading) {
    return (
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-4">
        <div className="text-gray-500 text-sm">Loading projects...</div>
      </div>
    );
  }

  // Show error state
  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
        <div className="text-red-600 text-sm">Error: {error}</div>
      </div>
    );
  }

  return (
    <div className="relative">
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
        {/* Header with gear icon */}
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-gray-900">Projects</h3>
          <button
            ref={gearButtonRef}
            type="button"
            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            className="p-1 rounded hover:bg-gray-200 transition-colors"
            aria-label="Project settings"
            title="Manage projects"
          >
            <svg
              className="w-4 h-4 text-gray-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
              />
            </svg>
          </button>
        </div>

        {/* Projects list */}
        <div className="space-y-2">
          {associatedProjects.length === 0 ? (
            <div className="text-gray-500 text-sm">
              No projects yet
            </div>
          ) : (
            associatedProjects.map((project) => (
              <div
                key={project.id}
                className="text-sm"
              >
                <div className="font-medium text-gray-900 truncate">
                  {project.name}
                </div>
                <div className="text-gray-500 text-xs">
                  {project.status}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Dropdown */}
      {isDropdownOpen && (
        <div
          ref={dropdownRef}
          className="absolute top-full right-0 mt-2 w-80 bg-white border border-gray-200 rounded-lg shadow-lg z-50 flex flex-col"
          style={{ maxHeight: '400px' }}
        >
          {/* Search */}
          <div className="p-3 border-b border-gray-200">
            <input
              type="text"
              placeholder="Filter projects"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-github-green-500"
            />
          </div>

          {/* Projects list */}
          <div className="overflow-y-auto p-2" style={{ maxHeight: '320px' }}>
            {error && (
              <div className="p-2 mb-2 bg-red-50 border border-red-200 rounded text-red-600 text-sm">
                {error}
              </div>
            )}

            {/* Recent section */}
            {recentProjects.length > 0 && (
              <div className="mb-4">
                <h4 className="text-xs font-semibold text-gray-500 uppercase px-2 mb-2">
                  Recent
                </h4>
                <div className="space-y-1">
                  {recentProjects.map((project) => {
                    const isAssociated = associatedIds.has(project.id);
                    return (
                      <label
                        key={project.id}
                        className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-gray-50 cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={isAssociated}
                          onChange={() => handleToggleProject(project.id, isAssociated)}
                          disabled={saving}
                          style={{
                            accentColor: '#16a34a',
                            colorScheme: 'light',
                          }}
                          className="w-4 h-4 rounded border-gray-300"
                        />
                        <span className="text-sm text-gray-900 truncate">
                          {project.name}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Organization section */}
            <div>
              <h4 className="text-xs font-semibold text-gray-500 uppercase px-2 mb-2">
                Organization
              </h4>
              <div className="space-y-1">
                {filteredProjects.length === 0 ? (
                  <div className="px-2 py-4 text-sm text-gray-500 text-center">
                    {searchQuery.trim() ? 'No projects match your search' : 'No projects available'}
                  </div>
                ) : (
                  filteredProjects.map((project) => {
                    const isAssociated = associatedIds.has(project.id);
                    return (
                      <label
                        key={project.id}
                        className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-gray-50 cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={isAssociated}
                          onChange={() => handleToggleProject(project.id, isAssociated)}
                          disabled={saving}
                          style={{
                            accentColor: '#16a34a',
                            colorScheme: 'light',
                          }}
                          className="w-4 h-4 rounded border-gray-300"
                        />
                        <span className="text-sm text-gray-900 truncate">
                          {project.name}
                        </span>
                      </label>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * ProjectManagementModal component
 * Feature: 017-https-github-com
 * User Stories 2 & 3: Add/Remove Projects
 */

import { useState, useEffect, useMemo } from 'react';
import { ProjectsService } from '../api/services/ProjectsService';
import type { Project } from '../types/project';
import { useRecentProjects } from '../hooks/useRecentProjects';

interface ProjectManagementModalProps {
  itemId: number;
  itemType: 'memo' | 'task';
  isOpen: boolean;
  onClose: () => void;
  onProjectsChanged: () => void;
}

export function ProjectManagementModal({
  itemId,
  isOpen,
  onClose,
  onProjectsChanged,
}: ProjectManagementModalProps) {
  const [allProjects, setAllProjects] = useState<Project[]>([]);
  const [associatedProjectIds, setAssociatedProjectIds] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const { addRecentProject, getRecentProjects } = useRecentProjects();

  useEffect(() => {
    if (!isOpen) return;

    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);

        // Fetch all projects and associated projects in parallel
        const [projects, associated] = await Promise.all([
          ProjectsService.listProjects(),
          ProjectsService.getProjectsForIssue(itemId),
        ]);

        setAllProjects(projects);
        setAssociatedProjectIds(new Set(associated.map((p) => p.id)));
      } catch (err) {
        console.error('Failed to fetch projects:', err);
        setError(err instanceof Error ? err.message : 'Failed to fetch projects');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [itemId, isOpen]);

  const handleToggleProject = async (projectId: number, isCurrentlyAssociated: boolean) => {
    try {
      setSaving(true);
      setError(null);

      if (isCurrentlyAssociated) {
        // Remove project association
        await ProjectsService.removeProjectItem(projectId, itemId);
        setAssociatedProjectIds((prev) => {
          const next = new Set(prev);
          next.delete(projectId);
          return next;
        });
      } else {
        // Add project association
        await ProjectsService.addProjectItem(projectId, {
          issueId: itemId,
        });
        setAssociatedProjectIds((prev) => new Set(prev).add(projectId));

        // Track as recent project (only on add, not remove)
        addRecentProject(projectId);
      }

      // Notify parent to refresh
      onProjectsChanged();
    } catch (err) {
      console.error('Failed to toggle project:', err);
      setError(err instanceof Error ? err.message : 'Failed to update project');
    } finally {
      setSaving(false);
    }
  };

  // Filter projects based on search query
  const filteredProjects = useMemo(() => {
    if (!searchQuery.trim()) return allProjects;
    const query = searchQuery.toLowerCase();
    return allProjects.filter((project) =>
      project.name.toLowerCase().includes(query)
    );
  }, [allProjects, searchQuery]);

  // Get recent projects (respects search filter)
  const recentProjects = useMemo(() => {
    return getRecentProjects(filteredProjects);
  }, [filteredProjects, getRecentProjects]);

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black bg-opacity-50 z-40"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[80vh] flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">
              Manage Projects
            </h2>
            <button
              onClick={onClose}
              className="p-1 rounded hover:bg-gray-100 transition-colors"
              aria-label="Close"
            >
              <svg
                className="w-5 h-5 text-gray-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-4">
            {/* Search input */}
            <div className="mb-4">
              <input
                type="text"
                placeholder="Filter projects"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm text-sm focus:outline-none focus:ring-2 focus:ring-github-green-500 focus:border-github-green-500"
              />
            </div>

            {loading && (
              <div className="text-center py-8 text-gray-500">
                Loading projects...
              </div>
            )}

            {error && (
              <div className="bg-red-50 border border-red-200 rounded p-3 mb-4">
                <div className="text-red-600 text-sm">{error}</div>
              </div>
            )}

            {!loading && filteredProjects.length === 0 && (
              <div className="text-center py-8 text-gray-500">
                {searchQuery.trim() ? 'No projects match your search' : 'No projects available'}
              </div>
            )}

            {!loading && filteredProjects.length > 0 && (
              <div className="space-y-4">
                {/* Recent section */}
                {recentProjects.length > 0 && (
                  <div>
                    <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">
                      Recent
                    </h4>
                    <div className="space-y-2">
                      {recentProjects.map((project) => {
                        const isAssociated = associatedProjectIds.has(project.id);
                        return (
                          <label
                            key={project.id}
                            className="flex items-start gap-3 p-3 rounded border border-gray-200 hover:bg-gray-50 cursor-pointer transition-colors"
                          >
                            <input
                              type="checkbox"
                              checked={isAssociated}
                              onChange={() => handleToggleProject(project.id, isAssociated)}
                              disabled={saving}
                              className="mt-1 w-4 h-4 text-github-green-600 border-gray-300 rounded focus:ring-github-green-500"
                            />
                            <div className="flex-1 min-w-0">
                              <div className="font-medium text-gray-900">
                                {project.name}
                              </div>
                              {project.description && (
                                <div className="text-sm text-gray-500 mt-1">
                                  {project.description}
                                </div>
                              )}
                            </div>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Organization section */}
                <div>
                  <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">
                    Organization
                  </h4>
                  <div className="space-y-2">
                    {filteredProjects.map((project) => {
                      const isAssociated = associatedProjectIds.has(project.id);
                      return (
                        <label
                          key={project.id}
                          className="flex items-start gap-3 p-3 rounded border border-gray-200 hover:bg-gray-50 cursor-pointer transition-colors"
                        >
                          <input
                            type="checkbox"
                            checked={isAssociated}
                            onChange={() => handleToggleProject(project.id, isAssociated)}
                            disabled={saving}
                            className="mt-1 w-4 h-4 text-github-green-600 border-gray-300 rounded focus:ring-github-green-500"
                          />
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-gray-900">
                              {project.name}
                            </div>
                            {project.description && (
                              <div className="text-sm text-gray-500 mt-1">
                                {project.description}
                              </div>
                            )}
                          </div>
                        </label>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="p-4 border-t border-gray-200">
            <button
              onClick={onClose}
              className="w-full px-4 py-2 bg-github-green-600 text-white rounded-md hover:bg-github-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-github-green-500 transition-colors"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

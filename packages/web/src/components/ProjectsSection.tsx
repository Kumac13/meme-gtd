/**
 * ProjectsSection component
 * Feature: 017-https-github-com
 * User Story 1: View Associated Projects
 */

import { useState, useEffect } from 'react';
import { ProjectsService } from '../api/services/ProjectsService';
import type { ProjectWithMeta } from '../types/project';
import { ProjectManagementModal } from './ProjectManagementModal';

interface ProjectsSectionProps {
  itemId: number;
  itemType: 'memo' | 'task';
}

export function ProjectsSection({ itemId, itemType }: ProjectsSectionProps) {
  const [associatedProjects, setAssociatedProjects] = useState<ProjectWithMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const fetchProjects = async () => {
    try {
      setLoading(true);
      setError(null);
      const projects = await ProjectsService.getProjectsForIssue(itemId);
      setAssociatedProjects(projects);
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

  // Hide section if no projects associated
  if (!loading && associatedProjects.length === 0) {
    return null;
  }

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
    <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-4">
      {/* Header with gear icon */}
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-900">Projects</h3>
        <button
          type="button"
          onClick={() => setIsModalOpen(true)}
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
        {associatedProjects.map((project) => (
          <div
            key={project.id}
            className="flex items-start gap-2 text-sm"
          >
            {/* Icon placeholder */}
            <div className="w-5 h-5 rounded bg-gray-300 flex-shrink-0 mt-0.5" />

            {/* Project info */}
            <div className="flex-1 min-w-0">
              <div className="font-medium text-gray-900 truncate">
                {project.name}
              </div>
              <div className="text-gray-500 text-xs">
                {project.status}
              </div>
            </div>

            {/* Expand arrow */}
            <button
              type="button"
              className="p-1 rounded hover:bg-gray-200 transition-colors flex-shrink-0"
              aria-label="Expand project"
            >
              <svg
                className="w-3 h-3 text-gray-600"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
                  clipRule="evenodd"
                />
              </svg>
            </button>
          </div>
        ))}
      </div>

      {/* Project Management Modal */}
      <ProjectManagementModal
        itemId={itemId}
        itemType={itemType}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onProjectsChanged={fetchProjects}
      />
    </div>
  );
}

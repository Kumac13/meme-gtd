/**
 * useRecentProjects hook
 * Feature: 017-https-github-com
 * User Story 5: Access Recent Projects
 *
 * Manages recently used projects in localStorage
 */

import { useState, useEffect, useCallback } from 'react';
import type { Project, RecentProjectsStorage } from '../types/project';

const STORAGE_KEY = 'mgtd:recentProjects';
const MAX_STORED_PROJECTS = 5;
const MAX_DISPLAYED_RECENT = 2;

/**
 * Parse recent projects from localStorage
 * Returns empty storage on error (Safari private mode, etc.)
 */
function loadRecentProjects(): RecentProjectsStorage {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      return { projectIds: [], lastUsedAt: {} };
    }
    const parsed = JSON.parse(stored);
    return {
      projectIds: Array.isArray(parsed.projectIds) ? parsed.projectIds : [],
      lastUsedAt: typeof parsed.lastUsedAt === 'object' ? parsed.lastUsedAt : {},
    };
  } catch (error) {
    console.error('Failed to load recent projects from localStorage:', error);
    return { projectIds: [], lastUsedAt: {} };
  }
}

/**
 * Save recent projects to localStorage
 */
function saveRecentProjects(storage: RecentProjectsStorage): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(storage));
  } catch (error) {
    console.error('Failed to save recent projects to localStorage:', error);
  }
}

export function useRecentProjects() {
  const [storage, setStorage] = useState<RecentProjectsStorage>(loadRecentProjects);

  /**
   * Add a project to recent list
   * - Updates timestamp
   * - Moves to front of list
   * - Keeps max 5 projects
   */
  const addRecentProject = useCallback((projectId: number) => {
    setStorage((prev) => {
      // Remove existing entry if present
      const filtered = prev.projectIds.filter((id) => id !== projectId);

      // Add to front
      const newProjectIds = [projectId, ...filtered].slice(0, MAX_STORED_PROJECTS);

      // Update timestamp
      const newLastUsedAt = {
        ...prev.lastUsedAt,
        [projectId]: new Date().toISOString(),
      };

      const newStorage = {
        projectIds: newProjectIds,
        lastUsedAt: newLastUsedAt,
      };

      saveRecentProjects(newStorage);
      return newStorage;
    });
  }, []);

  /**
   * Get recent projects sorted by last used time
   * Returns top 2 most recent projects
   */
  const getRecentProjects = useCallback(
    (allProjects: Project[]): Project[] => {
      // Filter to projects that exist in allProjects
      const recentIds = storage.projectIds.filter((id) =>
        allProjects.some((p) => p.id === id)
      );

      // Map to project objects
      const recentProjects = recentIds
        .map((id) => allProjects.find((p) => p.id === id))
        .filter((p): p is Project => p !== undefined);

      // Sort by lastUsedAt (newest first)
      recentProjects.sort((a, b) => {
        const timeA = storage.lastUsedAt[a.id] || '';
        const timeB = storage.lastUsedAt[b.id] || '';
        return timeB.localeCompare(timeA);
      });

      // Return top 2
      return recentProjects.slice(0, MAX_DISPLAYED_RECENT);
    },
    [storage]
  );

  return {
    recentProjectIds: storage.projectIds,
    addRecentProject,
    getRecentProjects,
  };
}

/**
 * ProjectsService - API client for project management endpoints
 * Feature: 017-https-github-com
 *
 * Note: This service wraps existing project API endpoints
 * All endpoints are already implemented in packages/api/src/routes/projects.ts
 */

import type { Project, ProjectWithMeta, ProjectItem } from '../../types/project';

const API_BASE = '/api';

/**
 * Project detail response (includes items)
 */
interface ProjectDetail extends Project {
  items: ProjectItem[];
}

/**
 * Request body for adding item to project
 */
interface AddProjectItemRequest {
  issueId: number;
  position?: number;
  viewMeta?: {
    status?: string;
  };
}

export class ProjectsService {
  /**
   * List all projects
   * @returns Array of projects
   */
  static async listProjects(): Promise<Project[]> {
    const response = await fetch(`${API_BASE}/projects`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch projects: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Get project details with associated items
   * @param id Project ID
   * @returns Project with items
   */
  static async getProject(id: string): Promise<ProjectDetail> {
    const response = await fetch(`${API_BASE}/projects/${id}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch project ${id}: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Add item to project
   * @param projectId Project ID
   * @param data Request body with issueId, position, viewMeta
   * @returns Created project item
   */
  static async addProjectItem(
    projectId: string | number,
    data: AddProjectItemRequest
  ): Promise<ProjectItem> {
    const response = await fetch(`${API_BASE}/projects/${projectId}/items`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      throw new Error(`Failed to add item to project ${projectId}: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Remove item from project
   * @param projectId Project ID
   * @param issueId Issue ID (task or memo)
   */
  static async removeProjectItem(
    projectId: string | number,
    issueId: string | number
  ): Promise<void> {
    const response = await fetch(`${API_BASE}/projects/${projectId}/items/${issueId}`, {
      method: 'DELETE',
    });

    if (!response.ok) {
      throw new Error(`Failed to remove item ${issueId} from project ${projectId}: ${response.statusText}`);
    }
  }

  /**
   * Get all projects associated with a specific issue (task or memo)
   *
   * Implementation: Fetches all projects, then fetches details for each
   * to extract items matching the given issueId. This is a temporary
   * workaround until backend adds GET /api/issues/:id/projects endpoint.
   *
   * @param issueId Task or memo ID
   * @returns Array of projects with view metadata
   */
  static async getProjectsForIssue(issueId: number): Promise<ProjectWithMeta[]> {
    // Fetch all projects
    const allProjects = await this.listProjects();
    const associatedProjects: ProjectWithMeta[] = [];

    // For each project, fetch details to find items matching this issue
    for (const project of allProjects) {
      try {
        const details = await this.getProject(String(project.id));
        const item = details.items.find((i) => i.issueId === issueId);

        if (item) {
          associatedProjects.push({
            ...project,
            status: item.viewMeta?.status || 'No status',
            itemId: item.id,
          });
        }
      } catch (error) {
        // If project detail fetch fails, skip this project
        console.error(`Failed to fetch project ${project.id}:`, error);
      }
    }

    return associatedProjects;
  }
}

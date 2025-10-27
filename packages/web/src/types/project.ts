/**
 * TypeScript type definitions for Projects Sidebar feature
 * Feature: 017-https-github-com
 */

/**
 * Project entity (matches backend Project schema)
 */
export interface Project {
  id: number;
  name: string;
  description: string;
  createdAt: string; // ISO 8601 timestamp
}

/**
 * Project item association (matches backend ProjectItem schema)
 */
export interface ProjectItem {
  id: number;
  projectId: number;
  issueId: number;
  position: number;
  viewMeta?: ProjectViewMeta; // Parsed from JSON string
  createdAt: string;
  updatedAt: string;
}

/**
 * View metadata stored in project_items.view_meta
 * Defines how an item appears within a specific project
 */
export interface ProjectViewMeta {
  status?: ProjectStatus;
  // Future: column, customFields, etc.
}

/**
 * Project status values
 */
export type ProjectStatus =
  | 'No status'
  | 'In Progress'
  | 'Done'
  | 'Backlog'
  | 'Blocked';

/**
 * Enriched project with association metadata
 * Used in sidebar display
 */
export interface ProjectWithMeta extends Omit<Project, 'status'> {
  status: ProjectStatus;      // From view_meta (different from Project.status which is 'open'|'closed')
  itemId?: number;            // project_items.id (for update/delete operations)
}

/**
 * Recent projects tracking (stored in localStorage)
 */
export interface RecentProjectsStorage {
  projectIds: number[];        // Last 5 project IDs (ordered by recency)
  lastUsedAt: Record<number, string>; // projectId -> ISO timestamp
}

/**
 * Project list item (for modal display)
 */
export interface ProjectListItem {
  project: Project;
  isAssociated: boolean;       // Checkbox checked state
  isRecent: boolean;           // Show in Recent section
}

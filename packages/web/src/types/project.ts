/**
 * TypeScript type definitions for Projects
 *
 * Core project types are re-exported from shared package.
 * Feature 017 sidebar-specific types are defined here.
 */

// Core project types from shared package (Feature 019)
export type {
  Project,
  ProjectItem,
  ProjectItemWithIssue,
  ProjectDetail,
  ViewMeta,
  ViewType
} from 'meme-gtd-shared';

/**
 * View metadata stored in project_items.view_meta (Feature 017)
 * Defines how an item appears within a specific project in sidebar
 */
export interface ProjectViewMeta {
  status?: ProjectStatus;
  // Future: column, customFields, etc.
}

/**
 * Project status values (Feature 017)
 */
export type ProjectStatus =
  | 'No status'
  | 'In Progress'
  | 'Done'
  | 'Backlog'
  | 'Blocked';

/**
 * Enriched project with association metadata (Feature 017)
 * Used in sidebar display
 */
export interface ProjectWithMeta {
  id: number;
  name: string;
  description: string;
  createdAt: string;
  status: ProjectStatus;      // From view_meta (different from Project.status which is 'open'|'closed')
  itemId?: number;            // project_items.id (for update/delete operations)
}

/**
 * Recent projects tracking (stored in localStorage) (Feature 017)
 */
export interface RecentProjectsStorage {
  projectIds: number[];        // Last 5 project IDs (ordered by recency)
  lastUsedAt: Record<number, string>; // projectId -> ISO timestamp
}

/**
 * Project list item (for modal display) (Feature 017)
 */
export interface ProjectListItem {
  project: {
    id: number;
    name: string;
    description: string;
    createdAt: string;
  };
  isAssociated: boolean;       // Checkbox checked state
  isRecent: boolean;           // Show in Recent section
}

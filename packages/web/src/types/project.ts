/**
 * TypeScript type definitions for Projects
 *
 * Core project types are re-exported from shared package.
 * Feature 017 sidebar-specific types are defined here.
 */

// Core project types from shared package (Feature 019)
export type {
  Project,
  ProjectItemWithIssue,
  ProjectDetail
} from 'meme-gtd-shared';

/**
 * Project status values (Feature 017)
 */
type ProjectStatus =
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

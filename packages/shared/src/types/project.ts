/**
 * Project management types
 * Feature: Issue #19 - Project Management CLI Commands and API
 */

/**
 * Project view type
 */
export type ViewType = 'board' | 'table';

/**
 * Project view metadata
 * Board view includes columns, table view does not
 */
export interface ViewMeta {
  viewType: ViewType;
  columns?: string[]; // Only for board view
}

/**
 * Project entity
 */
export interface Project {
  id: number;
  name: string;
  description: string | null;
  viewMeta: ViewMeta;
  createdAt: string; // ISO 8601
}

/**
 * Project item entity (association between project and issue)
 */
export interface ProjectItem {
  id: number;
  projectId: number;
  issueId: number;
  position: number; // REAL type for fractional positioning
  viewMeta: {
    column?: string;
  } | null;
  createdAt: string; // ISO 8601
  updatedAt: string; // ISO 8601
}

/**
 * Project with associated items (used for detail view)
 */
export interface ProjectDetail extends Project {
  items: ProjectItemWithIssue[];
}

/**
 * Project item with issue information
 */
export interface ProjectItemWithIssue extends ProjectItem {
  issue: {
    id: number;
    type: 'task' | 'memo';
    title: string;
    bodyMd: string;
    status: 'inbox' | 'open' | 'next' | 'waiting' | 'scheduled' | 'someday' | 'done' | 'canceled' | null;
  };
}

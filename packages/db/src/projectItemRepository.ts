/**
 * Project item repository
 * Feature: Issue #19 - Project Management CLI Commands and API
 */

import type Database from 'better-sqlite3';
import type { ProjectItem, ProjectItemWithIssue } from 'meme-gtd-shared';
import type { SqliteRow } from './index.js';

/**
 * Input for creating a new project item
 */
export interface CreateProjectItemInput {
  projectId: number;
  issueId: number;
  position?: number; // If not provided, will be calculated
  column?: string | null; // Board column name
}

/**
 * Input for updating a project item
 */
export interface UpdateProjectItemInput {
  position?: number;
  column?: string | null;
}

/**
 * Map database row to ProjectItem entity
 */
export const projectItemRowToProjectItem = (row: SqliteRow): ProjectItem => {
  const viewMeta = row.view_meta
    ? JSON.parse(row.view_meta as string)
    : null;

  return {
    id: row.id as number,
    projectId: row.project_id as number,
    issueId: row.issue_id as number,
    position: row.position as number,
    viewMeta,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string
  };
};

/**
 * Calculate next position for a new item in a project
 * @param db Database instance
 * @param projectId Project ID
 * @returns Next position (max + 1.0)
 */
export const calculateNextPosition = (db: Database.Database, projectId: number): number => {
  const stmt = db.prepare(`
    SELECT COALESCE(MAX(position), 0) + 1.0 AS next_position
    FROM project_items
    WHERE project_id = ?
  `);
  const row = stmt.get(projectId) as SqliteRow;
  return row.next_position as number;
};

/**
 * Create a new project item
 * @param db Database instance
 * @param input Project item creation input
 * @returns Created project item
 * @throws Error if project or issue not found, or duplicate item
 */
export const createProjectItem = (
  db: Database.Database,
  input: CreateProjectItemInput
): ProjectItem => {
  // Calculate position if not provided
  const position = input.position ?? calculateNextPosition(db, input.projectId);

  // Build view_meta JSON
  const viewMeta = input.column ? { column: input.column } : null;
  const viewMetaJson = viewMeta ? JSON.stringify(viewMeta) : null;

  const stmt = db.prepare(`
    INSERT INTO project_items (project_id, issue_id, position, view_meta)
    VALUES (?, ?, ?, ?)
  `);

  try {
    const result = stmt.run(input.projectId, input.issueId, position, viewMetaJson);
    const itemId = result.lastInsertRowid as number;

    const selectStmt = db.prepare('SELECT * FROM project_items WHERE id = ?');
    const row = selectStmt.get(itemId) as SqliteRow;

    return projectItemRowToProjectItem(row);
  } catch (error) {
    if (error instanceof Error) {
      // Handle UNIQUE constraint violation
      if (error.message.includes('UNIQUE constraint failed')) {
        throw new Error(
          `Issue #${input.issueId} is already in project #${input.projectId}`
        );
      }
      // Handle FOREIGN KEY constraint violation
      if (error.message.includes('FOREIGN KEY constraint failed')) {
        throw new Error(`Project #${input.projectId} or Issue #${input.issueId} not found`);
      }
    }
    throw error;
  }
};

/**
 * List all project items for a project with issue information
 * Ordered by position (ascending)
 * @param db Database instance
 * @param projectId Project ID
 * @returns Array of project items with issue details
 */
export const listProjectItems = (
  db: Database.Database,
  projectId: number
): ProjectItemWithIssue[] => {
  const stmt = db.prepare(`
    SELECT
      pi.*,
      i.id as issue_id,
      i.type as issue_type,
      COALESCE(i.title, SUBSTR(i.body_md, 1, 100)) as issue_title
    FROM project_items pi
    JOIN issues i ON pi.issue_id = i.id
    WHERE pi.project_id = ? AND i.is_deleted = 0
    ORDER BY pi.position ASC
  `);

  const rows = stmt.all(projectId) as SqliteRow[];

  return rows.map((row) => {
    const projectItem = projectItemRowToProjectItem(row);
    return {
      ...projectItem,
      issue: {
        id: row.issue_id as number,
        type: row.issue_type as 'task' | 'memo',
        title: row.issue_title as string
      }
    };
  });
};

/**
 * Get a specific project item by project ID and issue ID
 * @param db Database instance
 * @param projectId Project ID
 * @param issueId Issue ID
 * @returns Project item or undefined if not found
 */
export const getProjectItem = (
  db: Database.Database,
  projectId: number,
  issueId: number
): ProjectItem | undefined => {
  const stmt = db.prepare(`
    SELECT * FROM project_items
    WHERE project_id = ? AND issue_id = ?
  `);
  const row = stmt.get(projectId, issueId) as SqliteRow | undefined;
  return row ? projectItemRowToProjectItem(row) : undefined;
};

/**
 * Update a project item (position and/or column)
 * @param db Database instance
 * @param id Project item ID
 * @param updates Update input
 * @returns Updated project item
 * @throws Error if project item not found
 */
export const updateProjectItem = (
  db: Database.Database,
  id: number,
  updates: UpdateProjectItemInput
): ProjectItem => {
  // Get current item
  const current = db.prepare('SELECT * FROM project_items WHERE id = ?').get(id) as SqliteRow | undefined;
  if (!current) {
    throw new Error(`Project item #${id} not found`);
  }

  const currentViewMeta = current.view_meta ? JSON.parse(current.view_meta as string) : {};
  const newPosition = updates.position ?? (current.position as number);

  // Update view_meta
  let newViewMeta = currentViewMeta;
  if ('column' in updates) {
    if (updates.column === null) {
      delete newViewMeta.column;
    } else {
      newViewMeta = { ...currentViewMeta, column: updates.column };
    }
  }

  const viewMetaJson = Object.keys(newViewMeta).length > 0 ? JSON.stringify(newViewMeta) : null;

  const stmt = db.prepare(`
    UPDATE project_items
    SET position = ?, view_meta = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now')
    WHERE id = ?
  `);

  stmt.run(newPosition, viewMetaJson, id);

  const selectStmt = db.prepare('SELECT * FROM project_items WHERE id = ?');
  const row = selectStmt.get(id) as SqliteRow;

  return projectItemRowToProjectItem(row);
};

/**
 * Delete a project item
 * @param db Database instance
 * @param projectId Project ID
 * @param issueId Issue ID
 * @returns Number of deleted rows (0 or 1)
 */
export const deleteProjectItem = (
  db: Database.Database,
  projectId: number,
  issueId: number
): number => {
  const stmt = db.prepare(`
    DELETE FROM project_items
    WHERE project_id = ? AND issue_id = ?
  `);
  const result = stmt.run(projectId, issueId);
  return result.changes;
};

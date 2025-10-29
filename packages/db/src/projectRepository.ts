/**
 * Project repository
 * Feature: Issue #19 - Project Management CLI Commands and API
 */

import type Database from 'better-sqlite3';
import type { Project, ViewMeta } from 'meme-gtd-shared';
import type { SqliteRow } from './index.js';

/**
 * Input for creating a new project
 */
export interface CreateProjectInput {
  name: string;
  description?: string | null;
  viewMeta: ViewMeta;
}

/**
 * Map database row to Project entity
 */
export const projectRowToProject = (row: SqliteRow): Project => {
  return {
    id: row.id as number,
    name: row.name as string,
    description: (row.description as string | null) ?? null,
    viewMeta: row.view_meta ? JSON.parse(row.view_meta as string) : { viewType: 'board', columns: ['To Do', 'In Progress', 'Done'] },
    createdAt: row.created_at as string
  };
};

/**
 * Create a new project
 * @param db Database instance
 * @param input Project creation input
 * @returns Created project
 * @throws Error if project name already exists
 */
export const createProject = (db: Database.Database, input: CreateProjectInput): Project => {
  const stmt = db.prepare(`
    INSERT INTO projects (name, description, view_meta)
    VALUES (?, ?, ?)
  `);

  const viewMetaJson = JSON.stringify(input.viewMeta);

  try {
    const result = stmt.run(input.name, input.description ?? null, viewMetaJson);
    const projectId = result.lastInsertRowid as number;

    const selectStmt = db.prepare('SELECT * FROM projects WHERE id = ?');
    const row = selectStmt.get(projectId) as SqliteRow;

    return projectRowToProject(row);
  } catch (error) {
    // Handle UNIQUE constraint violation
    if (error instanceof Error && error.message.includes('UNIQUE constraint failed')) {
      throw new Error(`Project with name "${input.name}" already exists`);
    }
    throw error;
  }
};

/**
 * List all projects ordered by creation date (newest first)
 * @param db Database instance
 * @returns Array of projects
 */
export const listProjects = (db: Database.Database): Project[] => {
  const stmt = db.prepare(`
    SELECT * FROM projects ORDER BY created_at DESC
  `);
  const rows = stmt.all() as SqliteRow[];
  return rows.map(projectRowToProject);
};

/**
 * Get project by ID
 * @param db Database instance
 * @param id Project ID
 * @returns Project or undefined if not found
 */
export const getProjectById = (db: Database.Database, id: number): Project | undefined => {
  const stmt = db.prepare('SELECT * FROM projects WHERE id = ?');
  const row = stmt.get(id) as SqliteRow | undefined;
  return row ? projectRowToProject(row) : undefined;
};

/**
 * Get projects associated with an issue
 * @param db Database instance
 * @param issueId Issue ID (memo or task)
 * @returns Array of projects containing the issue
 */
export const getProjectsForIssue = (db: Database.Database, issueId: number): Project[] => {
  const stmt = db.prepare(`
    SELECT p.* FROM projects p
    INNER JOIN project_items pi ON p.id = pi.project_id
    WHERE pi.issue_id = ?
    ORDER BY p.created_at DESC
  `);
  const rows = stmt.all(issueId) as SqliteRow[];
  return rows.map(projectRowToProject);
};

/**
 * Delete a project by ID
 * Cascades to project_items (defined in schema)
 * @param db Database instance
 * @param id Project ID
 * @returns Number of deleted rows (0 or 1)
 */
export const deleteProject = (db: Database.Database, id: number): number => {
  const stmt = db.prepare('DELETE FROM projects WHERE id = ?');
  const result = stmt.run(id);
  return result.changes;
};

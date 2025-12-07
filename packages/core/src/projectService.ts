/**
 * Project service
 * Feature: Issue #19 - Project Management CLI Commands and API
 */

import type { MgtdConfig } from 'meme-gtd-config';
import type {
  Project,
  ProjectDetail,
  ProjectItem,
  ViewType,
  ViewMeta
} from 'meme-gtd-shared';
import type Database from 'better-sqlite3';
import {
  ensureDatabase,
  createProject as dbCreateProject,
  listProjects as dbListProjects,
  getProjectById as dbGetProjectById,
  getProjectsForIssue as dbGetProjectsForIssue,
  deleteProject as dbDeleteProject,
  createProjectItem as dbCreateProjectItem,
  listProjectItems as dbListProjectItems,
  getProjectItem as dbGetProjectItem,
  updateProjectItem as dbUpdateProjectItem,
  deleteProjectItem as dbDeleteProjectItem,
  type CreateProjectInput,
  type CreateProjectItemInput,
  type UpdateProjectItemInput
} from 'meme-gtd-db';

export interface ProjectServiceOptions {
  config?: MgtdConfig;
  db?: Database.Database;
}

interface CreateProjectServiceInput {
  name: string;
  description?: string | null;
  view?: ViewType;
  status?: 'planned' | 'active' | 'paused' | 'done' | 'canceled';
  startDate?: string | null;
  endDate?: string | null;
}

interface AddProjectItemServiceInput {
  issueId: number;
  position?: number;
  column?: string | null;
}

interface UpdateProjectItemServiceInput {
  position?: number;
  column?: string | null;
}

export class ProjectService {
  private readonly db: Database.Database;

  constructor(private readonly options: ProjectServiceOptions) {
    if (options.db) {
      this.db = options.db;
    } else if (options.config) {
      this.db = ensureDatabase(options.config);
    } else {
      throw new Error('ProjectService requires either db or config option');
    }
  }

  /**
   * Build view metadata based on view type
   * @param viewType View type (board or table)
   * @returns ViewMeta object
   */
  private buildViewMeta(viewType: ViewType = 'board'): ViewMeta {
    if (viewType === 'board') {
      return {
        viewType: 'board',
        columns: ['To Do', 'In Progress', 'Done']
      };
    }
    return {
      viewType: 'table'
    };
  }

  /**
   * Create a new project
   * @param input Project creation input
   * @returns Created project
   * @throws Error if project name already exists
   */
  create(input: CreateProjectServiceInput): Project {
    const viewMeta = this.buildViewMeta(input.view);

    const dbInput: CreateProjectInput = {
      name: input.name,
      description: input.description,
      viewMeta,
      status: input.status,
      startDate: input.startDate,
      endDate: input.endDate
    };

    return dbCreateProject(this.db, dbInput);
  }

  /**
   * List all projects
   * @returns Array of projects ordered by creation date (newest first)
   */
  list(): Project[] {
    return dbListProjects(this.db);
  }

  /**
   * Get projects associated with an issue
   * @param issueId Issue ID (memo or task)
   * @returns Array of projects containing the issue
   */
  getProjectsForIssue(issueId: number): Project[] {
    return dbGetProjectsForIssue(this.db, issueId);
  }

  /**
   * Get project by ID with associated items
   * @param id Project ID
   * @returns Project detail with items
   * @throws Error if project not found
   */
  getById(id: number): ProjectDetail {
    const project = dbGetProjectById(this.db, id);
    if (!project) {
      throw new Error(`Project #${id} not found`);
    }

    const items = dbListProjectItems(this.db, id);

    return {
      ...project,
      items
    };
  }

  /**
   * Update a project (name, description, status, dates)
   * @param id Project ID
   * @param updates Update data
   * @returns Updated project
   * @throws Error if project not found
   */
  update(
    id: number,
    updates: {
      name?: string;
      description?: string | null;
      status?: 'planned' | 'active' | 'paused' | 'done' | 'canceled';
      startDate?: string | null;
      endDate?: string | null;
    }
  ): Project {
    // Get current project
    const project = dbGetProjectById(this.db, id);
    if (!project) {
      throw new Error(`Project #${id} not found`);
    }

    // Update project in database
    const stmt = this.db.prepare(`
      UPDATE projects
      SET
        name = COALESCE(?, name),
        description = ?,
        status = COALESCE(?, status),
        start_date = ?,
        end_date = ?
      WHERE id = ?
    `);

    stmt.run(
      updates.name ?? null,
      updates.description !== undefined ? updates.description : project.description,
      updates.status ?? null,
      updates.startDate !== undefined ? updates.startDate : project.startDate,
      updates.endDate !== undefined ? updates.endDate : project.endDate,
      id
    );

    // Return updated project
    const updated = dbGetProjectById(this.db, id);
    if (!updated) {
      throw new Error(`Failed to retrieve updated project #${id}`);
    }

    return updated;
  }

  /**
   * Delete a project
   * Cascades to project_items, issues remain intact
   * @param id Project ID
   * @throws Error if project not found
   */
  delete(id: number): void {
    const deletedCount = dbDeleteProject(this.db, id);
    if (deletedCount === 0) {
      throw new Error(`Project #${id} not found`);
    }
  }

  /**
   * Add an issue to a project
   * @param projectId Project ID
   * @param input Add item input
   * @returns Created project item
   * @throws Error if project not found, issue not found, or duplicate item
   */
  addItem(projectId: number, input: AddProjectItemServiceInput): ProjectItem {
    // Validate project exists
    const project = dbGetProjectById(this.db, projectId);
    if (!project) {
      throw new Error(`Project #${projectId} not found`);
    }

    // Validate issue exists
    const issueStmt = this.db.prepare('SELECT id FROM issues WHERE id = ? AND is_deleted = 0');
    const issueExists = issueStmt.get(input.issueId);
    if (!issueExists) {
      throw new Error(`Issue #${input.issueId} not found`);
    }

    const dbInput: CreateProjectItemInput = {
      projectId,
      issueId: input.issueId,
      position: input.position,
      column: input.column
    };

    return dbCreateProjectItem(this.db, dbInput);
  }

  /**
   * Remove an issue from a project
   * Issue itself remains intact
   * @param projectId Project ID
   * @param issueId Issue ID
   * @throws Error if project item not found
   */
  removeItem(projectId: number, issueId: number): void {
    const deletedCount = dbDeleteProjectItem(this.db, projectId, issueId);
    if (deletedCount === 0) {
      throw new Error(`Issue #${issueId} not found in project #${projectId}`);
    }
  }

  /**
   * Update project item (move to new position and/or column)
   * @param projectId Project ID
   * @param issueId Issue ID
   * @param updates Update input
   * @returns Updated project item
   * @throws Error if project item not found
   */
  updateItem(
    projectId: number,
    issueId: number,
    updates: UpdateProjectItemServiceInput
  ): ProjectItem {
    // Get project item to find its ID
    const projectItem = dbGetProjectItem(this.db, projectId, issueId);
    if (!projectItem) {
      throw new Error(`Issue #${issueId} not found in project #${projectId}`);
    }

    const dbUpdates: UpdateProjectItemInput = {
      position: updates.position,
      column: updates.column
    };

    return dbUpdateProjectItem(this.db, projectItem.id, dbUpdates);
  }
}

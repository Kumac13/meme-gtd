import Database from 'better-sqlite3';
import path from 'node:path';
import type { MgtdConfig } from 'meme-gtd-config';
import { applyMigrations } from './migrate.js';

export { applyMigrations } from './migrate.js';

export interface DatabaseOptions {
  readonly dbPath: string;
  readonly pragma?: Record<string, string | number>;
}

export const openDatabase = (options: DatabaseOptions): Database.Database => {
  const dbPath = path.resolve(options.dbPath);
  const db = new Database(dbPath);
  db.pragma('foreign_keys = ON');
  db.pragma('journal_mode = WAL');
  if (options.pragma) {
    for (const [key, value] of Object.entries(options.pragma)) {
      db.pragma(`${key} = ${value}`);
    }
  }
  return db;
};

export const ensureDatabase = (config: MgtdConfig): Database.Database => {
  applyMigrations(config.dbPath);
  return openDatabase({ dbPath: config.dbPath });
};

export type SqliteRow = Record<string, unknown>;

// Memo repository exports
export {
  createMemo,
  getMemo,
  listMemos,
  updateMemo,
  deleteMemo,
  promoteMemo,
  addComment,
  updateComment,
  deleteComment,
  listComments,
  listMemoLabels,
  setMemoLabels,
  setBookmark,
  type CreateMemoInput,
  type UpdateMemoInput,
  type ListMemoFilters,
  type PromoteMemoInput
} from './memoRepository.js';

// Task repository exports
export {
  createTask,
  getTask,
  listTasks,
  updateTask,
  deleteTask,
  setTaskStatus,
  listTaskLabels,
  setTaskLabels,
  type CreateTaskInput,
  type UpdateTaskInput,
  type ListTaskFilters
} from './taskRepository.js';

// Task-specific aliases for shared functions
export {
  addComment as addTaskComment,
  updateComment as updateTaskComment,
  deleteComment as deleteTaskComment,
  listComments as listTaskComments,
  setBookmark as setTaskBookmark
} from './taskRepository.js';

// Label repository exports
export {
  listAllLabels,
  getLabel,
  getLabelByName,
  createLabel,
  attachLabelToIssue,
  detachLabelFromIssue,
  deleteLabel
} from './labelRepository.js';

// Link repository exports
export {
  createLink,
  getLinkById,
  listLinks,
  deleteLink,
  findLink,
  findInverseParentChildLink,
  hasAncestor,
  type CreateLinkInput,
  type ListLinksFilters
} from './linkRepository.js';

// Project repository exports
export {
  createProject,
  listProjects,
  getProjectById,
  deleteProject,
  projectRowToProject,
  type CreateProjectInput
} from './projectRepository.js';

// Project item repository exports
export {
  createProjectItem,
  listProjectItems,
  getProjectItem,
  updateProjectItem,
  deleteProjectItem,
  calculateNextPosition,
  projectItemRowToProjectItem,
  type CreateProjectItemInput,
  type UpdateProjectItemInput
} from './projectItemRepository.js';

import Database from 'better-sqlite3';
import { ensureDatabase } from 'meme-gtd-db';
import type { MgtdConfig } from 'meme-gtd-config';
import type { TaskStatus } from 'meme-gtd-shared';
import {
  // Memo functions
  addComment,
  createMemo,
  deleteComment,
  deleteMemo,
  getMemo,
  listComments,
  listMemoLabels,
  listMemos,
  promoteMemo,
  setBookmark,
  setMemoLabels,
  updateComment,
  updateMemo,
  // Task functions (already aliased in db/src/index.ts)
  addTaskComment,
  createTask,
  deleteTaskComment,
  deleteTask,
  demoteTask,
  getTask,
  listTaskComments,
  listTaskLabels,
  listTasks,
  setTaskBookmark,
  setTaskLabels,
  setTaskStatus,
  updateTaskComment,
  updateTask,
  // Label functions
  listAllLabels,
  getLabel,
  getLabelByName,
  createLabel,
  attachLabelToIssue,
  detachLabelFromIssue,
  deleteLabel,
  // Project functions
  getProjectsForIssue,
  // Link functions
  listLinks,
  // Types
  type CreateMemoInput,
  type CreateTaskInput,
  type DemoteTaskInput,
  type ListMemoFilters,
  type ListTaskFilters,
  type PromoteMemoInput,
  type UpdateMemoInput,
  type UpdateTaskInput
} from 'meme-gtd-db';

export interface MemoServiceOptions {
  config?: MgtdConfig;
  db?: Database.Database;
}

export class MemoService {
  private readonly db: Database.Database;

  constructor(private readonly options: MemoServiceOptions) {
    if (options.db) {
      this.db = options.db;
    } else if (options.config) {
      this.db = ensureDatabase(options.config);
    } else {
      throw new Error('MemoService requires either db or config option');
    }
  }

  public create(input: CreateMemoInput) {
    return createMemo(this.db, input);
  }

  public list(filters: ListMemoFilters = {}) {
    const memos = listMemos(this.db, filters);
    return memos.map(memo => ({
      ...memo,
      labels: listMemoLabels(this.db, memo.id)
    }));
  }

  public show(id: number) {
    const memo = getMemo(this.db, id);
    return {
      ...memo,
      labels: listMemoLabels(this.db, id)
    };
  }

  public edit(input: UpdateMemoInput) {
    return updateMemo(this.db, input);
  }

  public remove(id: number) {
    return deleteMemo(this.db, id);
  }

  public promote(input: PromoteMemoInput) {
    return promoteMemo(this.db, input);
  }

  public addComment(memoId: number, bodyMd: string) {
    return addComment(this.db, memoId, bodyMd);
  }

  public updateComment(commentId: number, bodyMd: string) {
    return updateComment(this.db, commentId, bodyMd);
  }

  public deleteComment(commentId: number) {
    return deleteComment(this.db, commentId);
  }

  public listComments(memoId: number) {
    return listComments(this.db, memoId);
  }

  public listLabels(memoId: number) {
    return listMemoLabels(this.db, memoId);
  }

  public setLabels(memoId: number, labels: string[]) {
    return setMemoLabels(this.db, memoId, labels);
  }

  public setBookmark(id: number, isBookmarked: boolean) {
    return setBookmark(this.db, id, isBookmarked);
  }
}

export interface TaskServiceOptions {
  config?: MgtdConfig;
  db?: Database.Database;
}

export class TaskService {
  private readonly db: Database.Database;

  constructor(private readonly options: TaskServiceOptions) {
    if (options.db) {
      this.db = options.db;
    } else if (options.config) {
      this.db = ensureDatabase(options.config);
    } else {
      throw new Error('TaskService requires either db or config option');
    }
  }

  public create(input: CreateTaskInput) {
    return createTask(this.db, input);
  }

  public list(filters: ListTaskFilters = {}) {
    const tasks = listTasks(this.db, filters);
    return tasks.map(task => {
      const projects = getProjectsForIssue(this.db, task.id);
      const links = listLinks(this.db, task.id);
      return {
        ...task,
        labels: listTaskLabels(this.db, task.id),
        projectIds: projects.map(p => p.id),
        linkIds: links.map(l => l.id)
      };
    });
  }

  public show(id: number) {
    const task = getTask(this.db, id);
    return {
      ...task,
      labels: listTaskLabels(this.db, id)
    };
  }

  public edit(input: UpdateTaskInput) {
    return updateTask(this.db, input);
  }

  public remove(id: number) {
    return deleteTask(this.db, id);
  }

  public close(id: number, comment?: string) {
    const task = setTaskStatus(this.db, id, 'done');
    if (comment) {
      addTaskComment(this.db, id, comment);
    }
    return task;
  }

  public cancel(id: number, comment?: string) {
    const task = setTaskStatus(this.db, id, 'canceled');
    if (comment) {
      addTaskComment(this.db, id, comment);
    }
    return task;
  }

  public reopen(id: number) {
    return setTaskStatus(this.db, id, 'open');
  }

  public addComment(taskId: number, bodyMd: string) {
    return addTaskComment(this.db, taskId, bodyMd);
  }

  public updateComment(commentId: number, bodyMd: string) {
    return updateTaskComment(this.db, commentId, bodyMd);
  }

  public deleteComment(commentId: number) {
    return deleteTaskComment(this.db, commentId);
  }

  public listComments(taskId: number) {
    return listTaskComments(this.db, taskId);
  }

  public listLabels(taskId: number) {
    return listTaskLabels(this.db, taskId);
  }

  public setLabels(taskId: number, labels: string[]) {
    return setTaskLabels(this.db, taskId, labels);
  }

  public setBookmark(id: number, isBookmarked: boolean) {
    return setTaskBookmark(this.db, id, isBookmarked);
  }

  public demote(input: DemoteTaskInput) {
    return demoteTask(this.db, input);
  }
}

export interface LabelServiceOptions {
  config?: MgtdConfig;
  db?: Database.Database;
}

export class LabelService {
  private readonly db: Database.Database;

  constructor(private readonly options: LabelServiceOptions) {
    if (options.db) {
      this.db = options.db;
    } else if (options.config) {
      this.db = ensureDatabase(options.config);
    } else {
      throw new Error('LabelService requires either db or config option');
    }
  }

  public list() {
    return listAllLabels(this.db);
  }

  public create(name: string, description?: string) {
    return createLabel(this.db, name, description);
  }

  public assignToIssue(issueId: number, labelId: number) {
    return attachLabelToIssue(this.db, issueId, labelId);
  }

  public removeFromIssue(issueId: number, labelId: number) {
    return detachLabelFromIssue(this.db, issueId, labelId);
  }

  public delete(name: string) {
    return deleteLabel(this.db, name);
  }
}

// Link Service
export { LinkService, type LinkServiceOptions } from './linkService.js';

// Project Service
export { ProjectService, type ProjectServiceOptions } from './projectService.js';

// Activity Log
export { ActivityLogger } from './activity-log/activity-logger.js';
export {
  createBodyPreview,
  getProjectSnapshots,
  getLabelSnapshots,
  getIssueTitle,
  getIssueType,
  getProjectName,
  getLabelName,
  buildTaskCreatedPayload,
  buildTaskStatusChangedPayload,
  buildLabelAssignedPayload,
  buildProjectItemAddedPayload,
  buildCommentCreatedPayload,
  buildLinkCreatedPayload,
  buildMemoPromotedPayload,
} from './activity-log/payload-builder.js';

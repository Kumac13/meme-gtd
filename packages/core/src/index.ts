import Database from 'better-sqlite3';
import { ensureDatabase } from 'meme-gtd-db';
import type { MgtdConfig } from 'meme-gtd-config';
import type { TaskStatus, SourceType } from 'meme-gtd-shared';
import { ActivityLogger } from './activity-log/activity-logger.js';
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
  sourceType?: SourceType;
}

export class MemoService {
  private readonly db: Database.Database;
  private readonly logger: ActivityLogger;

  constructor(private readonly options: MemoServiceOptions) {
    if (options.db) {
      this.db = options.db;
    } else if (options.config) {
      this.db = ensureDatabase(options.config);
    } else {
      throw new Error('MemoService requires either db or config option');
    }
    this.logger = new ActivityLogger(this.db, options.sourceType ?? 'api');
  }

  public create(input: CreateMemoInput) {
    const memo = createMemo(this.db, input);
    this.logger.logMemoCreated(memo.id, input.bodyMd ?? '');
    return memo;
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
    const result = updateMemo(this.db, input);
    this.logger.logMemoUpdated(input.id, input.bodyMd ?? '');
    return result;
  }

  public remove(id: number) {
    this.logger.logMemoDeleted(id);
    return deleteMemo(this.db, id);
  }

  public promote(input: PromoteMemoInput) {
    const memo = getMemo(this.db, input.memoId);
    const result = promoteMemo(this.db, input);
    const task = getTask(this.db, result.taskId);
    this.logger.logMemoPromoted(
      input.memoId,
      memo?.bodyMd ?? '',
      result.taskId,
      task?.title ?? input.title,
      task?.status ?? 'open'
    );
    return result;
  }

  public addComment(memoId: number, bodyMd: string) {
    const comment = addComment(this.db, memoId, bodyMd);
    this.logger.logCommentCreated(comment.id, memoId, bodyMd);
    return comment;
  }

  public updateComment(commentId: number, bodyMd: string) {
    // Get issue_id before update
    const row = this.db.prepare('SELECT issue_id FROM comments WHERE id = ?').get(commentId) as { issue_id: number } | undefined;
    const result = updateComment(this.db, commentId, bodyMd);
    if (row) {
      this.logger.logCommentUpdated(commentId, row.issue_id, bodyMd);
    }
    return result;
  }

  public deleteComment(commentId: number) {
    // Get issue_id before delete
    const row = this.db.prepare('SELECT issue_id FROM comments WHERE id = ?').get(commentId) as { issue_id: number } | undefined;
    if (row) {
      this.logger.logCommentDeleted(commentId, row.issue_id);
    }
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
    const result = setBookmark(this.db, id, isBookmarked);
    this.logger.logMemoBookmarked(id, isBookmarked);
    return result;
  }
}

export interface TaskServiceOptions {
  config?: MgtdConfig;
  db?: Database.Database;
  sourceType?: SourceType;
}

export class TaskService {
  private readonly db: Database.Database;
  private readonly logger: ActivityLogger;

  constructor(private readonly options: TaskServiceOptions) {
    if (options.db) {
      this.db = options.db;
    } else if (options.config) {
      this.db = ensureDatabase(options.config);
    } else {
      throw new Error('TaskService requires either db or config option');
    }
    this.logger = new ActivityLogger(this.db, options.sourceType ?? 'api');
  }

  public create(input: CreateTaskInput) {
    const task = createTask(this.db, input);
    this.logger.logTaskCreated(
      task.id,
      input.title,
      task.status,
      input.scheduledStart,
      input.isAllDay
    );
    return task;
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
    const beforeTask = getTask(this.db, input.id);
    const task = updateTask(this.db, input);
    // Log status change if status was updated
    if (input.status && input.status !== beforeTask.status) {
      this.logger.logTaskStatusChanged(input.id, beforeTask.status, input.status);
    } else {
      this.logger.logTaskUpdated(input.id, input.title);
    }
    return task;
  }

  public remove(id: number) {
    this.logger.logTaskDeleted(id);
    return deleteTask(this.db, id);
  }

  public close(id: number, comment?: string) {
    const beforeTask = getTask(this.db, id);
    const task = setTaskStatus(this.db, id, 'done');
    this.logger.logTaskStatusChanged(id, beforeTask.status, 'done');
    if (comment) {
      addTaskComment(this.db, id, comment);
    }
    return task;
  }

  public cancel(id: number, comment?: string) {
    const beforeTask = getTask(this.db, id);
    const task = setTaskStatus(this.db, id, 'canceled');
    this.logger.logTaskStatusChanged(id, beforeTask.status, 'canceled');
    if (comment) {
      addTaskComment(this.db, id, comment);
    }
    return task;
  }

  public reopen(id: number) {
    const beforeTask = getTask(this.db, id);
    const task = setTaskStatus(this.db, id, 'open');
    this.logger.logTaskStatusChanged(id, beforeTask.status, 'open');
    return task;
  }

  public addComment(taskId: number, bodyMd: string) {
    const comment = addTaskComment(this.db, taskId, bodyMd);
    this.logger.logCommentCreated(comment.id, taskId, bodyMd);
    return comment;
  }

  public updateComment(commentId: number, bodyMd: string) {
    // Get issue_id before update
    const row = this.db.prepare('SELECT issue_id FROM comments WHERE id = ?').get(commentId) as { issue_id: number } | undefined;
    const result = updateTaskComment(this.db, commentId, bodyMd);
    if (row) {
      this.logger.logCommentUpdated(commentId, row.issue_id, bodyMd);
    }
    return result;
  }

  public deleteComment(commentId: number) {
    // Get issue_id before delete
    const row = this.db.prepare('SELECT issue_id FROM comments WHERE id = ?').get(commentId) as { issue_id: number } | undefined;
    if (row) {
      this.logger.logCommentDeleted(commentId, row.issue_id);
    }
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
    const result = setTaskBookmark(this.db, id, isBookmarked);
    this.logger.logTaskBookmarked(id, isBookmarked);
    return result;
  }

  public demote(input: DemoteTaskInput) {
    return demoteTask(this.db, input);
  }
}

export interface LabelServiceOptions {
  config?: MgtdConfig;
  db?: Database.Database;
  sourceType?: SourceType;
}

export class LabelService {
  private readonly db: Database.Database;
  private readonly logger: ActivityLogger;

  constructor(private readonly options: LabelServiceOptions) {
    if (options.db) {
      this.db = options.db;
    } else if (options.config) {
      this.db = ensureDatabase(options.config);
    } else {
      throw new Error('LabelService requires either db or config option');
    }
    this.logger = new ActivityLogger(this.db, options.sourceType ?? 'api');
  }

  public list() {
    return listAllLabels(this.db);
  }

  public create(name: string, description?: string) {
    const label = createLabel(this.db, name, description);
    this.logger.logLabelCreated(label.id, name, description);
    return label;
  }

  public assignToIssue(issueId: number, labelId: number) {
    const result = attachLabelToIssue(this.db, issueId, labelId);
    this.logger.logLabelAssigned(issueId, labelId);
    return result;
  }

  public removeFromIssue(issueId: number, labelId: number) {
    this.logger.logLabelRemoved(issueId, labelId);
    return detachLabelFromIssue(this.db, issueId, labelId);
  }

  public delete(name: string) {
    const label = getLabelByName(this.db, name);
    if (label) {
      this.logger.logLabelDeleted(label.id, name);
    }
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

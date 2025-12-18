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
  countMemos,
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
  countTasks,
  setTaskBookmark,
  setTaskLabels,
  setTaskStatus,
  updateTaskComment,
  updateTask,
  // Article functions
  createArticle,
  getArticle,
  listArticles,
  deleteArticle,
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
  type CreateArticleInput,
  type CreateMemoInput,
  type CreateTaskInput,
  type DemoteTaskInput,
  type ListArticleFilters,
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
    return this.db.transaction(() => {
      const memo = createMemo(this.db, input);
      this.logger.logMemoCreated(memo.id, input.bodyMd ?? '');
      return memo;
    })();
  }

  public list(filters: ListMemoFilters = {}) {
    const memos = listMemos(this.db, filters);
    const total = countMemos(this.db, filters);
    const data = memos.map(memo => ({
      ...memo,
      labels: listMemoLabels(this.db, memo.id)
    }));
    return { data, total };
  }

  public show(id: number) {
    const memo = getMemo(this.db, id);
    return {
      ...memo,
      labels: listMemoLabels(this.db, id)
    };
  }

  public edit(input: UpdateMemoInput) {
    return this.db.transaction(() => {
      // Get old value before update
      const oldMemo = getMemo(this.db, input.id);
      const result = updateMemo(this.db, input);
      // Log with diff
      this.logger.logMemoUpdated(input.id, {
        old: oldMemo?.bodyMd ?? null,
        new: input.bodyMd ?? null,
      });
      return result;
    })();
  }

  public remove(id: number) {
    return this.db.transaction(() => {
      this.logger.logMemoDeleted(id);
      return deleteMemo(this.db, id);
    })();
  }

  public promote(input: PromoteMemoInput) {
    return this.db.transaction(() => {
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
    })();
  }

  public addComment(memoId: number, bodyMd: string) {
    return this.db.transaction(() => {
      const comment = addComment(this.db, memoId, bodyMd);
      this.logger.logCommentCreated(comment.id, memoId, bodyMd);
      return comment;
    })();
  }

  public updateComment(commentId: number, bodyMd: string) {
    return this.db.transaction(() => {
      // Get old value before update
      const row = this.db.prepare('SELECT issue_id, body_md FROM comments WHERE id = ?').get(commentId) as { issue_id: number; body_md: string | null } | undefined;
      const result = updateComment(this.db, commentId, bodyMd);
      if (row) {
        this.logger.logCommentUpdated(commentId, row.issue_id, {
          old: row.body_md,
          new: bodyMd,
        });
      }
      return result;
    })();
  }

  public deleteComment(commentId: number) {
    return this.db.transaction(() => {
      const row = this.db.prepare('SELECT issue_id FROM comments WHERE id = ?').get(commentId) as { issue_id: number } | undefined;
      if (row) {
        this.logger.logCommentDeleted(commentId, row.issue_id);
      }
      return deleteComment(this.db, commentId);
    })();
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
    return this.db.transaction(() => {
      const task = createTask(this.db, input);
      this.logger.logTaskCreated(
        task.id,
        input.title,
        task.status,
        input.scheduledStart,
        input.isAllDay
      );
      return task;
    })();
  }

  public list(filters: ListTaskFilters = {}) {
    const tasks = listTasks(this.db, filters);
    const total = countTasks(this.db, filters);
    const data = tasks.map(task => {
      const projects = getProjectsForIssue(this.db, task.id);
      const links = listLinks(this.db, task.id);
      return {
        ...task,
        labels: listTaskLabels(this.db, task.id),
        projectIds: projects.map(p => p.id),
        linkIds: links.map(l => l.id)
      };
    });
    return { data, total };
  }

  public show(id: number) {
    const task = getTask(this.db, id);
    return {
      ...task,
      labels: listTaskLabels(this.db, id)
    };
  }

  public edit(input: UpdateTaskInput) {
    return this.db.transaction(() => {
      const beforeTask = getTask(this.db, input.id);
      const task = updateTask(this.db, input);
      // Log status change if status was updated
      if (input.status && input.status !== beforeTask.status) {
        this.logger.logTaskStatusChanged(input.id, beforeTask.status, input.status);
      } else {
        // Log with diff for title and/or body changes
        const diff: {
          title?: { old: string | null; new: string | null };
          body?: { old: string | null; new: string | null };
        } = {};
        if (input.title !== undefined) {
          diff.title = { old: beforeTask.title, new: input.title };
        }
        if (input.bodyMd !== undefined) {
          diff.body = { old: beforeTask.bodyMd, new: input.bodyMd };
        }
        this.logger.logTaskUpdated(input.id, diff);
      }
      return task;
    })();
  }

  public remove(id: number) {
    return this.db.transaction(() => {
      this.logger.logTaskDeleted(id);
      return deleteTask(this.db, id);
    })();
  }

  public close(id: number, comment?: string) {
    return this.db.transaction(() => {
      const beforeTask = getTask(this.db, id);
      const task = setTaskStatus(this.db, id, 'done');
      this.logger.logTaskStatusChanged(id, beforeTask.status, 'done');
      if (comment) {
        addTaskComment(this.db, id, comment);
      }
      return task;
    })();
  }

  public cancel(id: number, comment?: string) {
    return this.db.transaction(() => {
      const beforeTask = getTask(this.db, id);
      const task = setTaskStatus(this.db, id, 'canceled');
      this.logger.logTaskStatusChanged(id, beforeTask.status, 'canceled');
      if (comment) {
        addTaskComment(this.db, id, comment);
      }
      return task;
    })();
  }

  public reopen(id: number) {
    return this.db.transaction(() => {
      const beforeTask = getTask(this.db, id);
      const task = setTaskStatus(this.db, id, 'open');
      this.logger.logTaskStatusChanged(id, beforeTask.status, 'open');
      return task;
    })();
  }

  public addComment(taskId: number, bodyMd: string) {
    return this.db.transaction(() => {
      const comment = addTaskComment(this.db, taskId, bodyMd);
      this.logger.logCommentCreated(comment.id, taskId, bodyMd);
      return comment;
    })();
  }

  public updateComment(commentId: number, bodyMd: string) {
    return this.db.transaction(() => {
      // Get old value before update
      const row = this.db.prepare('SELECT issue_id, body_md FROM comments WHERE id = ?').get(commentId) as { issue_id: number; body_md: string | null } | undefined;
      const result = updateTaskComment(this.db, commentId, bodyMd);
      if (row) {
        this.logger.logCommentUpdated(commentId, row.issue_id, {
          old: row.body_md,
          new: bodyMd,
        });
      }
      return result;
    })();
  }

  public deleteComment(commentId: number) {
    return this.db.transaction(() => {
      // Get issue_id before delete
      const row = this.db.prepare('SELECT issue_id FROM comments WHERE id = ?').get(commentId) as { issue_id: number } | undefined;
      if (row) {
        this.logger.logCommentDeleted(commentId, row.issue_id);
      }
      return deleteTaskComment(this.db, commentId);
    })();
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
    return this.db.transaction(() => {
      const result = setTaskBookmark(this.db, id, isBookmarked);
      this.logger.logTaskBookmarked(id, isBookmarked);
      return result;
    })();
  }

  public demote(input: DemoteTaskInput) {
    return this.db.transaction(() => {
      return demoteTask(this.db, input);
    })();
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
    return this.db.transaction(() => {
      const label = createLabel(this.db, name, description);
      this.logger.logLabelCreated(label.id, name, description);
      return label;
    })();
  }

  public assignToIssue(issueId: number, labelId: number) {
    return this.db.transaction(() => {
      const result = attachLabelToIssue(this.db, issueId, labelId);
      this.logger.logLabelAssigned(issueId, labelId);
      return result;
    })();
  }

  public removeFromIssue(issueId: number, labelId: number) {
    return this.db.transaction(() => {
      this.logger.logLabelRemoved(issueId, labelId);
      return detachLabelFromIssue(this.db, issueId, labelId);
    })();
  }

  public delete(name: string) {
    return this.db.transaction(() => {
      const label = getLabelByName(this.db, name);
      if (label) {
        this.logger.logLabelDeleted(label.id, name);
      }
      return deleteLabel(this.db, name);
    })();
  }
}

export interface ArticleServiceOptions {
  config?: MgtdConfig;
  db?: Database.Database;
  sourceType?: SourceType;
}

export class ArticleService {
  private readonly db: Database.Database;
  private readonly logger: ActivityLogger;

  constructor(private readonly options: ArticleServiceOptions) {
    if (options.db) {
      this.db = options.db;
    } else if (options.config) {
      this.db = ensureDatabase(options.config);
    } else {
      throw new Error('ArticleService requires either db or config option');
    }
    this.logger = new ActivityLogger(this.db, options.sourceType ?? 'api');
  }

  public create(input: CreateArticleInput) {
    return this.db.transaction(() => {
      const article = createArticle(this.db, input);
      this.logger.logArticleCreated(
        article.id,
        input.title,
        input.bodyMd,
        input.originalUrl
      );
      return article;
    })();
  }

  public get(id: number) {
    return getArticle(this.db, id);
  }

  public list(filters: ListArticleFilters = {}) {
    return listArticles(this.db, filters);
  }

  public remove(id: number) {
    return this.db.transaction(() => {
      this.logger.logArticleDeleted(id);
      return deleteArticle(this.db, id);
    })();
  }
}

// Link Service
export { LinkService, type LinkServiceOptions } from './linkService.js';

// URL Link Service
export { UrlLinkService, type UrlLinkServiceOptions } from './urlLinkService.js';

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
  buildArticleCreatedPayload,
} from './activity-log/payload-builder.js';

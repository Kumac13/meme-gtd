import Database from 'better-sqlite3';
import { ensureDatabase } from 'meme-gtd-db';
import type { MgtdConfig } from 'meme-gtd-config';
import type { TaskStatus, TaskKind, SourceType } from 'meme-gtd-shared';
import { ActivityLogger } from './activity-log/activity-logger.js';
import { LinkService } from './linkService.js';
import { rewriteIssueMentions } from './issueMentions.js';
import { isInteractiveTodoChange } from './checkboxDiff.js';
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
  getPromotePreview,
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
  countArticles,
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
  type PromotePreview,
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
  private readonly linkService: LinkService;

  constructor(private readonly options: MemoServiceOptions) {
    if (options.db) {
      this.db = options.db;
    } else if (options.config) {
      this.db = ensureDatabase(options.config);
    } else {
      throw new Error('MemoService requires either db or config option');
    }
    this.logger = new ActivityLogger(this.db, options.sourceType ?? 'api');
    this.linkService = new LinkService({ db: this.db, sourceType: options.sourceType });
  }

  public create(input: CreateMemoInput) {
    return this.db.transaction(() => {
      const { rewritten, mentionedIssueIds } = rewriteIssueMentions(this.db, input.bodyMd);
      const memo = createMemo(this.db, { ...input, bodyMd: rewritten });
      this.logger.logMemoCreated(memo.id, rewritten);
      for (const targetId of mentionedIssueIds) {
        if (targetId === memo.id) continue;
        this.linkService.createOrIgnore(memo.id, targetId, 'relates');
      }
      return memo;
    })();
  }

  /**
   * Sync apply path (POST /api/sync/push): create a memo with a client-minted
   * uuid and preserved offline authoring time. Same domain semantics as
   * create() — mention rewriting, links, and activity log all apply.
   */
  public createFromSync(input: {
    uuid: string;
    bodyMd: string;
    createdAt?: string;
    isBookmarked?: boolean;
  }) {
    return this.db.transaction(() => {
      const { rewritten, mentionedIssueIds } = rewriteIssueMentions(this.db, input.bodyMd);
      const memo = createMemo(this.db, {
        bodyMd: rewritten,
        uuid: input.uuid,
        createdAt: input.createdAt
      });
      this.logger.logMemoCreated(memo.id, rewritten);
      for (const targetId of mentionedIssueIds) {
        if (targetId === memo.id) continue;
        this.linkService.createOrIgnore(memo.id, targetId, 'relates');
      }
      if (input.isBookmarked) {
        setBookmark(this.db, memo.id, true);
        this.logger.logMemoBookmarked(memo.id, true);
      }
      return getMemo(this.db, memo.id);
    })();
  }

  /**
   * Sync apply path: add a comment with a client-minted uuid and preserved
   * offline authoring time.
   */
  public addCommentFromSync(
    issueId: number,
    bodyMd: string,
    options: { uuid: string; createdAt?: string }
  ) {
    return this.db.transaction(() => {
      const { rewritten, mentionedIssueIds } = rewriteIssueMentions(this.db, bodyMd, issueId);
      const comment = addComment(this.db, issueId, rewritten, options);
      this.logger.logCommentCreated(comment.id, issueId, rewritten);
      for (const targetId of mentionedIssueIds) {
        if (targetId === issueId) continue;
        this.linkService.createOrIgnore(issueId, targetId, 'relates');
      }
      return comment;
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
      let finalInput = input;
      let mentionedIssueIds: number[] = [];
      if (input.bodyMd !== undefined) {
        const result = rewriteIssueMentions(this.db, input.bodyMd, input.id);
        finalInput = { ...input, bodyMd: result.rewritten };
        mentionedIssueIds = result.mentionedIssueIds;
      }
      const result = updateMemo(this.db, finalInput);
      const oldBody = oldMemo?.bodyMd ?? null;
      const newBody = finalInput.bodyMd ?? null;
      // Suppress activity log when the only change is a checkbox toggle
      if (!isInteractiveTodoChange(oldBody, newBody)) {
        this.logger.logMemoUpdated(input.id, { old: oldBody, new: newBody });
      }
      for (const targetId of mentionedIssueIds) {
        if (targetId === input.id) continue;
        this.linkService.createOrIgnore(input.id, targetId, 'relates');
      }
      return result;
    })();
  }

  public remove(id: number) {
    return this.db.transaction(() => {
      this.logger.logMemoDeleted(id);
      return deleteMemo(this.db, id);
    })();
  }

  public promotePreview(memoId: number): PromotePreview {
    return getPromotePreview(this.db, memoId);
  }

  public addComment(memoId: number, bodyMd: string) {
    return this.db.transaction(() => {
      const { rewritten, mentionedIssueIds } = rewriteIssueMentions(this.db, bodyMd, memoId);
      const comment = addComment(this.db, memoId, rewritten);
      this.logger.logCommentCreated(comment.id, memoId, rewritten);
      for (const targetId of mentionedIssueIds) {
        if (targetId === memoId) continue;
        this.linkService.createOrIgnore(memoId, targetId, 'relates');
      }
      return comment;
    })();
  }

  public updateComment(commentId: number, bodyMd: string) {
    return this.db.transaction(() => {
      // Get old value before update
      const row = this.db.prepare('SELECT issue_id, body_md FROM comments WHERE id = ?').get(commentId) as { issue_id: number; body_md: string | null } | undefined;
      const parentIssueId = row?.issue_id;
      const { rewritten, mentionedIssueIds } = rewriteIssueMentions(this.db, bodyMd, parentIssueId);
      const result = updateComment(this.db, commentId, rewritten);
      if (row) {
        if (!isInteractiveTodoChange(row.body_md, rewritten)) {
          this.logger.logCommentUpdated(commentId, row.issue_id, {
            old: row.body_md,
            new: rewritten,
          });
        }
        for (const targetId of mentionedIssueIds) {
          if (targetId === row.issue_id) continue;
          this.linkService.createOrIgnore(row.issue_id, targetId, 'relates');
        }
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
  private readonly linkService: LinkService;

  constructor(private readonly options: TaskServiceOptions) {
    if (options.db) {
      this.db = options.db;
    } else if (options.config) {
      this.db = ensureDatabase(options.config);
    } else {
      throw new Error('TaskService requires either db or config option');
    }
    this.logger = new ActivityLogger(this.db, options.sourceType ?? 'api');
    this.linkService = new LinkService({ db: this.db, sourceType: options.sourceType });
  }

  public create(input: CreateTaskInput) {
    return this.db.transaction(() => {
      const { rewritten, mentionedIssueIds } = rewriteIssueMentions(this.db, input.bodyMd);
      const task = createTask(this.db, { ...input, bodyMd: rewritten });
      this.logger.logTaskCreated(
        task.id,
        input.title,
        task.status,
        input.scheduledStart,
        input.isAllDay
      );
      for (const targetId of mentionedIssueIds) {
        if (targetId === task.id) continue;
        this.linkService.createOrIgnore(task.id, targetId, 'relates');
      }
      return task;
    })();
  }

  /**
   * Sync apply path (POST /api/sync/push): create a task with a client-minted
   * uuid and preserved offline timestamps / execution stamps. Same domain
   * semantics as create() — mention rewriting, links, and activity log all
   * apply.
   */
  public createFromSync(input: {
    uuid: string;
    title: string;
    bodyMd?: string;
    status?: TaskStatus;
    taskKind?: TaskKind;
    scheduledStart?: string;
    scheduledEnd?: string;
    isAllDay?: boolean;
    scheduledOn?: string;
    actualStart?: string;
    actualEnd?: string;
    createdAt?: string;
    updatedAt?: string;
  }) {
    return this.db.transaction(() => {
      const { rewritten, mentionedIssueIds } = rewriteIssueMentions(this.db, input.bodyMd ?? '');
      const task = createTask(this.db, { ...input, bodyMd: rewritten });
      this.logger.logTaskCreated(
        task.id,
        input.title,
        task.status,
        input.scheduledStart,
        input.isAllDay
      );
      for (const targetId of mentionedIssueIds) {
        if (targetId === task.id) continue;
        this.linkService.createOrIgnore(task.id, targetId, 'relates');
      }
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
      let finalInput = input;
      let mentionedIssueIds: number[] = [];
      if (input.bodyMd !== undefined) {
        const result = rewriteIssueMentions(this.db, input.bodyMd, input.id);
        finalInput = { ...input, bodyMd: result.rewritten };
        mentionedIssueIds = result.mentionedIssueIds;
      }
      const task = updateTask(this.db, finalInput);
      // Log status change if status was updated
      if (input.status && input.status !== beforeTask.status) {
        this.logger.logTaskStatusChanged(input.id, beforeTask.status, input.status);
      } else {
        // Log with diff for title and/or body changes — but only if the field
        // actually changed. The Web client sends the current title alongside
        // every checkbox toggle, so without the equality check every toggle
        // would still create a task.updated entry.
        const diff: {
          title?: { old: string | null; new: string | null };
          body?: { old: string | null; new: string | null };
        } = {};
        if (input.title !== undefined && input.title !== beforeTask.title) {
          diff.title = { old: beforeTask.title, new: input.title };
        }
        if (
          finalInput.bodyMd !== undefined &&
          finalInput.bodyMd !== beforeTask.bodyMd &&
          !isInteractiveTodoChange(beforeTask.bodyMd, finalInput.bodyMd)
        ) {
          diff.body = { old: beforeTask.bodyMd, new: finalInput.bodyMd };
        }
        // Only log if at least one tracked field actually changed
        if (diff.title || diff.body) {
          this.logger.logTaskUpdated(input.id, diff);
        }
      }
      for (const targetId of mentionedIssueIds) {
        if (targetId === input.id) continue;
        this.linkService.createOrIgnore(input.id, targetId, 'relates');
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
      const { rewritten, mentionedIssueIds } = rewriteIssueMentions(this.db, bodyMd, taskId);
      const comment = addTaskComment(this.db, taskId, rewritten);
      this.logger.logCommentCreated(comment.id, taskId, rewritten);
      for (const targetId of mentionedIssueIds) {
        if (targetId === taskId) continue;
        this.linkService.createOrIgnore(taskId, targetId, 'relates');
      }
      return comment;
    })();
  }

  public updateComment(commentId: number, bodyMd: string) {
    return this.db.transaction(() => {
      // Get old value before update
      const row = this.db.prepare('SELECT issue_id, body_md FROM comments WHERE id = ?').get(commentId) as { issue_id: number; body_md: string | null } | undefined;
      const parentIssueId = row?.issue_id;
      const { rewritten, mentionedIssueIds } = rewriteIssueMentions(this.db, bodyMd, parentIssueId);
      const result = updateTaskComment(this.db, commentId, rewritten);
      if (row) {
        if (!isInteractiveTodoChange(row.body_md, rewritten)) {
          this.logger.logCommentUpdated(commentId, row.issue_id, {
            old: row.body_md,
            new: rewritten,
          });
        }
        for (const targetId of mentionedIssueIds) {
          if (targetId === row.issue_id) continue;
          this.linkService.createOrIgnore(row.issue_id, targetId, 'relates');
        }
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

  /**
   * Sync apply path (POST /api/sync/push): create a label with a preserved
   * offline authoring time. Activity log applies as in create().
   */
  public createFromSync(input: { name: string; description?: string; createdAt?: string }) {
    return this.db.transaction(() => {
      const label = createLabel(this.db, input.name, input.description, {
        createdAt: input.createdAt
      });
      this.logger.logLabelCreated(label.id, input.name, input.description);
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
  private readonly linkService: LinkService;

  constructor(private readonly options: ArticleServiceOptions) {
    if (options.db) {
      this.db = options.db;
    } else if (options.config) {
      this.db = ensureDatabase(options.config);
    } else {
      throw new Error('ArticleService requires either db or config option');
    }
    this.logger = new ActivityLogger(this.db, options.sourceType ?? 'api');
    this.linkService = new LinkService({ db: this.db, sourceType: options.sourceType });
  }

  public create(input: CreateArticleInput) {
    return this.db.transaction(() => {
      const { rewritten, mentionedIssueIds } = rewriteIssueMentions(this.db, input.bodyMd);
      const article = createArticle(this.db, { ...input, bodyMd: rewritten });
      this.logger.logArticleCreated(
        article.id,
        input.title,
        rewritten,
        input.originalUrl
      );
      for (const targetId of mentionedIssueIds) {
        if (targetId === article.id) continue;
        this.linkService.createOrIgnore(article.id, targetId, 'relates');
      }
      return article;
    })();
  }

  /**
   * Sync apply path (POST /api/sync/push): create an article with a
   * client-minted uuid and preserved offline timestamps (createdAt /
   * meta.archivedAt). Same domain semantics as create().
   */
  public createFromSync(input: {
    uuid: string;
    title: string;
    bodyMd: string;
    originalUrl: string;
    siteName?: string;
    archivedAt?: string;
    createdAt?: string;
  }) {
    return this.db.transaction(() => {
      const { rewritten, mentionedIssueIds } = rewriteIssueMentions(this.db, input.bodyMd);
      const article = createArticle(this.db, { ...input, bodyMd: rewritten });
      this.logger.logArticleCreated(
        article.id,
        input.title,
        rewritten,
        input.originalUrl
      );
      for (const targetId of mentionedIssueIds) {
        if (targetId === article.id) continue;
        this.linkService.createOrIgnore(article.id, targetId, 'relates');
      }
      return article;
    })();
  }

  public get(id: number) {
    return getArticle(this.db, id);
  }

  public list(filters: ListArticleFilters = {}) {
    const data = listArticles(this.db, filters);
    const total = countArticles(this.db, filters);
    return { data, total };
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

// Sync Service (iOS offline sync)
export {
  SyncService,
  type SyncServiceOptions,
  type SyncPushEntity,
  type SyncPushLinkType,
  type SyncPushOperation,
  type SyncPushOperationResult,
  type SyncPushResult,
  type SyncPushStatus,
} from './syncService.js';

// Issue mention rewriting
export {
  rewriteIssueMentions,
  type RewriteIssueMentionsResult,
} from './issueMentions.js';

// URL Link Service
export { UrlLinkService, type UrlLinkServiceOptions } from './urlLinkService.js';

// Project Service
export { ProjectService, type ProjectServiceOptions } from './projectService.js';

// Embedding / Semantic Search
export {
  generateEmbedding,
  generateEmbeddings,
  checkEmbeddingHealth,
  loadEmbeddingConfig,
  type EmbeddingClientConfig,
} from './embedding/embeddingClient.js';
export {
  syncEmbeddings,
  updateSingleEmbedding,
  computeContentHash,
  formatDocumentText,
  type SyncOptions,
  type SyncResult,
} from './embedding/embeddingService.js';
export {
  cosineSimilarity,
  searchByVector,
  bufferToFloat32Array,
  type ScoredIssue,
  type VectorSearchOptions,
} from './embedding/vectorSearch.js';

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

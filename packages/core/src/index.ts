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
  deleteLabel,
  // Types
  type CreateMemoInput,
  type CreateTaskInput,
  type ListMemoFilters,
  type ListTaskFilters,
  type PromoteMemoInput,
  type UpdateMemoInput,
  type UpdateTaskInput
} from 'meme-gtd-db';

export interface MemoServiceOptions {
  config: MgtdConfig;
}

export class MemoService {
  private readonly db: Database.Database;

  constructor(private readonly options: MemoServiceOptions) {
    this.db = ensureDatabase(options.config);
  }

  public create(input: CreateMemoInput) {
    return createMemo(this.db, input);
  }

  public list(filters: ListMemoFilters = {}) {
    return listMemos(this.db, filters);
  }

  public show(id: number) {
    return getMemo(this.db, id);
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
  config: MgtdConfig;
}

export class TaskService {
  private readonly db: Database.Database;

  constructor(private readonly options: TaskServiceOptions) {
    this.db = ensureDatabase(options.config);
  }

  public create(input: CreateTaskInput) {
    return createTask(this.db, input);
  }

  public list(filters: ListTaskFilters = {}) {
    return listTasks(this.db, filters);
  }

  public show(id: number) {
    return getTask(this.db, id);
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
}

export interface LabelServiceOptions {
  config: MgtdConfig;
}

export class LabelService {
  private readonly db: Database.Database;

  constructor(private readonly options: LabelServiceOptions) {
    this.db = ensureDatabase(options.config);
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

  public delete(name: string) {
    return deleteLabel(this.db, name);
  }
}

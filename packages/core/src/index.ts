import Database from 'better-sqlite3';
import { ensureDatabase } from 'meme-gtd-db';
import type { MgtdConfig } from 'meme-gtd-config';
import {
  addComment,
  createMemo,
  deleteComment,
  deleteMemo,
  getMemo,
  listComments,
  listMemoLabels,
  listMemos,
  promoteMemo,
  setMemoLabels,
  updateComment,
  updateMemo,
  type CreateMemoInput,
  type ListMemoFilters,
  type PromoteMemoInput,
  type UpdateMemoInput
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
}

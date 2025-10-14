import Database from 'better-sqlite3';
import { nowIso, type Task, type Comment, toBoolean, type TaskStatus } from 'meme-gtd-shared';

export interface CreateTaskInput {
  title: string;
  bodyMd: string;
  status?: TaskStatus;
  scheduledOn?: string;
  labels?: string[];
  projectIds?: number[];
}

export interface UpdateTaskInput {
  id: number;
  title?: string;
  bodyMd?: string;
  status?: TaskStatus;
  scheduledOn?: string | null;
  addLabels?: string[];
  removeLabels?: string[];
  projectIds?: number[];
}

export interface ListTaskFilters {
  status?: TaskStatus;
  label?: string;
  search?: string;
  limit?: number;
  order?: 'asc' | 'desc';
  isBookmarked?: boolean;
}

const taskRowToTask = (row: any): Task => ({
  id: row.id,
  type: 'task',
  title: row.title,
  bodyMd: row.body_md,
  status: row.status as TaskStatus,
  scheduledOn: row.scheduled_on,
  meta: row.meta ? JSON.parse(row.meta) : null,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  isBookmarked: toBoolean(row.is_bookmarked),
  isDeleted: toBoolean(row.is_deleted)
});

const commentRowToComment = (row: any): Comment => ({
  id: row.id,
  issueId: row.issue_id,
  bodyMd: row.body_md,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  isDeleted: toBoolean(row.is_deleted)
});

// T012: Implement createTask()
export const createTask = (db: Database.Database, input: CreateTaskInput): Task => {
  const now = nowIso();
  const status = input.status ?? 'open';
  const stmt = db.prepare(
    `INSERT INTO issues (type, title, body_md, status, scheduled_on, meta, created_at, updated_at, is_bookmarked, is_deleted)
     VALUES ('task', @title, @body, @status, @scheduledOn, json('{}'), @createdAt, @createdAt, 0, 0)`
  );
  const result = stmt.run({
    title: input.title,
    body: input.bodyMd,
    status,
    scheduledOn: input.scheduledOn ?? null,
    createdAt: now
  });
  const taskId = Number(result.lastInsertRowid);

  if (input.labels?.length) {
    attachLabels(db, taskId, input.labels);
  }

  if (input.projectIds?.length) {
    attachProjects(db, taskId, input.projectIds);
  }

  return getTask(db, taskId);
};

// T013: Implement getTask() with type validation
export const getTask = (db: Database.Database, id: number): Task => {
  const row = db
    .prepare(
      `SELECT * FROM issues WHERE id = @id AND is_deleted = 0`
    )
    .get({ id });

  if (!row) {
    throw new Error(`Task not found: ${id}`);
  }

  if ((row as any).type !== 'task') {
    throw new Error(`ID refers to different type (${(row as any).type})`);
  }

  return taskRowToTask(row);
};

// T014: Implement listTasks() with filters
export const listTasks = (db: Database.Database, filters: ListTaskFilters = {}): Task[] => {
  const conditions = ["type = 'task'", 'is_deleted = 0'];
  const params: Record<string, any> = {};

  if (filters.status) {
    conditions.push('status = @status');
    params.status = filters.status;
  }

  if (filters.label) {
    conditions.push(
      `id IN (SELECT issue_id FROM issue_labels il JOIN labels l ON l.id = il.label_id WHERE l.name = @label)`
    );
    params.label = filters.label;
  }

  if (filters.isBookmarked !== undefined) {
    conditions.push('is_bookmarked = @isBookmarked');
    params.isBookmarked = filters.isBookmarked ? 1 : 0;
  }

  let orderBy = 'updated_at DESC';
  if (filters.order === 'asc') {
    orderBy = 'updated_at ASC';
  }

  let sql = `SELECT * FROM issues WHERE ${conditions.join(' AND ')} ORDER BY ${orderBy}`;
  if (filters.limit) {
    sql += ' LIMIT @limit';
    params.limit = filters.limit;
  }

  if (filters.search) {
    const searchConditions = ["i.type = 'task'", 'i.is_deleted = 0', 'f.body_md MATCH @search'];
    if (filters.status) {
      searchConditions.push('i.status = @status');
    }
    if (filters.isBookmarked !== undefined) {
      searchConditions.push('i.is_bookmarked = @isBookmarked');
    }
    sql = `SELECT i.* FROM issues i JOIN issues_fts f ON f.issue_id = i.id
            WHERE ${searchConditions.join(' AND ')}
            ORDER BY i.updated_at ${filters.order === 'asc' ? 'ASC' : 'DESC'}`;
    params.search = filters.search;
    if (filters.limit) {
      sql += ' LIMIT @limit';
    }
  }

  const rows = db.prepare(sql).all(params);
  return rows.map(taskRowToTask);
};

// T015: Implement updateTask()
export const updateTask = (db: Database.Database, input: UpdateTaskInput): Task => {
  const task = getTask(db, input.id);

  if (!input.title && !input.bodyMd && input.status === undefined && input.scheduledOn === undefined && !input.addLabels?.length && !input.removeLabels?.length) {
    return task;
  }

  const updates: string[] = [];
  const params: Record<string, any> = { id: input.id, updatedAt: nowIso() };

  if (input.title) {
    updates.push('title = @title');
    params.title = input.title;
  }

  if (input.bodyMd) {
    updates.push('body_md = @bodyMd');
    params.bodyMd = input.bodyMd;
  }

  if (input.status !== undefined) {
    updates.push('status = @status');
    params.status = input.status;
  }

  if (input.scheduledOn !== undefined) {
    updates.push('scheduled_on = @scheduledOn');
    params.scheduledOn = input.scheduledOn;
  }

  updates.push('updated_at = @updatedAt');

  if (updates.length > 1) { // More than just updated_at
    const sql = `UPDATE issues SET ${updates.join(', ')} WHERE id = @id AND type = 'task'`;
    db.prepare(sql).run(params);
  }

  if (input.addLabels?.length) {
    attachLabels(db, input.id, input.addLabels);
  }

  if (input.removeLabels?.length) {
    detachLabels(db, input.id, input.removeLabels);
  }

  if (input.projectIds) {
    resetProjects(db, input.id, input.projectIds);
  }

  return getTask(db, input.id);
};

// T016: Implement deleteTask()
export const deleteTask = (db: Database.Database, id: number): void => {
  const result = db
    .prepare(
      `UPDATE issues SET is_deleted = 1, updated_at = @updatedAt WHERE id = @id AND type = 'task'`
    )
    .run({ id, updatedAt: nowIso() });
  if (result.changes === 0) {
    throw new Error(`Task not found: ${id}`);
  }
};

// T017: Implement setTaskStatus()
export const setTaskStatus = (
  db: Database.Database,
  id: number,
  status: TaskStatus
): Task => {
  const task = getTask(db, id); // Validates type
  db.prepare(
    `UPDATE issues SET status = @status, updated_at = @updatedAt WHERE id = @id`
  ).run({ id, status, updatedAt: nowIso() });
  return getTask(db, id);
};

// T018: Implement task comment functions
export const addComment = (
  db: Database.Database,
  taskId: number,
  bodyMd: string
): Comment => {
  getTask(db, taskId); // Validate task exists and is correct type
  const now = nowIso();
  const result = db
    .prepare(
      `INSERT INTO comments (issue_id, body_md, created_at, updated_at, is_deleted)
       VALUES (@issueId, @bodyMd, @createdAt, @createdAt, 0)`
    )
    .run({ issueId: taskId, bodyMd, createdAt: now });

  return commentRowToComment(
    db.prepare('SELECT * FROM comments WHERE id = @id').get({ id: result.lastInsertRowid }) as any
  );
};

export const updateComment = (
  db: Database.Database,
  commentId: number,
  bodyMd: string
): Comment => {
  const now = nowIso();
  const existing = db
    .prepare('SELECT * FROM comments WHERE id = @id')
    .get({ id: commentId }) as any;
  if (!existing) {
    throw new Error(`Comment not found: ${commentId}`);
  }

  db.prepare(
    `INSERT INTO comment_revisions (comment_id, body_md, created_at)
     VALUES (@commentId, @bodyMd, @createdAt)`
  ).run({ commentId, bodyMd: existing.body_md, createdAt: now });

  db.prepare(
    `UPDATE comments SET body_md = @bodyMd, updated_at = @updatedAt WHERE id = @id`
  ).run({ id: commentId, bodyMd, updatedAt: now });

  return commentRowToComment(
    db.prepare('SELECT * FROM comments WHERE id = @id').get({ id: commentId }) as any
  );
};

export const deleteComment = (db: Database.Database, commentId: number): void => {
  const result = db
    .prepare('UPDATE comments SET is_deleted = 1, updated_at = @updatedAt WHERE id = @id')
    .run({ id: commentId, updatedAt: nowIso() });
  if (result.changes === 0) {
    throw new Error(`Comment not found: ${commentId}`);
  }
};

export const listComments = (db: Database.Database, taskId: number): Comment[] => {
  const rows = db
    .prepare('SELECT * FROM comments WHERE issue_id = @taskId AND is_deleted = 0 ORDER BY created_at ASC')
    .all({ taskId }) as any[];
  return rows.map(commentRowToComment);
};

// T019: Implement task label functions
export const listTaskLabels = (db: Database.Database, taskId: number): string[] => {
  const rows = db
    .prepare(`SELECT l.name FROM labels l JOIN issue_labels il ON il.label_id = l.id WHERE il.issue_id = @taskId ORDER BY l.name`)
    .all({ taskId }) as Array<{ name: string }>;
  return rows.map((row) => row.name);
};

export const setTaskLabels = (db: Database.Database, taskId: number, labels: string[]): void => {
  db.prepare('DELETE FROM issue_labels WHERE issue_id = @taskId').run({ taskId });
  if (labels.length === 0) {
    return;
  }
  attachLabels(db, taskId, labels);
};

// T020: Implement setBookmark() for tasks
export const setBookmark = (db: Database.Database, id: number, isBookmarked: boolean): void => {
  const stmt = db.prepare(
    `UPDATE issues
     SET is_bookmarked = @isBookmarked, updated_at = @updatedAt
     WHERE id = @id AND type = 'task' AND is_deleted = 0`
  );

  const result = stmt.run({
    id,
    isBookmarked: isBookmarked ? 1 : 0,
    updatedAt: nowIso()
  });

  if (result.changes === 0) {
    // Check if it's a type mismatch or not found
    const check = db
      .prepare('SELECT type FROM issues WHERE id = @id AND is_deleted = 0')
      .get({ id }) as { type: string } | undefined;

    if (check && check.type !== 'task') {
      throw new Error(`Issue #${id} is not a task`);
    }
    throw new Error(`Task #${id} not found`);
  }
};

// Shared helper functions (reused from memoRepository patterns)
const attachLabels = (db: Database.Database, issueId: number, labels: string[]): void => {
  const insertLabel = db.prepare(
    `INSERT OR IGNORE INTO labels (name, description, created_at)
     VALUES (@name, NULL, @createdAt)`
  );

  const linkLabel = db.prepare(
    `INSERT OR IGNORE INTO issue_labels (issue_id, label_id, assigned_at)
     VALUES (@issueId, (SELECT id FROM labels WHERE name = @name), @assignedAt)`
  );

  const now = nowIso();
  for (const name of labels) {
    insertLabel.run({ name, createdAt: now });
    linkLabel.run({ issueId, name, assignedAt: now });
  }
};

const detachLabels = (db: Database.Database, issueId: number, labels: string[]): void => {
  const stmt = db.prepare(
    `DELETE FROM issue_labels WHERE issue_id = @issueId AND label_id IN (
      SELECT id FROM labels WHERE name = @name
    )`
  );
  for (const name of labels) {
    stmt.run({ issueId, name });
  }
};

const attachProjects = (db: Database.Database, issueId: number, projectIds: number[]): void => {
  const stmt = db.prepare(
    `INSERT INTO project_items (project_id, issue_id, position, view_meta, created_at, updated_at)
     VALUES (@projectId, @issueId, @position, json('{}'), @createdAt, @createdAt)
     ON CONFLICT(project_id, issue_id) DO UPDATE SET
       position = excluded.position,
       updated_at = excluded.updated_at`
  );
  const now = nowIso();
  projectIds.forEach((projectId, index) => {
    stmt.run({
      projectId,
      issueId,
      position: index + 1,
      createdAt: now
    });
  });
};

const resetProjects = (db: Database.Database, issueId: number, projectIds: number[]): void => {
  db.prepare('DELETE FROM project_items WHERE issue_id = @issueId').run({ issueId });
  if (projectIds.length === 0) {
    return;
  }
  attachProjects(db, issueId, projectIds);
};

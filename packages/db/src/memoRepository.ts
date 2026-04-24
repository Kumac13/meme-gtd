import Database from 'better-sqlite3';
import { nowIso, type Memo, type Comment, toBoolean } from 'meme-gtd-shared';

export interface CreateMemoInput {
  bodyMd: string;
  labels?: string[];
  projectIds?: number[];
}

export interface UpdateMemoInput {
  id: number;
  bodyMd?: string;
  addLabels?: string[];
  removeLabels?: string[];
  projectIds?: number[];
}

export interface ListMemoFilters {
  label?: string;
  labels?: string[];
  search?: string;  // Search body (same as searchBody for memos)
  searchBody?: string;  // Search body only (explicit)
  createdFrom?: string;  // Filter memos created on or after this date (YYYY-MM-DD)
  createdTo?: string;    // Filter memos created on or before this date (YYYY-MM-DD)
  limit?: number;
  offset?: number;  // Pagination offset
  order?: 'asc' | 'desc';
  isBookmarked?: boolean;
  projectIds?: number[];   // Filter memos that belong to any of these projects (OR logic)
  includeNoProject?: boolean;  // When true, include memos not assigned to any project
}

// Build WHERE conditions for memos (shared by listMemos and countMemos)
const buildMemoConditions = (filters: ListMemoFilters): { conditions: string[]; params: Record<string, any> } => {
  const conditions = ["type = 'memo'", 'is_deleted = 0'];
  const params: Record<string, any> = {};

  if (filters.label) {
    conditions.push(
      `id IN (SELECT issue_id FROM issue_labels il JOIN labels l ON l.id = il.label_id WHERE l.name = @label)`
    );
    params.label = filters.label;
  }

  if (filters.labels && filters.labels.length > 0) {
    const labelPlaceholders = filters.labels.map((_, i) => `@label${i}`).join(', ');
    conditions.push(
      `id IN (SELECT issue_id FROM issue_labels il JOIN labels l ON l.id = il.label_id WHERE l.name IN (${labelPlaceholders}))`
    );
    filters.labels.forEach((labelName, i) => {
      params[`label${i}`] = labelName;
    });
  }

  if (filters.isBookmarked !== undefined) {
    conditions.push('is_bookmarked = @isBookmarked');
    params.isBookmarked = filters.isBookmarked ? 1 : 0;
  }

  // Project filter
  const hasProjectIds = filters.projectIds && filters.projectIds.length > 0;
  const hasNoProject = filters.includeNoProject;

  if (hasProjectIds && hasNoProject) {
    const projectPlaceholders = filters.projectIds!.map((_, i) => `@projectId${i}`).join(', ');
    conditions.push(
      `(id IN(SELECT issue_id FROM project_items WHERE project_id IN(${projectPlaceholders})) OR id NOT IN(SELECT issue_id FROM project_items))`
    );
    filters.projectIds!.forEach((projectId, i) => {
      params[`projectId${i}`] = projectId;
    });
  } else if (hasProjectIds) {
    const projectPlaceholders = filters.projectIds!.map((_, i) => `@projectId${i}`).join(', ');
    conditions.push(
      `id IN(SELECT issue_id FROM project_items WHERE project_id IN(${projectPlaceholders}))`
    );
    filters.projectIds!.forEach((projectId, i) => {
      params[`projectId${i}`] = projectId;
    });
  } else if (hasNoProject) {
    conditions.push(
      `id NOT IN(SELECT issue_id FROM project_items)`
    );
  }

  // Search filter (search body)
  const searchTerm = filters.search || filters.searchBody;
  if (searchTerm) {
    conditions.push('body_md LIKE @search');
    params.search = `%${searchTerm}%`;
  }

  // Date range filter (created_at)
  if (filters.createdFrom) {
    conditions.push("DATE(created_at, 'localtime') >= @createdFrom");
    params.createdFrom = filters.createdFrom;
  }
  if (filters.createdTo) {
    conditions.push("DATE(created_at, 'localtime') <= @createdTo");
    params.createdTo = filters.createdTo;
  }

  return { conditions, params };
};

// Count memos with filters (ignores limit/offset)
export const countMemos = (db: Database.Database, filters: ListMemoFilters = {}): number => {
  const { conditions, params } = buildMemoConditions(filters);

  const sql = `
    SELECT COUNT(*) as count
    FROM issues
    WHERE ${conditions.join(' AND ')}
  `;

  const row = db.prepare(sql).get(params) as { count: number };
  return row.count;
};

const memoRowToMemo = (row: any): Memo => ({
  id: row.id,
  type: 'memo',
  title: null,
  bodyMd: row.body_md,
  status: null,
  // New fields (always null for memos)
  scheduledStart: null,
  scheduledEnd: null,
  isAllDay: false,
  actualStart: null,
  actualEnd: null,
  // Deprecated fields (always null for memos)
  scheduledOn: null,
  startTime: null,
  endDate: null,
  endTime: null,
  duration: null,
  meta: row.meta ? JSON.parse(row.meta) : null,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  isBookmarked: toBoolean(row.is_bookmarked),
  isDeleted: toBoolean(row.is_deleted),
  commentCount: row.comment_count ?? 0,
  ...(row.preview != null && { preview: row.preview })
});

const commentRowToComment = (row: any): Comment => ({
  id: row.id,
  issueId: row.issue_id,
  bodyMd: row.body_md,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  isDeleted: toBoolean(row.is_deleted)
});

export const createMemo = (db: Database.Database, input: CreateMemoInput): Memo => {
  const now = nowIso();
  const stmt = db.prepare(
    `INSERT INTO issues (type, title, body_md, status, scheduled_on, meta, created_at, updated_at, is_bookmarked, is_deleted)
     VALUES ('memo', NULL, @body, NULL, NULL, json('{}'), @createdAt, @createdAt, 0, 0)`
  );
  const result = stmt.run({ body: input.bodyMd, createdAt: now });
  const memoId = Number(result.lastInsertRowid);

  if (input.labels?.length) {
    attachLabels(db, memoId, input.labels);
  }

  if (input.projectIds?.length) {
    attachProjects(db, memoId, input.projectIds);
  }

  return getMemo(db, memoId);
};

export const getMemo = (db: Database.Database, id: number): Memo => {
  const row = db
    .prepare(
      `SELECT * FROM issues WHERE id = @id AND type = 'memo' AND is_deleted = 0`
    )
    .get({ id });

  if (!row) {
    throw new Error(`Memo not found: ${id}`);
  }

  return memoRowToMemo(row);
};

export const listMemos = (db: Database.Database, filters: ListMemoFilters = {}): Memo[] => {
  const conditions = ["type = 'memo'", 'is_deleted = 0'];
  const params: Record<string, any> = {};

  if (filters.label) {
    conditions.push(
      `id IN (SELECT issue_id FROM issue_labels il JOIN labels l ON l.id = il.label_id WHERE l.name = @label)`
    );
    params.label = filters.label;
  }

  if (filters.labels && filters.labels.length > 0) {
    const labelPlaceholders = filters.labels.map((_, i) => `@label${i}`).join(', ');
    conditions.push(
      `id IN (SELECT issue_id FROM issue_labels il JOIN labels l ON l.id = il.label_id WHERE l.name IN (${labelPlaceholders}))`
    );
    filters.labels.forEach((labelName, i) => {
      params[`label${i}`] = labelName;
    });
  }

  if (filters.isBookmarked !== undefined) {
    conditions.push('is_bookmarked = @isBookmarked');
    params.isBookmarked = filters.isBookmarked ? 1 : 0;
  }

  // Project filter (duplicated from buildMemoConditions for listMemos inline path)
  const hasProjectIds = filters.projectIds && filters.projectIds.length > 0;
  const hasNoProject = filters.includeNoProject;

  if (hasProjectIds && hasNoProject) {
    const projectPlaceholders = filters.projectIds!.map((_, i) => `@projectId${i}`).join(', ');
    conditions.push(
      `(id IN(SELECT issue_id FROM project_items WHERE project_id IN(${projectPlaceholders})) OR id NOT IN(SELECT issue_id FROM project_items))`
    );
    filters.projectIds!.forEach((projectId, i) => {
      params[`projectId${i}`] = projectId;
    });
  } else if (hasProjectIds) {
    const projectPlaceholders = filters.projectIds!.map((_, i) => `@projectId${i}`).join(', ');
    conditions.push(
      `id IN(SELECT issue_id FROM project_items WHERE project_id IN(${projectPlaceholders}))`
    );
    filters.projectIds!.forEach((projectId, i) => {
      params[`projectId${i}`] = projectId;
    });
  } else if (hasNoProject) {
    conditions.push(
      `id NOT IN(SELECT issue_id FROM project_items)`
    );
  }

  // Date range filter (created_at)
  if (filters.createdFrom) {
    conditions.push("DATE(created_at, 'localtime') >= @createdFrom");
    params.createdFrom = filters.createdFrom;
  }
  if (filters.createdTo) {
    conditions.push("DATE(created_at, 'localtime') <= @createdTo");
    params.createdTo = filters.createdTo;
  }

  let orderBy = 'created_at DESC';
  if (filters.order === 'asc') {
    orderBy = 'created_at ASC';
  }

  let sql = `
    SELECT i.*,
      (SELECT COUNT(*) FROM comments c
       WHERE c.issue_id = i.id AND c.is_deleted = 0) as comment_count
    FROM issues i
    WHERE ${conditions.join(' AND ')}
    ORDER BY ${orderBy}`;
  if (filters.limit) {
    sql += ' LIMIT @limit';
    params.limit = filters.limit;
  }
  if (filters.offset !== undefined) {
    sql += ' OFFSET @offset';
    params.offset = filters.offset;
  }

  // Handle search filters (search or searchBody - both search body for memos)
  const searchTerm = filters.search || filters.searchBody;

  if (searchTerm) {
    const searchConditions = ["i.type = 'memo'", 'i.is_deleted = 0'];
    // Use LIKE for simple substring matching (supports %Memo% style search)
    searchConditions.push('i.body_md LIKE @search');
    params.search = `%${searchTerm}%`;

    if (filters.label) {
      searchConditions.push(
        `i.id IN (SELECT issue_id FROM issue_labels il JOIN labels l ON l.id = il.label_id WHERE l.name = @label)`
      );
    }
    if (filters.labels && filters.labels.length > 0) {
      const labelPlaceholders = filters.labels.map((_, i) => `@label${i}`).join(', ');
      searchConditions.push(
        `i.id IN (SELECT issue_id FROM issue_labels il JOIN labels l ON l.id = il.label_id WHERE l.name IN (${labelPlaceholders}))`
      );
    }
    if (filters.isBookmarked !== undefined) {
      searchConditions.push('i.is_bookmarked = @isBookmarked');
    }
    // Project filter for search path
    if (hasProjectIds && hasNoProject) {
      const projectPlaceholders = filters.projectIds!.map((_, i) => `@projectId${i}`).join(', ');
      searchConditions.push(
        `(i.id IN(SELECT issue_id FROM project_items WHERE project_id IN(${projectPlaceholders})) OR i.id NOT IN(SELECT issue_id FROM project_items))`
      );
    } else if (hasProjectIds) {
      const projectPlaceholders = filters.projectIds!.map((_, i) => `@projectId${i}`).join(', ');
      searchConditions.push(
        `i.id IN(SELECT issue_id FROM project_items WHERE project_id IN(${projectPlaceholders}))`
      );
    } else if (hasNoProject) {
      searchConditions.push(
        `i.id NOT IN(SELECT issue_id FROM project_items)`
      );
    }
    if (filters.createdFrom) {
      searchConditions.push("DATE(i.created_at, 'localtime') >= @createdFrom");
    }
    if (filters.createdTo) {
      searchConditions.push("DATE(i.created_at, 'localtime') <= @createdTo");
    }
    sql = `
      SELECT i.*,
        NULL as preview,
        (SELECT COUNT(*) FROM comments c
         WHERE c.issue_id = i.id AND c.is_deleted = 0) as comment_count
      FROM issues i
      WHERE ${searchConditions.join(' AND ')}
      ORDER BY i.created_at ${filters.order === 'asc' ? 'ASC' : 'DESC'}`;
    if (filters.limit) {
      sql += ' LIMIT @limit';
    }
    if (filters.offset !== undefined) {
      sql += ' OFFSET @offset';
    }
  }

  const rows = db.prepare(sql).all(params);
  return rows.map(memoRowToMemo);
};

export const updateMemo = (db: Database.Database, input: UpdateMemoInput): Memo => {
  const memo = getMemo(db, input.id);

  if (!input.bodyMd && !input.addLabels?.length && !input.removeLabels?.length) {
    return memo;
  }

  const updates: string[] = [];
  const params: Record<string, any> = { id: input.id, updatedAt: nowIso() };

  if (input.bodyMd) {
    updates.push('body_md = @bodyMd');
    params.bodyMd = input.bodyMd;
  }

  updates.push('updated_at = @updatedAt');

  if (updates.length > 0) {
    const sql = `UPDATE issues SET ${updates.join(', ')} WHERE id = @id AND type = 'memo'`;
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

  return getMemo(db, input.id);
};

export const deleteMemo = (db: Database.Database, id: number): void => {
  const result = db
    .prepare(
      `UPDATE issues SET is_deleted = 1, updated_at = @updatedAt WHERE id = @id AND type = 'memo'`
    )
    .run({ id, updatedAt: nowIso() });
  if (result.changes === 0) {
    throw new Error(`Memo not found: ${id}`);
  }
};

export interface PromoteMemoInput {
  memoId: number;
  title: string;
  bodyMd?: string;
  labels?: string[];
  status?: string;
  taskKind?: string;
  scheduledStart?: string | null;
  scheduledEnd?: string | null;
  isAllDay?: boolean;
}

export const getPromotePreview = (
  db: Database.Database,
  memoId: number
): { bodyMd: string } => {
  const memo = getMemo(db, memoId);
  const comments = listComments(db, memoId);
  return { bodyMd: buildPromoteBody(memo.bodyMd, comments) };
};

export const promoteMemo = (
  db: Database.Database,
  input: PromoteMemoInput
): { memo: Memo; taskId: number } => {
  const memo = getMemo(db, input.memoId);
  const comments = listComments(db, input.memoId);

  const now = nowIso();
  const insertTask = db.prepare(
    `INSERT INTO issues (type, title, body_md, status, task_kind, scheduled_start, scheduled_end, is_all_day, scheduled_on, meta, created_at, updated_at, is_bookmarked, is_deleted)
     VALUES ('task', @title, @body, @status, @taskKind, @scheduledStart, @scheduledEnd, @isAllDay, NULL, json('{}'), @createdAt, @createdAt, 0, 0)`
  );

  const result = insertTask.run({
    title: input.title,
    body: input.bodyMd && input.bodyMd.length > 0 ? input.bodyMd : buildPromoteBody(memo.bodyMd, comments),
    status: input.status ?? 'open',
    taskKind: input.taskKind ?? 'action',
    scheduledStart: input.scheduledStart ?? null,
    scheduledEnd: input.scheduledEnd ?? null,
    isAllDay: input.isAllDay ? 1 : 0,
    createdAt: now
  });

  const taskId = Number(result.lastInsertRowid);

  db.prepare(
    `INSERT INTO links (source_issue_id, target_issue_id, link_type, created_at)
     VALUES (@source, @target, 'derived_from', @createdAt)`
  ).run({ source: taskId, target: memo.id, createdAt: now });

  const labelsToAttach = input.labels ?? listMemoLabels(db, memo.id);
  if (labelsToAttach.length) {
    attachLabels(db, taskId, labelsToAttach);
  }

  const memoProjectIds = db
    .prepare(`SELECT project_id FROM project_items WHERE issue_id = @memoId ORDER BY position`)
    .all({ memoId: memo.id }) as Array<{ project_id: number }>;
  if (memoProjectIds.length) {
    attachProjects(db, taskId, memoProjectIds.map((row) => row.project_id));
  }

  copyMemoLinks(db, memo.id, taskId, now);

  return { memo, taskId };
};

export const buildPromoteBody = (baseBody: string, comments: Comment[]): string => {
  const parts: string[] = [];

  if (baseBody) {
    parts.push(baseBody);
  }

  if (comments.length > 0) {
    parts.push('');
    parts.push('---');
    parts.push('## コメント');
    parts.push('');

    for (const comment of comments) {
      parts.push(`### ${comment.createdAt}`);
      parts.push(comment.bodyMd);
      parts.push('');
    }
  }

  return parts.join('\n').trim();
};

const copyMemoLinks = (
  db: Database.Database,
  memoId: number,
  taskId: number,
  createdAt: string
): void => {
  const links = db.prepare(`
    SELECT source_issue_id, target_issue_id, link_type
    FROM links
    WHERE (source_issue_id = @memoId OR target_issue_id = @memoId)
      AND NOT (source_issue_id = @taskId AND link_type = 'derived_from')
  `).all({ memoId, taskId }) as Array<{
    source_issue_id: number;
    target_issue_id: number;
    link_type: string;
  }>;

  const insertLink = db.prepare(`
    INSERT INTO links (source_issue_id, target_issue_id, link_type, created_at)
    VALUES (@source, @target, @linkType, @createdAt)
  `);

  for (const link of links) {
    if (link.source_issue_id === memoId) {
      insertLink.run({
        source: taskId,
        target: link.target_issue_id,
        linkType: link.link_type,
        createdAt,
      });
    } else {
      insertLink.run({
        source: link.source_issue_id,
        target: taskId,
        linkType: link.link_type,
        createdAt,
      });
    }
  }
};

export const addComment = (
  db: Database.Database,
  memoId: number,
  bodyMd: string
): Comment => {
  const now = nowIso();
  const result = db
    .prepare(
      `INSERT INTO comments (issue_id, body_md, created_at, updated_at, is_deleted)
       VALUES (@issueId, @bodyMd, @createdAt, @createdAt, 0)`
    )
    .run({ issueId: memoId, bodyMd, createdAt: now });

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

export const listComments = (db: Database.Database, memoId: number): Comment[] => {
  const rows = db
    .prepare('SELECT * FROM comments WHERE issue_id = @memoId AND is_deleted = 0 ORDER BY created_at ASC')
    .all({ memoId }) as any[];
  return rows.map(commentRowToComment);
};

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


export const listMemoLabels = (db: Database.Database, memoId: number): string[] => {
  const rows = db
    .prepare(`SELECT l.name FROM labels l JOIN issue_labels il ON il.label_id = l.id WHERE il.issue_id = @memoId ORDER BY l.name`)
    .all({ memoId }) as Array<{ name: string }>;
  return rows.map((row) => row.name);
};

export const setMemoLabels = (db: Database.Database, memoId: number, labels: string[]): void => {
  db.prepare('DELETE FROM issue_labels WHERE issue_id = @memoId').run({ memoId });
  if (labels.length === 0) {
    return;
  }
  attachLabels(db, memoId, labels);
};
const resetProjects = (db: Database.Database, issueId: number, projectIds: number[]): void => {
  db.prepare('DELETE FROM project_items WHERE issue_id = @issueId').run({ issueId });
  if (projectIds.length === 0) {
    return;
  }
  attachProjects(db, issueId, projectIds);
};

export const setBookmark = (db: Database.Database, id: number, isBookmarked: boolean): void => {
  const stmt = db.prepare(
    `UPDATE issues
     SET is_bookmarked = @isBookmarked, updated_at = @updatedAt
     WHERE id = @id AND type = 'memo' AND is_deleted = 0`
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

    if (check && check.type !== 'memo') {
      throw new Error(`Issue #${id} is not a memo`);
    }
    throw new Error(`Memo #${id} not found`);
  }
};

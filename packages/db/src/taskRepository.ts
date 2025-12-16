import Database from 'better-sqlite3';
import { nowIso, type Task, type Comment, toBoolean, type TaskStatus } from 'meme-gtd-shared';

export interface CreateTaskInput {
  title: string;
  bodyMd: string;
  status?: TaskStatus;
  // New scheduling fields (ISO 8601 datetime)
  scheduledStart?: string;
  scheduledEnd?: string;
  isAllDay?: boolean;
  // Deprecated fields (kept for backward compatibility)
  scheduledOn?: string;
  startTime?: string;
  endDate?: string;
  endTime?: string;
  duration?: number;
  labels?: string[];
  projectIds?: number[];
}

export interface UpdateTaskInput {
  id: number;
  title?: string;
  bodyMd?: string;
  status?: TaskStatus;
  // New scheduling fields (ISO 8601 datetime)
  scheduledStart?: string | null;
  scheduledEnd?: string | null;
  isAllDay?: boolean;
  // New execution fields (ISO 8601 datetime)
  actualStart?: string | null;
  actualEnd?: string | null;
  // Deprecated fields (kept for backward compatibility)
  scheduledOn?: string | null;
  startTime?: string | null;
  endDate?: string | null;
  endTime?: string | null;
  duration?: number | null;
  addLabels?: string[];
  removeLabels?: string[];
  projectIds?: number[];
}

export interface ListTaskFilters {
  status?: TaskStatus;
  label?: string;
  labels?: string[];
  search?: string;  // Search both title and body (shorthand)
  searchTitle?: string;  // Search title only
  searchBody?: string;  // Search body only
  limit?: number;
  order?: 'asc' | 'desc';
  isBookmarked?: boolean;
  scheduledFrom?: string;  // Filter tasks where scheduled_on >= this date (YYYY-MM-DD)
  scheduledTo?: string;    // Filter tasks where scheduled_on <= this date (YYYY-MM-DD)
}

const taskRowToTask = (row: any): Task => ({
  id: row.id,
  type: 'task',
  title: row.title,
  bodyMd: row.body_md,
  status: row.status as TaskStatus,
  // New fields
  scheduledStart: row.scheduled_start,
  scheduledEnd: row.scheduled_end,
  isAllDay: toBoolean(row.is_all_day ?? 0),
  actualStart: row.actual_start,
  actualEnd: row.actual_end,
  // Deprecated fields (read-only)
  scheduledOn: row.scheduled_on,
  endDate: row.end_date,
  startTime: row.start_time,
  endTime: row.end_time,
  duration: row.duration,
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

// T012: Implement createTask()
export const createTask = (db: Database.Database, input: CreateTaskInput): Task => {
  const now = nowIso();
  const status = input.status ?? 'inbox';
  const { startTime, endTime, duration } = calculateTimeFields(
    input.startTime,
    input.endTime,
    input.duration
  );

  // Auto-set actual_start when creating task with status='next'
  let actualStart: string | null = null;
  if (status === 'next') {
    const { date, time } = getLocalDateTime();
    actualStart = `${date}T${time}:00`;
  }

  const stmt = db.prepare(
    `INSERT INTO issues (type, title, body_md, status, actual_start, scheduled_start, scheduled_end, is_all_day, scheduled_on, end_date, start_time, end_time, duration, meta, created_at, updated_at, is_bookmarked, is_deleted)
     VALUES ('task', @title, @body, @status, @actualStart, @scheduledStart, @scheduledEnd, @isAllDay, @scheduledOn, @endDate, @startTime, @endTime, @duration, json('{}'), @createdAt, @createdAt, 0, 0)`
  );
  const result = stmt.run({
    title: input.title,
    body: input.bodyMd,
    status,
    actualStart,
    // New fields
    scheduledStart: input.scheduledStart ?? null,
    scheduledEnd: input.scheduledEnd ?? null,
    isAllDay: input.isAllDay ? 1 : 0,
    // Deprecated fields (kept for backward compatibility)
    scheduledOn: input.scheduledOn ?? null,
    endDate: input.endDate ?? input.scheduledOn ?? null,
    startTime: startTime ?? null,
    endTime: endTime ?? null,
    duration: duration ?? null,
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
    throw new Error(`ID refers to different type(${(row as any).type})`);
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
      `id IN(SELECT issue_id FROM issue_labels il JOIN labels l ON l.id = il.label_id WHERE l.name = @label)`
    );
    params.label = filters.label;
  }

  if (filters.labels && filters.labels.length > 0) {
    const labelPlaceholders = filters.labels.map((_, i) => `@label${i}`).join(', ');
    conditions.push(
      `id IN(SELECT issue_id FROM issue_labels il JOIN labels l ON l.id = il.label_id WHERE l.name IN(${labelPlaceholders}))`
    );
    filters.labels.forEach((labelName, i) => {
      params[`label${i}`] = labelName;
    });
  }

  if (filters.isBookmarked !== undefined) {
    conditions.push('is_bookmarked = @isBookmarked');
    params.isBookmarked = filters.isBookmarked ? 1 : 0;
  }

  // Date range filters for calendar view
  // Priority: scheduled_start, fallback to actual_start for tasks without schedule
  if (filters.scheduledFrom && filters.scheduledTo) {
    // Use COALESCE to check scheduled_start first, then actual_start
    // Extract date part from datetime (YYYY-MM-DDTHH:MM:SS -> YYYY-MM-DD)
    conditions.push(`(
      (scheduled_start IS NOT NULL AND DATE(scheduled_start) >= @scheduledFrom AND DATE(scheduled_start) <= @scheduledTo)
      OR (scheduled_start IS NULL AND actual_start IS NOT NULL AND DATE(actual_start) >= @scheduledFrom AND DATE(actual_start) <= @scheduledTo)
    )`);
    params.scheduledFrom = filters.scheduledFrom;
    params.scheduledTo = filters.scheduledTo;
  } else if (filters.scheduledFrom) {
    conditions.push(`(
      (scheduled_start IS NOT NULL AND DATE(scheduled_start) >= @scheduledFrom)
      OR (scheduled_start IS NULL AND actual_start IS NOT NULL AND DATE(actual_start) >= @scheduledFrom)
    )`);
    params.scheduledFrom = filters.scheduledFrom;
  } else if (filters.scheduledTo) {
    conditions.push(`(
      (scheduled_start IS NOT NULL AND DATE(scheduled_start) <= @scheduledTo)
      OR (scheduled_start IS NULL AND actual_start IS NOT NULL AND DATE(actual_start) <= @scheduledTo)
    )`);
    params.scheduledTo = filters.scheduledTo;
  }

  let orderBy = 'updated_at DESC';
  if (filters.order === 'asc') {
    orderBy = 'updated_at ASC';
  }

  let sql = `
    SELECT i.*,
  (SELECT COUNT(*) FROM comments c
       WHERE c.issue_id = i.id AND c.is_deleted = 0) as comment_count
    FROM issues i
    WHERE ${conditions.join(' AND ')}
    ORDER BY ${orderBy} `;
  if (filters.limit) {
    sql += ' LIMIT @limit';
    params.limit = filters.limit;
  }

  // Handle search filters (search, searchTitle, searchBody)
  const hasSearch = filters.search || filters.searchTitle || filters.searchBody;

  if (hasSearch) {
    const searchConditions = ["i.type = 'task'", 'i.is_deleted = 0'];
    let useFts = false;

    // Build search conditions
    if (filters.search) {
      // Use LIKE for simple substring matching (title only)
      searchConditions.push('i.title LIKE @search');
      params.search = `%${filters.search}%`;
    } else {
      // Use FTS5 for specific field searches
      useFts = true;
      const ftsConditions: string[] = [];
      if (filters.searchTitle) {
        ftsConditions.push('f.title MATCH @searchTitle');
        params.searchTitle = filters.searchTitle;
      }
      if (filters.searchBody) {
        ftsConditions.push('f.body_md MATCH @searchBody');
        params.searchBody = filters.searchBody;
      }
      // Multiple field searches need UNION or separate queries
      // For now, combine them with OR at SQL level using IN with subqueries
      if (ftsConditions.length > 1) {
        searchConditions.push(
          `i.id IN(SELECT issue_id FROM issues_fts WHERE ${ftsConditions.join(' OR ')})`
        );
      } else {
        searchConditions.push(ftsConditions[0]);
      }
    }

    if (filters.status) {
      searchConditions.push('i.status = @status');
    }
    if (filters.label) {
      searchConditions.push(
        `i.id IN(SELECT issue_id FROM issue_labels il JOIN labels l ON l.id = il.label_id WHERE l.name = @label)`
      );
    }
    if (filters.labels && filters.labels.length > 0) {
      const labelPlaceholders = filters.labels.map((_, i) => `@label${i}`).join(', ');
      searchConditions.push(
        `i.id IN(SELECT issue_id FROM issue_labels il JOIN labels l ON l.id = il.label_id WHERE l.name IN(${labelPlaceholders}))`
      );
    }
    if (filters.isBookmarked !== undefined) {
      searchConditions.push('i.is_bookmarked = @isBookmarked');
    }
    // Date range filters for calendar view (also apply to search)
    // Priority: scheduled_start, fallback to actual_start for tasks without schedule
    if (filters.scheduledFrom && filters.scheduledTo) {
      searchConditions.push(`(
        (i.scheduled_start IS NOT NULL AND DATE(i.scheduled_start) >= @scheduledFrom AND DATE(i.scheduled_start) <= @scheduledTo)
        OR (i.scheduled_start IS NULL AND i.actual_start IS NOT NULL AND DATE(i.actual_start) >= @scheduledFrom AND DATE(i.actual_start) <= @scheduledTo)
      )`);
    } else if (filters.scheduledFrom) {
      searchConditions.push(`(
        (i.scheduled_start IS NOT NULL AND DATE(i.scheduled_start) >= @scheduledFrom)
        OR (i.scheduled_start IS NULL AND i.actual_start IS NOT NULL AND DATE(i.actual_start) >= @scheduledFrom)
      )`);
    } else if (filters.scheduledTo) {
      searchConditions.push(`(
        (i.scheduled_start IS NOT NULL AND DATE(i.scheduled_start) <= @scheduledTo)
        OR (i.scheduled_start IS NULL AND i.actual_start IS NOT NULL AND DATE(i.actual_start) <= @scheduledTo)
      )`);
    }

    if (useFts) {
      // FTS5 query with snippet preview
      sql = `
        SELECT i.*,
    snippet(issues_fts, -1, '<mark>', '</mark>', '...', 15) as preview,
    (SELECT COUNT(*) FROM comments c
           WHERE c.issue_id = i.id AND c.is_deleted = 0) as comment_count
        FROM issues i
        JOIN issues_fts f ON f.issue_id = i.id
        WHERE ${searchConditions.join(' AND ')}
        ORDER BY i.updated_at ${filters.order === 'asc' ? 'ASC' : 'DESC'} `;
    } else {
      // Simple LIKE query without FTS5
      sql = `
        SELECT i.*,
    NULL as preview,
    (SELECT COUNT(*) FROM comments c
           WHERE c.issue_id = i.id AND c.is_deleted = 0) as comment_count
        FROM issues i
        WHERE ${searchConditions.join(' AND ')}
        ORDER BY i.updated_at ${filters.order === 'asc' ? 'ASC' : 'DESC'} `;
    }
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

  // Check if any actual update fields are provided (excluding labels/projects which are handled separately)
  if (
    input.title === undefined &&
    input.bodyMd === undefined &&
    input.status === undefined &&
    // New fields
    input.scheduledStart === undefined &&
    input.scheduledEnd === undefined &&
    input.isAllDay === undefined &&
    input.actualStart === undefined &&
    input.actualEnd === undefined &&
    // Deprecated fields
    input.scheduledOn === undefined &&
    input.endDate === undefined &&
    input.startTime === undefined &&
    input.endTime === undefined &&
    input.duration === undefined &&
    !input.addLabels?.length &&
    !input.removeLabels?.length &&
    input.projectIds === undefined // projectIds being undefined means no change, empty array means reset
  ) {
    return task;
  }

  const updates: string[] = [];
  const params: Record<string, any> = { id: input.id, updatedAt: nowIso() };

  if (input.title !== undefined) {
    updates.push('title = @title');
    params.title = input.title;
  }

  if (input.bodyMd !== undefined) {
    updates.push('body_md = @bodyMd');
    params.bodyMd = input.bodyMd;
  }

  // New scheduling fields
  if (input.scheduledStart !== undefined) {
    updates.push('scheduled_start = @scheduledStart');
    params.scheduledStart = input.scheduledStart;
  }

  if (input.scheduledEnd !== undefined) {
    updates.push('scheduled_end = @scheduledEnd');
    params.scheduledEnd = input.scheduledEnd;
  }

  if (input.isAllDay !== undefined) {
    updates.push('is_all_day = @isAllDay');
    params.isAllDay = input.isAllDay ? 1 : 0;
  }

  // New execution fields (manual override)
  if (input.actualStart !== undefined) {
    updates.push('actual_start = @actualStart');
    params.actualStart = input.actualStart;
  }

  if (input.actualEnd !== undefined) {
    updates.push('actual_end = @actualEnd');
    params.actualEnd = input.actualEnd;
  }

  // Detect status change for auto-setting date/time fields
  const isStatusChange = input.status !== undefined && input.status !== task.status;
  const { date: currentDate, time: currentTime } = getLocalDateTime();

  if (input.status !== undefined) {
    updates.push('status = @status');
    params.status = input.status;

    // Auto-set actual_start/actual_end on status change (only if not explicitly provided)
    if (isStatusChange) {
      const currentDatetime = `${currentDate}T${currentTime}:00`; // ISO 8601 format

      if (input.status === 'done') {
        // Auto-set actual_end if not explicitly provided
        if (input.actualEnd === undefined) {
          updates.push('actual_end = @autoActualEnd');
          params.autoActualEnd = currentDatetime;
        }
      } else if (input.status === 'next') {
        // Auto-set actual_start if not explicitly provided
        if (input.actualStart === undefined) {
          updates.push('actual_start = @autoActualStart');
          params.autoActualStart = currentDatetime;
        }
        // Clear actual_end unless explicitly set
        if (input.actualEnd === undefined) {
          updates.push('actual_end = NULL');
        }
      }
    }
  }

  if (input.scheduledOn !== undefined) {
    updates.push('scheduled_on = @scheduledOn');
    params.scheduledOn = input.scheduledOn;
  }

  if (input.endDate !== undefined) {
    updates.push('end_date = @endDate');
    params.endDate = input.endDate;
  }

  // Calculate time fields
  if (input.startTime !== undefined || input.endTime !== undefined || input.duration !== undefined) {
    const { startTime, endTime, duration } = calculateTimeFields(
      input.startTime,
      input.endTime,
      input.duration,
      task.startTime,
      task.endTime,
      task.duration
    );

    if (startTime !== undefined) {
      updates.push('start_time = @startTime');
      params.startTime = startTime;
    }
    if (endTime !== undefined) {
      updates.push('end_time = @endTime');
      params.endTime = endTime;
    }
    if (duration !== undefined) {
      updates.push('duration = @duration');
      params.duration = duration;
    }
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
    throw new Error(`Task not found: ${id} `);
  }
};

// T017: Implement setTaskStatus()
export const setTaskStatus = (
  db: Database.Database,
  id: number,
  status: TaskStatus
): Task => {
  getTask(db, id); // Validates type and existence
  const { date: currentDate, time: currentTime } = getLocalDateTime();
  const currentDatetime = `${currentDate}T${currentTime}:00`; // ISO 8601 format

  const updates: string[] = ['status = @status', 'updated_at = @updatedAt'];
  const params: Record<string, unknown> = { id, status, updatedAt: nowIso() };

  if (status === 'done') {
    // Set actual_end to current datetime
    updates.push('actual_end = @actualEnd');
    params.actualEnd = currentDatetime;
    // Note: deprecated fields (end_date, end_time) are NOT written anymore
  } else if (status === 'next') {
    // Set actual_start to current datetime
    updates.push('actual_start = @actualStart');
    params.actualStart = currentDatetime;

    // Clear actual_end (task is restarted)
    updates.push('actual_end = NULL');
    // Note: deprecated fields (scheduled_on, start_time) are NOT written anymore
  }

  db.prepare(`UPDATE issues SET ${updates.join(', ')} WHERE id = @id`).run(params);
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
      `INSERT INTO comments(issue_id, body_md, created_at, updated_at, is_deleted)
VALUES(@issueId, @bodyMd, @createdAt, @createdAt, 0)`
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
    throw new Error(`Comment not found: ${commentId} `);
  }

  db.prepare(
    `INSERT INTO comment_revisions(comment_id, body_md, created_at)
VALUES(@commentId, @bodyMd, @createdAt)`
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
    throw new Error(`Comment not found: ${commentId} `);
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
    `INSERT OR IGNORE INTO labels(name, description, created_at)
VALUES(@name, NULL, @createdAt)`
  );

  const linkLabel = db.prepare(
    `INSERT OR IGNORE INTO issue_labels(issue_id, label_id, assigned_at)
VALUES(@issueId, (SELECT id FROM labels WHERE name = @name), @assignedAt)`
  );

  const now = nowIso();
  for (const name of labels) {
    insertLabel.run({ name, createdAt: now });
    linkLabel.run({ issueId, name, assignedAt: now });
  }
};

const detachLabels = (db: Database.Database, issueId: number, labels: string[]): void => {
  const stmt = db.prepare(
    `DELETE FROM issue_labels WHERE issue_id = @issueId AND label_id IN(
  SELECT id FROM labels WHERE name = @name
)`
  );
  for (const name of labels) {
    stmt.run({ issueId, name });
  }
};

const attachProjects = (db: Database.Database, issueId: number, projectIds: number[]): void => {
  const stmt = db.prepare(
    `INSERT INTO project_items(project_id, issue_id, position, view_meta, created_at, updated_at)
VALUES(@projectId, @issueId, @position, json('{}'), @createdAt, @createdAt)
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

// Helper to calculate time fields
const calculateTimeFields = (
  newStart?: string | null,
  newEnd?: string | null,
  newDuration?: number | null,
  oldStart?: string | null,
  oldEnd?: string | null,
  oldDuration?: number | null
): { startTime?: string | null; endTime?: string | null; duration?: number | null } => {
  // Resolve effective values (new > old)
  // Note: undefined means "no change", null means "clear"
  const start = newStart !== undefined ? newStart : oldStart;
  const end = newEnd !== undefined ? newEnd : oldEnd;
  const duration = newDuration !== undefined ? newDuration : oldDuration;

  // If any is null, we might need to clear others or recalculate
  // But for now, let's stick to the "update" logic

  let finalStart = start;
  let finalEnd = end;
  let finalDuration = duration;

  // 1. Change Start: Keep Duration, Recalc End
  if (newStart !== undefined && newStart !== null) {
    if (finalDuration) {
      finalEnd = addMinutes(newStart, finalDuration);
    } else if (finalEnd) {
      // If we have end but no duration, calc duration
      finalDuration = diffMinutes(newStart, finalEnd);
    }
  }
  // 2. Change End: Keep Start, Recalc Duration
  else if (newEnd !== undefined && newEnd !== null) {
    if (finalStart) {
      finalDuration = diffMinutes(finalStart, newEnd);
    }
  }
  // 3. Change Duration: Keep Start, Recalc End
  else if (newDuration !== undefined && newDuration !== null) {
    if (finalStart) {
      finalEnd = addMinutes(finalStart, newDuration);
    } else if (finalEnd) {
      // If we have end but no start, calc start (reverse)
      finalStart = subMinutes(finalEnd, newDuration);
    }
  }

  return { startTime: finalStart, endTime: finalEnd, duration: finalDuration };
};

const timeToMinutes = (time: string): number => {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
};

const minutesToTime = (minutes: number): string => {
  const h = Math.floor(minutes / 60) % 24;
  const m = minutes % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
};

const addMinutes = (time: string, minutes: number): string => {
  const total = timeToMinutes(time) + minutes;
  return minutesToTime(total);
};

const subMinutes = (time: string, minutes: number): string => {
  const total = timeToMinutes(time) - minutes;
  // Handle negative (prev day) if needed, but for now assume same day or wrap
  return minutesToTime(total >= 0 ? total : total + 24 * 60);
};

const diffMinutes = (start: string, end: string): number => {
  let diff = timeToMinutes(end) - timeToMinutes(start);
  if (diff < 0) diff += 24 * 60; // Assume wrap around midnight
  return diff;
};

/**
 * Get current local date and time
 * Returns date in YYYY-MM-DD format and time in HH:MM format
 * Uses local timezone (not UTC) for consistent user experience
 */
const getLocalDateTime = (): { date: string; time: string } => {
  const now = new Date();
  const year = now.getFullYear();
  const month = (now.getMonth() + 1).toString().padStart(2, '0');
  const day = now.getDate().toString().padStart(2, '0');
  const hours = now.getHours().toString().padStart(2, '0');
  const minutes = now.getMinutes().toString().padStart(2, '0');
  return {
    date: `${year}-${month}-${day}`,
    time: `${hours}:${minutes}`
  };
};

// Demote task to memo
export interface DemoteTaskInput {
  taskId: number;
  bodyMd?: string;
  labels?: string[];
}

export const demoteTask = (
  db: Database.Database,
  input: DemoteTaskInput
): { task: Task; memoId: number } => {
  const task = getTask(db, input.taskId);
  const comments = listComments(db, input.taskId);

  // Build memo body from task title, body, and comments
  const bodyMd = input.bodyMd ?? buildDemoteBody(task, comments);

  const now = nowIso();

  // Create memo
  const insertMemo = db.prepare(
    `INSERT INTO issues (type, title, body_md, status, scheduled_on, meta, created_at, updated_at, is_bookmarked, is_deleted)
     VALUES ('memo', NULL, @body, NULL, NULL, json('{}'), @createdAt, @createdAt, 0, 0)`
  );

  const result = insertMemo.run({
    body: bodyMd,
    createdAt: now
  });

  const memoId = Number(result.lastInsertRowid);

  // Create link from memo to task (derived_from)
  db.prepare(
    `INSERT INTO links (source_issue_id, target_issue_id, link_type, created_at)
     VALUES (@source, @target, 'derived_from', @createdAt)`
  ).run({ source: memoId, target: task.id, createdAt: now });

  // Copy labels from task to memo
  const taskLabels = input.labels ?? listTaskLabels(db, input.taskId);
  if (taskLabels.length > 0) {
    attachLabels(db, memoId, taskLabels);
  }

  // Copy projects from task to memo
  const projectIds = getTaskProjectIds(db, input.taskId);
  if (projectIds.length > 0) {
    attachProjects(db, memoId, projectIds);
  }

  // Copy existing links from task to memo
  copyTaskLinks(db, input.taskId, memoId, now);

  return { task, memoId };
};

const buildDemoteBody = (task: Task, comments: Comment[]): string => {
  const parts: string[] = [];

  // Add title as heading
  if (task.title) {
    parts.push(`# ${task.title}`);
    parts.push('');
  }

  // Add body
  if (task.bodyMd) {
    parts.push(task.bodyMd);
  }

  // Add comments section if there are comments
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

const getTaskProjectIds = (db: Database.Database, taskId: number): number[] => {
  const rows = db
    .prepare('SELECT project_id FROM project_items WHERE issue_id = @taskId ORDER BY position')
    .all({ taskId }) as Array<{ project_id: number }>;
  return rows.map((row) => row.project_id);
};

/**
 * Copy existing links from task to memo
 * - Outgoing links (source = taskId): create new link with source = memoId
 * - Incoming links (target = taskId): create new link with target = memoId
 */
const copyTaskLinks = (
  db: Database.Database,
  taskId: number,
  memoId: number,
  createdAt: string
): void => {
  // Get all links for the task (excluding the derived_from link we just created)
  const links = db.prepare(`
    SELECT source_issue_id, target_issue_id, link_type
    FROM links
    WHERE (source_issue_id = @taskId OR target_issue_id = @taskId)
      AND NOT (source_issue_id = @memoId AND link_type = 'derived_from')
  `).all({ taskId, memoId }) as Array<{
    source_issue_id: number;
    target_issue_id: number;
    link_type: string;
  }>;

  const insertLink = db.prepare(`
    INSERT INTO links (source_issue_id, target_issue_id, link_type, created_at)
    VALUES (@source, @target, @linkType, @createdAt)
  `);

  for (const link of links) {
    if (link.source_issue_id === taskId) {
      // Outgoing link: task -> other, create memo -> other
      insertLink.run({
        source: memoId,
        target: link.target_issue_id,
        linkType: link.link_type,
        createdAt,
      });
    } else {
      // Incoming link: other -> task, create other -> memo
      insertLink.run({
        source: link.source_issue_id,
        target: memoId,
        linkType: link.link_type,
        createdAt,
      });
    }
  }
};

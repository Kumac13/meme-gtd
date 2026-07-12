import Database from "better-sqlite3";
import { nowIso, uuidv7, toBoolean, type Template, type TemplateTarget } from "meme-gtd-shared";

export interface CreateTemplateInput {
  title: string | null;
  bodyMd: string;
  templateTarget: TemplateTarget;
  labels?: string[];
  projects?: number[];
  // Sync apply path: client-minted identity / preserved timestamps.
  uuid?: string;
  createdAt?: string;
}

export interface UpdateTemplateInput {
  title?: string | null;
  bodyMd?: string;
  templateTarget?: TemplateTarget;
  labels?: string[];
  projects?: number[];
}

export interface ListTemplateFilters {
  limit?: number;
  offset?: number;
  search?: string;
  /** Restrict to templates that produce this issue type (drives the New Task / New Article choosers). */
  target?: TemplateTarget;
}

const templateRowToTemplate = (row: unknown): Template => {
  const r = row as Record<string, unknown>;
  if (!r || typeof r !== "object") throw new Error("Invalid row data");

  return {
    id: Number(r.id),
    uuid: r.uuid ? String(r.uuid) : undefined,
    serverSeq: r.server_seq != null ? Number(r.server_seq) : undefined,
    type: "template",
    templateTarget: String(r.template_target) as TemplateTarget,
    title: r.title != null ? String(r.title) : null,
    bodyMd: String(r.body_md),
    status: null,
    meta: r.meta != null ? JSON.parse(String(r.meta)) : null,
    scheduledStart: null,
    scheduledEnd: null,
    isAllDay: false,
    actualStart: null,
    actualEnd: null,
    scheduledOn: null,
    startTime: null,
    endDate: null,
    endTime: null,
    duration: null,
    createdAt: String(r.created_at),
    updatedAt: String(r.updated_at),
    isBookmarked: toBoolean(r.is_bookmarked as number | boolean),
    isDeleted: toBoolean(r.is_deleted as number | boolean),
    preview: r.preview ? String(r.preview) : undefined,
  };
};

const getTemplateLabels = (db: Database.Database, issueId: number): string[] => {
  const rows = db
    .prepare(
      `SELECT l.name FROM labels l JOIN issue_labels il ON il.label_id = l.id WHERE il.issue_id = @issueId ORDER BY l.name`
    )
    .all({ issueId }) as Array<{ name: string }>;
  return rows.map((row) => row.name);
};

const attachLabels = (db: Database.Database, issueId: number, labels: string[]): void => {
  const insertLabel = db.prepare(
    `INSERT OR IGNORE INTO labels(name, description, created_at) VALUES(@name, NULL, @createdAt)`
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
    `DELETE FROM issue_labels WHERE issue_id = @issueId AND label_id IN(SELECT id FROM labels WHERE name = @name)`
  );
  for (const name of labels) {
    stmt.run({ issueId, name });
  }
};

const resetProjects = (db: Database.Database, issueId: number, projectIds: number[]): void => {
  db.prepare("DELETE FROM project_items WHERE issue_id = @issueId").run({ issueId });
  if (projectIds.length === 0) return;
  const stmt = db.prepare(
    `INSERT INTO project_items(project_id, issue_id, position, view_meta, created_at, updated_at)
     VALUES(@projectId, @issueId, @position, json('{}'), @createdAt, @createdAt)
     ON CONFLICT(project_id, issue_id) DO UPDATE SET position = excluded.position, updated_at = excluded.updated_at`
  );
  const now = nowIso();
  projectIds.forEach((projectId, index) => {
    stmt.run({ projectId, issueId, position: index + 1, createdAt: now });
  });
};

export const createTemplate = (db: Database.Database, input: CreateTemplateInput): Template => {
  const now = input.createdAt ?? nowIso();
  const result = db
    .prepare(
      `INSERT INTO issues (uuid, type, title, body_md, template_target, created_at, updated_at, is_bookmarked, is_deleted)
       VALUES (@uuid, 'template', @title, @body, @target, @createdAt, @createdAt, 0, 0)`
    )
    .run({
      uuid: input.uuid ?? uuidv7(),
      title: input.title,
      body: input.bodyMd,
      target: input.templateTarget,
      createdAt: now,
    });

  const templateId = Number(result.lastInsertRowid);

  if (input.labels?.length) attachLabels(db, templateId, input.labels);
  if (input.projects?.length) resetProjects(db, templateId, input.projects);

  return getTemplate(db, templateId);
};

export const getTemplate = (db: Database.Database, id: number): Template => {
  const row = db.prepare("SELECT * FROM issues WHERE id = @id AND is_deleted = 0").get({ id });
  if (!row) throw new Error(`Template not found: ${id}`);

  const r = row as Record<string, unknown>;
  if (r.type !== "template") throw new Error(`ID refers to different type(${r.type})`);

  const template = templateRowToTemplate(row);
  template.labels = getTemplateLabels(db, id);
  return template;
};

export const listTemplates = (db: Database.Database, filters: ListTemplateFilters = {}): Template[] => {
  const conditions = ["type = 'template'", "is_deleted = 0"];
  const params: Record<string, string | number> = {};

  if (filters.target) {
    conditions.push("template_target = @target");
    params.target = filters.target;
  }
  if (filters.search) {
    conditions.push("(title LIKE @search OR body_md LIKE @search)");
    params.search = `%${filters.search}%`;
  }

  let sql = `SELECT * FROM issues WHERE ${conditions.join(" AND ")} ORDER BY created_at DESC`;
  if (filters.limit) {
    sql += " LIMIT @limit";
    params.limit = filters.limit;
  }
  if (filters.offset) {
    sql += " OFFSET @offset";
    params.offset = filters.offset;
  }

  const rows = db.prepare(sql).all(params);
  return rows.map((row) => {
    const template = templateRowToTemplate(row);
    template.labels = getTemplateLabels(db, template.id);
    return template;
  });
};

export const countTemplates = (db: Database.Database, filters: ListTemplateFilters = {}): number => {
  const conditions = ["type = 'template'", "is_deleted = 0"];
  const params: Record<string, string | number> = {};
  if (filters.target) {
    conditions.push("template_target = @target");
    params.target = filters.target;
  }
  if (filters.search) {
    conditions.push("(title LIKE @search OR body_md LIKE @search)");
    params.search = `%${filters.search}%`;
  }
  const row = db
    .prepare(`SELECT COUNT(*) as count FROM issues WHERE ${conditions.join(" AND ")}`)
    .get(params) as { count: number };
  return row.count;
};

export const updateTemplate = (db: Database.Database, id: number, input: UpdateTemplateInput): Template => {
  // Ensure the id is a template before mutating.
  getTemplate(db, id);

  const sets: string[] = [];
  const params: Record<string, unknown> = { id };
  if (input.title !== undefined) {
    sets.push("title = @title");
    params.title = input.title;
  }
  if (input.bodyMd !== undefined) {
    sets.push("body_md = @bodyMd");
    params.bodyMd = input.bodyMd;
  }
  if (input.templateTarget !== undefined) {
    sets.push("template_target = @target");
    params.target = input.templateTarget;
  }
  if (sets.length > 0) {
    sets.push("updated_at = @updatedAt");
    params.updatedAt = nowIso();
    db.prepare(`UPDATE issues SET ${sets.join(", ")} WHERE id = @id AND type = 'template'`).run(params);
  }

  // Labels: diff so unchanged labels don't churn issue_label sync tombstones.
  if (input.labels !== undefined) {
    const current = getTemplateLabels(db, id);
    const next = input.labels;
    const toRemove = current.filter((name) => !next.includes(name));
    const toAdd = next.filter((name) => !current.includes(name));
    if (toRemove.length) detachLabels(db, id, toRemove);
    if (toAdd.length) attachLabels(db, id, toAdd);
  }

  // project_items are not part of the sync change-feed, so a full reset is fine.
  if (input.projects !== undefined) {
    resetProjects(db, id, input.projects);
  }

  return getTemplate(db, id);
};

export const deleteTemplate = (db: Database.Database, id: number): void => {
  const result = db
    .prepare("UPDATE issues SET is_deleted = 1, updated_at = @updatedAt WHERE id = @id AND type = 'template'")
    .run({ id, updatedAt: nowIso() });
  if (result.changes === 0) throw new Error(`Template not found: ${id}`);
};

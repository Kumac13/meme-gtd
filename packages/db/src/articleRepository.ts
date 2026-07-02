import Database from "better-sqlite3";
import { nowIso, uuidv7, type Article, type ArticleMeta, toBoolean } from "meme-gtd-shared";

export interface CreateArticleInput {
  title: string;
  bodyMd: string;
  originalUrl: string;
  siteName?: string;
  labels?: string[];
}

export interface ListArticleFilters {
  limit?: number;
  offset?: number;
  search?: string;
}

// Helper to safely access row properties
const articleRowToArticle = (row: unknown): Article => {
  const r = row as Record<string, unknown>;
  if (!r || typeof r !== "object") throw new Error("Invalid row data");

  return {
    id: Number(r.id),
    uuid: r.uuid ? String(r.uuid) : undefined,
    serverSeq: r.server_seq != null ? Number(r.server_seq) : undefined,
    type: "article",
    title: String(r.title),
    bodyMd: String(r.body_md),
    status: null,
    meta: JSON.parse(String(r.meta)) as ArticleMeta,
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
    commentCount: Number(r.comment_count ?? 0),
    preview: r.preview ? String(r.preview) : undefined,
  };
};

export const createArticle = (db: Database.Database, input: CreateArticleInput): Article => {
  const now = nowIso();
  const meta: ArticleMeta = {
    originalUrl: input.originalUrl,
    siteName: input.siteName,
    archivedAt: now,
  };

  const stmt = db.prepare(
    `INSERT INTO issues (uuid, type, title, body_md, meta, created_at, updated_at, is_bookmarked, is_deleted)
     VALUES (@uuid, 'article', @title, @body, @meta, @createdAt, @createdAt, 0, 0)`
  );

  const result = stmt.run({
    uuid: uuidv7(),
    title: input.title,
    body: input.bodyMd,
    meta: JSON.stringify(meta),
    createdAt: now,
  });

  const articleId = Number(result.lastInsertRowid);

  if (input.labels?.length) {
    attachLabels(db, articleId, input.labels);
  }

  return getArticle(db, articleId);
};

export const getArticle = (db: Database.Database, id: number): Article => {
  const row = db
    .prepare("SELECT * FROM issues WHERE id = @id AND is_deleted = 0")
    .get({ id });

  if (!row) {
    throw new Error(`Article not found: ${id}`);
  }

  const r = row as Record<string, unknown>;
  if (r.type !== 'article') {
    throw new Error(`ID refers to different type(${r.type})`);
  }

  const article = articleRowToArticle(row);
  article.labels = getArticleLabels(db, id);
  return article;
};

export const listArticles = (db: Database.Database, filters: ListArticleFilters = {}): Article[] => {
  const conditions = ["type = 'article'", "is_deleted = 0"];
  const params: Record<string, string | number> = {};

  if (filters.search) {
    conditions.push("(title LIKE @search OR body_md LIKE @search)");
    params.search = `%${filters.search}%`;
  }

  let sql = `
    SELECT i.*,
    (SELECT COUNT(*) FROM comments c WHERE c.issue_id = i.id AND c.is_deleted = 0) as comment_count
    FROM issues i
    WHERE ${conditions.join(" AND ")}
    ORDER BY created_at DESC
  `;

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
    const article = articleRowToArticle(row);
    const r = row as Record<string, unknown>;
    article.labels = getArticleLabels(db, Number(r.id));
    return article;
  });
};

export const countArticles = (db: Database.Database, filters: ListArticleFilters = {}): number => {
  const conditions = ["type = 'article'", "is_deleted = 0"];
  const params: Record<string, string | number> = {};

  if (filters.search) {
    conditions.push("(title LIKE @search OR body_md LIKE @search)");
    params.search = `%${filters.search}%`;
  }

  const sql = `
    SELECT COUNT(*) as count
    FROM issues
    WHERE ${conditions.join(" AND ")}
  `;

  const row = db.prepare(sql).get(params) as { count: number };
  return row.count;
};

export const deleteArticle = (db: Database.Database, id: number): void => {
  const result = db
    .prepare("UPDATE issues SET is_deleted = 1, updated_at = @updatedAt WHERE id = @id AND type = 'article'")
    .run({ id, updatedAt: nowIso() });
  
  if (result.changes === 0) {
    throw new Error(`Article not found: ${id}`);
  }
};

const getArticleLabels = (db: Database.Database, articleId: number): string[] => {
  const rows = db
    .prepare(`SELECT l.name FROM labels l JOIN issue_labels il ON il.label_id = l.id WHERE il.issue_id = @articleId ORDER BY l.name`)
    .all({ articleId }) as Array<{ name: string }>;
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

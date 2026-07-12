import Database from "better-sqlite3";
import { nowIso, uuidv7, type Article, type ArticleMeta, type ArticleOrigin, toBoolean } from "meme-gtd-shared";

export interface CreateArticleInput {
  title: string;
  bodyMd: string;
  /** Present for web-saved articles; absent for manual ones. */
  originalUrl?: string;
  /** issues.origin — 'web' (saved from the web) or 'manual' (written by hand). */
  origin: ArticleOrigin;
  siteName?: string;
  labels?: string[];
  // Sync apply path (POST /api/sync/push): client-minted identity and
  // preserved offline timestamps.
  uuid?: string;
  createdAt?: string;
  archivedAt?: string;
}

export interface UpdateArticleInput {
  title?: string;
  bodyMd?: string;
}

export interface ListArticleFilters {
  limit?: number;
  offset?: number;
  search?: string;
  labels?: string[];
  projectIds?: number[];
  /** When true, include articles not assigned to any project ("none" filter, same semantics as tasks). */
  includeNoProject?: boolean;
  isBookmarked?: boolean;
  origin?: ArticleOrigin;
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
    origin: (r.origin as ArticleOrigin) ?? "web",
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
  const now = input.createdAt ?? nowIso();
  const meta: ArticleMeta = {
    originalUrl: input.originalUrl,
    siteName: input.siteName,
    archivedAt: input.archivedAt ?? now,
  };

  const stmt = db.prepare(
    `INSERT INTO issues (uuid, type, title, body_md, origin, meta, created_at, updated_at, is_bookmarked, is_deleted)
     VALUES (@uuid, 'article', @title, @body, @origin, @meta, @createdAt, @createdAt, 0, 0)`
  );

  const result = stmt.run({
    uuid: input.uuid ?? uuidv7(),
    title: input.title,
    body: input.bodyMd,
    origin: input.origin,
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

// listArticles / countArticles で共有するフィルタ条件（taskRepository と同じ流儀）
const buildArticleFilterConditions = (
  filters: ListArticleFilters,
  params: Record<string, string | number>
): string[] => {
  const conditions = ["type = 'article'", "is_deleted = 0"];

  if (filters.search) {
    conditions.push("(title LIKE @search OR body_md LIKE @search)");
    params.search = `%${filters.search}%`;
  }
  if (filters.labels && filters.labels.length > 0) {
    const placeholders = filters.labels.map((_, i) => `@label${i}`).join(", ");
    conditions.push(
      `id IN(SELECT issue_id FROM issue_labels il JOIN labels l ON l.id = il.label_id WHERE l.name IN(${placeholders}))`
    );
    filters.labels.forEach((name, i) => {
      params[`label${i}`] = name;
    });
  }
  if (filters.projectIds && filters.projectIds.length > 0) {
    const placeholders = filters.projectIds.map((_, i) => `@project${i}`).join(", ");
    if (filters.includeNoProject) {
      conditions.push(
        `(id IN(SELECT issue_id FROM project_items WHERE project_id IN(${placeholders})) OR id NOT IN(SELECT issue_id FROM project_items))`
      );
    } else {
      conditions.push(`id IN(SELECT issue_id FROM project_items WHERE project_id IN(${placeholders}))`);
    }
    filters.projectIds.forEach((id, i) => {
      params[`project${i}`] = id;
    });
  } else if (filters.includeNoProject) {
    conditions.push(`id NOT IN(SELECT issue_id FROM project_items)`);
  }
  if (filters.isBookmarked) {
    conditions.push("is_bookmarked = 1");
  }
  if (filters.origin) {
    conditions.push("origin = @origin");
    params.origin = filters.origin;
  }

  return conditions;
};

export const listArticles = (db: Database.Database, filters: ListArticleFilters = {}): Article[] => {
  const params: Record<string, string | number> = {};
  const conditions = buildArticleFilterConditions(filters, params);

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
  const params: Record<string, string | number> = {};
  const conditions = buildArticleFilterConditions(filters, params);

  const sql = `
    SELECT COUNT(*) as count
    FROM issues
    WHERE ${conditions.join(" AND ")}
  `;

  const row = db.prepare(sql).get(params) as { count: number };
  return row.count;
};

export const updateArticle = (db: Database.Database, id: number, input: UpdateArticleInput): Article => {
  // Ensure the id is an article before mutating (throws otherwise).
  getArticle(db, id);

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
  if (sets.length > 0) {
    sets.push("updated_at = @updatedAt");
    params.updatedAt = nowIso();
    db.prepare(`UPDATE issues SET ${sets.join(", ")} WHERE id = @id AND type = 'article'`).run(params);
  }

  return getArticle(db, id);
};

export const setArticleBookmark = (db: Database.Database, id: number, isBookmarked: boolean): Article => {
  const result = db
    .prepare(
      "UPDATE issues SET is_bookmarked = @flag, updated_at = @updatedAt WHERE id = @id AND type = 'article' AND is_deleted = 0"
    )
    .run({ id, flag: isBookmarked ? 1 : 0, updatedAt: nowIso() });
  if (result.changes === 0) {
    throw new Error(`Article not found: ${id}`);
  }
  return getArticle(db, id);
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

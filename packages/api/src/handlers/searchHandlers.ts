import { performance } from 'node:perf_hooks';
import type { FastifyRequest, FastifyReply } from 'fastify';
import {
  generateEmbedding,
  searchByVector,
  loadEmbeddingConfig,
  checkEmbeddingHealth,
  ActivityLogger,
  MemoService,
  TaskService,
  ArticleService,
} from 'meme-gtd-core';
import type Database from 'better-sqlite3';
import { searchByKeyword } from 'meme-gtd-db';
import type { TaskStatus } from 'meme-gtd-shared';
import type {
  SemanticSearchQuery,
  KeywordSearchQuery,
  SearchExportRequest,
} from '../schemas/searchSchemas.js';

/**
 * Upper bound on the number of items a scope="all" export resolves. Personal
 * single-user datasets stay well below this; the cap only guards against an
 * accidental unbounded copy. When exceeded, the response sets truncated=true so
 * the client can surface that the copy is incomplete (never a silent cut).
 */
const EXPORT_ALL_CAP = 5000;

/**
 * Resolve the full set of item IDs matching the export filters, ignoring
 * client pagination. Mirrors exactly the query each list view uses so the
 * exported set matches what the user sees:
 * - free-text query on memos/tasks -> keyword search (searchByKeyword)
 * - articles -> ArticleService.list (article search is LIKE on the article
 *   table, not the keyword-search endpoint)
 * - otherwise -> the type's list service with the same filters
 *
 * For the keyword path it also rebuilds the matched-comment snippets so
 * scope="all" keyword exports carry the same `matchedComment` fields the
 * loaded-range export would.
 */
function resolveAllMatchIds(
  db: Database.Database,
  type: 'memos' | 'tasks' | 'articles',
  filters: NonNullable<SearchExportRequest['filters']>
): { ids: number[]; truncated: boolean; matchedComments?: Record<string, string> } {
  const query = filters.query;
  const issueType = type === 'memos' ? 'memo' : type === 'tasks' ? 'task' : 'article';

  // Articles use LIKE search on the article table (ArticlesService.listArticles),
  // never the keyword-search endpoint, so keep them on the list path even when a
  // query is present.
  if (query && type !== 'articles') {
    const results = searchByKeyword(db, query, {
      types: [issueType],
      status: filters.status,
      labels: filters.labels,
      bookmarked: filters.bookmarked,
      limit: EXPORT_ALL_CAP + 1,
      offset: 0,
    });
    const truncated = results.length > EXPORT_ALL_CAP;
    const sliced = truncated ? results.slice(0, EXPORT_ALL_CAP) : results;
    const matchedComments: Record<string, string> = {};
    for (const r of sliced) {
      const match = r.matches.find((m) => m.field === 'comment');
      if (match) matchedComments[String(r.id)] = match.text;
    }
    return { ids: sliced.map((r) => r.id), truncated, matchedComments };
  }

  if (type === 'memos') {
    const { data, total } = new MemoService({ db }).list({
      labels: filters.labels,
      isBookmarked: filters.bookmarked,
      projectIds: filters.projectIds,
      includeNoProject: filters.includeNoProject,
      createdFrom: filters.dateFrom,
      createdTo: filters.dateTo,
      limit: EXPORT_ALL_CAP,
      offset: 0,
    });
    return { ids: data.map((d) => d.id), truncated: total > EXPORT_ALL_CAP };
  }

  if (type === 'tasks') {
    const { data, total } = new TaskService({ db }).list({
      status: filters.status as TaskStatus | undefined,
      labels: filters.labels,
      isBookmarked: filters.bookmarked,
      projectIds: filters.projectIds,
      includeNoProject: filters.includeNoProject,
      scheduledFrom: filters.dateFrom,
      scheduledTo: filters.dateTo,
      limit: EXPORT_ALL_CAP,
      offset: 0,
    });
    return { ids: data.map((d) => d.id), truncated: total > EXPORT_ALL_CAP };
  }

  const { data, total } = new ArticleService({ db }).list({
    search: query,
    limit: EXPORT_ALL_CAP,
    offset: 0,
  });
  return { ids: data.map((d) => d.id), truncated: total > EXPORT_ALL_CAP };
}

/**
 * Handle semantic search requests.
 * Generates an embedding for the query, then finds similar issues via cosine similarity.
 */
export async function semanticSearchHandler(
  request: FastifyRequest<{ Querystring: SemanticSearchQuery }>,
  reply: FastifyReply
) {
  const { q, limit, types } = request.query;
  const db = request.server.db;

  let config;
  try {
    config = loadEmbeddingConfig();
  } catch (err) {
    return reply.status(503).send({
      error: 'Embedding not configured',
      message: err instanceof Error ? err.message : String(err),
    });
  }

  const healthy = await checkEmbeddingHealth(config.baseUrl, config.apiKey);
  if (!healthy) {
    return reply.status(503).send({
      error: 'Embedding service unavailable',
      message: `Cannot connect to embedding server at ${config.baseUrl}. Ensure the server is running.`,
    });
  }

  const startTime = performance.now();

  const queryText = config.queryPrefix ? `${config.queryPrefix}${q}` : q;
  const queryEmbedding = await generateEmbedding(queryText, config);

  const typeFilter = types ? types.split(',').map((t) => t.trim()) : undefined;
  const scored = searchByVector(db, queryEmbedding, { limit, types: typeFilter });

  // Batch fetch issue details
  const issueIds = scored.map((s) => s.issueId);
  const issueMap = new Map<number, any>();
  if (issueIds.length > 0) {
    const placeholders = issueIds.map(() => '?').join(',');
    const rows = db
      .prepare(`SELECT id, type, title, body_md, status, is_bookmarked, task_kind, scheduled_on, created_at, updated_at FROM issues WHERE id IN (${placeholders})`)
      .all(...issueIds) as any[];
    for (const row of rows) {
      issueMap.set(row.id, row);
    }
  }

  // Batch fetch labels
  const labelMap = new Map<number, string[]>();
  if (issueIds.length > 0) {
    const placeholders = issueIds.map(() => '?').join(',');
    const labelRows = db
      .prepare(`SELECT il.issue_id, l.name FROM labels l JOIN issue_labels il ON il.label_id = l.id WHERE il.issue_id IN (${placeholders}) ORDER BY l.name`)
      .all(...issueIds) as any[];
    for (const l of labelRows) {
      const list = labelMap.get(l.issue_id) ?? [];
      list.push(l.name);
      labelMap.set(l.issue_id, list);
    }
  }

  // Batch fetch comment counts
  const commentCountMap = new Map<number, number>();
  if (issueIds.length > 0) {
    const placeholders = issueIds.map(() => '?').join(',');
    const countRows = db
      .prepare(`SELECT issue_id, COUNT(*) as cnt FROM comments WHERE issue_id IN (${placeholders}) GROUP BY issue_id`)
      .all(...issueIds) as any[];
    for (const r of countRows) {
      commentCountMap.set(r.issue_id, r.cnt);
    }
  }

  const results = scored
    .filter((s) => issueMap.has(s.issueId))
    .map((s) => {
      const row = issueMap.get(s.issueId)!;
      return {
        issue: {
          id: row.id,
          type: row.type,
          title: row.title,
          bodyMd: row.body_md,
          status: row.status ?? null,
          isBookmarked: row.is_bookmarked === 1,
          labels: labelMap.get(row.id) ?? [],
          commentCount: commentCountMap.get(row.id) ?? 0,
          taskKind: row.task_kind ?? null,
          scheduledOn: row.scheduled_on ?? null,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
        },
        score: s.score,
        vectorScore: s.score,
        matchReason: ['vector_similarity'],
      };
    });

  const searchTimeMs = Math.round((performance.now() - startTime) * 100) / 100;

  return reply.status(200).send({
    results,
    meta: {
      query: q,
      totalResults: results.length,
      searchTimeMs,
    },
  });
}

/**
 * Handle keyword search requests.
 * Searches issues by LIKE partial matching across title, body, and comments.
 */
export async function keywordSearchHandler(
  request: FastifyRequest<{ Querystring: KeywordSearchQuery }>,
  reply: FastifyReply
) {
  const { q, limit, offset, types, status, label, bookmarked, order } = request.query;
  const db = request.server.db;

  const typeFilter = types ? types.split(',').map((t) => t.trim()).filter(Boolean) : undefined;
  const labelFilter = label ? label.split(',').map((l) => l.trim()).filter(Boolean) : undefined;
  const results = searchByKeyword(db, q, {
    types: typeFilter,
    status,
    labels: labelFilter,
    bookmarked: bookmarked === 'true' ? true : undefined,
    order,
    limit,
    offset,
  });

  return reply.status(200).send({
    results,
    total: results.length,
    limit,
    offset,
  });
}

/**
 * Handle search export requests.
 * Takes the current view's item IDs and filter state, records a
 * `search.exported` entry in the activity log, and returns a structured JSON
 * payload that the client writes to the clipboard.
 *
 * The scope of "results" is defined by the `itemIds` the client sends — which
 * is the current page / loaded range of the list view, not all matches.
 */
export async function searchExportHandler(
  request: FastifyRequest<{ Body: SearchExportRequest }>,
  reply: FastifyReply
) {
  const db = request.server.db;
  const body = request.body;
  const { type, filters, itemIds, includeComments } = body;
  let matchedComments = body.matchedComments ?? {};
  const matchedScores = body.matchedScores ?? {};
  const scope = body.scope ?? 'loaded';

  const expectedIssueType = type === 'memos' ? 'memo' : type === 'tasks' ? 'task' : 'article';

  // Resolve which items to export. In "all" scope the server re-runs the same
  // query the list view uses (no pagination) so the copy covers every match,
  // not just the client's loaded page. Semantic search is exempt: its result
  // set is a bounded top-K ranking with no meaningful "all", so it falls back
  // to the client-provided itemIds.
  let effectiveItemIds = itemIds;
  let truncated = false;
  if (scope === 'all' && filters?.searchMode !== 'semantic') {
    const resolved = resolveAllMatchIds(db, type, filters ?? {});
    effectiveItemIds = resolved.ids;
    truncated = resolved.truncated;
    if (resolved.matchedComments) {
      matchedComments = resolved.matchedComments;
    }
  }

  // Clean filters: strip keys with undefined/null/empty values so the copied
  // JSON shows only the filters actually in effect.
  const cleanedFilters: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(filters ?? {})) {
    if (value === undefined || value === null) continue;
    if (typeof value === 'string' && value === '') continue;
    if (Array.isArray(value) && value.length === 0) continue;
    cleanedFilters[key] = value;
  }

  // Log the export event before touching item data so the record is written
  // even if a later fetch fails.
  const logger = new ActivityLogger(db, 'api');
  logger.logSearchExported(
    expectedIssueType,
    cleanedFilters,
    effectiveItemIds.length,
    includeComments
  );

  if (effectiveItemIds.length === 0) {
    return reply.status(200).send({
      type,
      total: 0,
      truncated,
      filters: cleanedFilters,
      results: [],
    });
  }

  const placeholders = effectiveItemIds.map(() => '?').join(',');

  // Batch fetch issues. We filter by type at the SQL level so callers can't
  // mix types in one export request.
  const issueRows = db
    .prepare(
      `SELECT id, type, title, body_md, status, is_bookmarked, scheduled_on, meta, created_at, updated_at
       FROM issues
       WHERE id IN (${placeholders}) AND type = ? AND is_deleted = 0`
    )
    .all(...effectiveItemIds, expectedIssueType) as Array<{
      id: number;
      type: string;
      title: string | null;
      body_md: string;
      status: string | null;
      is_bookmarked: number;
      scheduled_on: string | null;
      meta: string | null;
      created_at: string;
      updated_at: string;
    }>;

  const foundIds = new Set(issueRows.map((r) => r.id));

  // Batch fetch labels for all found items
  const labelMap = new Map<number, string[]>();
  if (issueRows.length > 0) {
    const labelPlaceholders = issueRows.map(() => '?').join(',');
    const labelRows = db
      .prepare(
        `SELECT il.issue_id, l.name
         FROM labels l
         JOIN issue_labels il ON il.label_id = l.id
         WHERE il.issue_id IN (${labelPlaceholders})
         ORDER BY l.name`
      )
      .all(...issueRows.map((r) => r.id)) as Array<{ issue_id: number; name: string }>;
    for (const row of labelRows) {
      const list = labelMap.get(row.issue_id) ?? [];
      list.push(row.name);
      labelMap.set(row.issue_id, list);
    }
  }

  // Batch fetch comments when requested
  const commentsMap = new Map<
    number,
    Array<{ id: number; bodyMd: string; createdAt: string; updatedAt: string }>
  >();
  if (includeComments && issueRows.length > 0) {
    const commentPlaceholders = issueRows.map(() => '?').join(',');
    const commentRows = db
      .prepare(
        `SELECT id, issue_id, body_md, created_at, updated_at
         FROM comments
         WHERE issue_id IN (${commentPlaceholders}) AND is_deleted = 0
         ORDER BY created_at ASC`
      )
      .all(...issueRows.map((r) => r.id)) as Array<{
        id: number;
        issue_id: number;
        body_md: string;
        created_at: string;
        updated_at: string;
      }>;
    for (const row of commentRows) {
      const list = commentsMap.get(row.issue_id) ?? [];
      list.push({
        id: row.id,
        bodyMd: row.body_md,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      });
      commentsMap.set(row.issue_id, list);
    }
  }

  // Preserve the resolved order (client display order for "loaded", list sort
  // order for "all") so the exported results read top-to-bottom as shown.
  const orderedRows = effectiveItemIds
    .filter((id) => foundIds.has(id))
    .map((id) => issueRows.find((r) => r.id === id)!);

  const results = orderedRows.map((row) => {
    const labels = labelMap.get(row.id) ?? [];
    const comments = includeComments ? commentsMap.get(row.id) ?? [] : undefined;
    const matchedComment = matchedComments[String(row.id)];
    const matchedScore = matchedScores[String(row.id)];

    if (expectedIssueType === 'memo') {
      return {
        id: row.id,
        type: 'memo' as const,
        bodyMd: row.body_md,
        labels,
        isBookmarked: row.is_bookmarked === 1,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        ...(matchedComment ? { matchedComment } : {}),
        ...(matchedScore !== undefined ? { matchedScore } : {}),
        ...(comments ? { comments } : {}),
      };
    }

    if (expectedIssueType === 'task') {
      return {
        id: row.id,
        type: 'task' as const,
        title: row.title,
        bodyMd: row.body_md,
        status: row.status,
        scheduledOn: row.scheduled_on,
        labels,
        isBookmarked: row.is_bookmarked === 1,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        ...(matchedComment ? { matchedComment } : {}),
        ...(matchedScore !== undefined ? { matchedScore } : {}),
        ...(comments ? { comments } : {}),
      };
    }

    // article
    let url: string | null = null;
    if (row.meta) {
      try {
        const meta = JSON.parse(row.meta) as { originalUrl?: string };
        url = meta.originalUrl ?? null;
      } catch {
        url = null;
      }
    }

    return {
      id: row.id,
      type: 'article' as const,
      title: row.title,
      url,
      bodyMd: row.body_md,
      labels,
      isBookmarked: row.is_bookmarked === 1,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      ...(matchedComment ? { matchedComment } : {}),
      ...(matchedScore !== undefined ? { matchedScore } : {}),
      ...(comments ? { comments } : {}),
    };
  });

  return reply.status(200).send({
    type,
    total: results.length,
    truncated,
    filters: cleanedFilters,
    results,
  });
}

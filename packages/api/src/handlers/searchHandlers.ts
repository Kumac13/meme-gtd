import { performance } from 'node:perf_hooks';
import type { FastifyRequest, FastifyReply } from 'fastify';
import {
  generateEmbedding,
  searchByVector,
  loadEmbeddingConfig,
  checkEmbeddingHealth,
} from 'meme-gtd-core';
import { searchByKeyword } from 'meme-gtd-db';
import type { SemanticSearchQuery, KeywordSearchQuery } from '../schemas/searchSchemas.js';

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

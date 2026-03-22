import { performance } from 'node:perf_hooks';
import type { FastifyRequest, FastifyReply } from 'fastify';
import {
  generateEmbedding,
  searchByVector,
  formatQueryText,
  DEFAULT_EMBEDDING_CONFIG,
  checkOllamaHealth,
} from 'meme-gtd-core';
import type { SemanticSearchQuery } from '../schemas/searchSchemas.js';

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

  const config = {
    baseUrl: process.env.OLLAMA_URL ?? DEFAULT_EMBEDDING_CONFIG.baseUrl,
    model: process.env.EMBEDDING_MODEL ?? DEFAULT_EMBEDDING_CONFIG.model,
  };

  const healthy = await checkOllamaHealth(config.baseUrl);
  if (!healthy) {
    return reply.status(503).send({
      error: 'Ollama service unavailable',
      message: `Cannot connect to Ollama at ${config.baseUrl}. Ensure Ollama is running.`,
    });
  }

  const startTime = performance.now();

  const queryText = formatQueryText(q);
  const queryEmbedding = await generateEmbedding(queryText, config);

  const typeFilter = types ? types.split(',').map((t) => t.trim()) : undefined;
  const scored = searchByVector(db, queryEmbedding, { limit, types: typeFilter });

  // Fetch issue details for results
  const results = scored.map((s) => {
    const row = db
      .prepare('SELECT id, type, title, body_md, created_at, updated_at FROM issues WHERE id = ?')
      .get(s.issueId) as any;

    return {
      issue: {
        id: row.id,
        type: row.type,
        title: row.title,
        bodyMd: row.body_md,
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

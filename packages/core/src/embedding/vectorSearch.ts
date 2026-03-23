import type Database from 'better-sqlite3';
import { getAllEmbeddings, type EmbeddingWithIssue } from 'meme-gtd-db';

export interface ScoredIssue {
  issueId: number;
  issueType: string;
  score: number;
}

/**
 * Compute cosine similarity between two Float32Arrays
 */
export const cosineSimilarity = (a: Float32Array, b: Float32Array): number => {
  if (a.length !== b.length) {
    throw new Error(`Dimension mismatch: ${a.length} vs ${b.length}`);
  }
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  if (denom === 0) return 0;
  return dot / denom;
};

/**
 * Convert a Buffer (BLOB from SQLite) to Float32Array
 */
export const bufferToFloat32Array = (buf: Buffer): Float32Array => {
  return new Float32Array(buf.buffer, buf.byteOffset, buf.byteLength / 4);
};

export interface VectorSearchOptions {
  limit: number;
  types?: string[];
}

/**
 * Search for similar issues by vector similarity.
 * Loads all embeddings into memory and computes cosine similarity in JS.
 * This is efficient for small datasets (~1,200 issues).
 */
export const searchByVector = (
  db: Database.Database,
  queryEmbedding: Float32Array,
  options: VectorSearchOptions
): ScoredIssue[] => {
  const allEmbeddings = getAllEmbeddings(db);

  const scored: ScoredIssue[] = [];
  for (const row of allEmbeddings) {
    if (options.types && !options.types.includes(row.issueType)) {
      continue;
    }
    const embedding = bufferToFloat32Array(row.embedding);
    const score = cosineSimilarity(queryEmbedding, embedding);
    scored.push({ issueId: row.issueId, issueType: row.issueType, score });
  }

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, options.limit);
};

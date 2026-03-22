import { createHash } from 'node:crypto';
import type Database from 'better-sqlite3';
import {
  upsertEmbedding,
  listUnembeddedIssues,
  listEmbeddingHashes,
  type UnembeddedIssue,
} from 'meme-gtd-db';
import {
  generateEmbedding,
  generateEmbeddings,
  checkOllamaHealth,
  type EmbeddingClientConfig,
} from './embeddingClient.js';

export interface SyncOptions {
  config: EmbeddingClientConfig;
  onProgress?: (current: number, total: number) => void;
}

export interface SyncResult {
  created: number;
  updated: number;
  skipped: number;
  total: number;
}

/**
 * Compute SHA-256 content hash for an issue's text content.
 * Used to detect when issue content has changed and re-embedding is needed.
 */
export const computeContentHash = (title: string | null, bodyMd: string): string => {
  const text = title ? `${title}\n${bodyMd}` : bodyMd;
  return createHash('sha256').update(text).digest('hex');
};

/**
 * Format text for embedding generation.
 * For document indexing, text is passed as-is.
 */
export const formatDocumentText = (title: string | null, bodyMd: string): string => {
  return title ? `${title}\n${bodyMd}` : bodyMd;
};

/**
 * Format query text with instruction prefix for Qwen3-Embedding.
 * Instruction-aware models benefit from query-side prefixing.
 */
export const formatQueryText = (query: string): string => {
  return `Instruct: Given a search query, retrieve relevant documents\nQuery: ${query}`;
};

/**
 * Convert Float32Array to Buffer for SQLite BLOB storage
 */
const float32ArrayToBuffer = (arr: Float32Array): Buffer => {
  return Buffer.from(arr.buffer, arr.byteOffset, arr.byteLength);
};

/**
 * Sync all issue embeddings: generate for new/changed/model-changed issues.
 */
export const syncEmbeddings = async (
  db: Database.Database,
  options: SyncOptions
): Promise<SyncResult> => {
  const { config, onProgress } = options;

  const healthy = await checkOllamaHealth(config.baseUrl);
  if (!healthy) {
    throw new Error(
      `Cannot connect to Ollama at ${config.baseUrl}. ` +
      `Ensure Ollama is running (ollama serve) and the model is pulled (ollama pull ${config.model}).`
    );
  }

  // Step 1: Get issues that have no embedding or wrong model
  const unembedded = listUnembeddedIssues(db, config.model);

  // Step 2: Get issues where content hash is stale
  const existingHashes = listEmbeddingHashes(db);
  const hashMap = new Map(existingHashes.map((h) => [h.issueId, h.contentHash]));

  // Find issues that have embeddings but stale content
  const staleIssueIds = new Set<number>();
  const allIssuesStmt = db.prepare(`
    SELECT id, type, title, body_md
    FROM issues
    WHERE is_deleted = 0
    ORDER BY id ASC
  `);
  const allIssues = allIssuesStmt.all() as any[];
  for (const row of allIssues) {
    const existingHash = hashMap.get(row.id);
    if (existingHash) {
      const currentHash = computeContentHash(row.title, row.body_md);
      if (existingHash !== currentHash) {
        staleIssueIds.add(row.id);
      }
    }
  }

  // Merge: unembedded + stale (deduplicate)
  const unembeddedIds = new Set(unembedded.map((i) => i.id));
  const staleNotAlreadyListed: UnembeddedIssue[] = allIssues
    .filter((row: any) => staleIssueIds.has(row.id) && !unembeddedIds.has(row.id))
    .map((row: any) => ({
      id: row.id,
      type: row.type,
      title: row.title,
      bodyMd: row.body_md,
    }));
  const toProcess = [...unembedded, ...staleNotAlreadyListed];

  const result: SyncResult = {
    created: 0,
    updated: 0,
    skipped: 0,
    total: toProcess.length,
  };

  // Process in batches for efficiency
  const BATCH_SIZE = 50;
  for (let batchStart = 0; batchStart < toProcess.length; batchStart += BATCH_SIZE) {
    const batch = toProcess.slice(batchStart, batchStart + BATCH_SIZE);
    const texts = batch.map((issue) => formatDocumentText(issue.title, issue.bodyMd));
    const hashes = batch.map((issue) => computeContentHash(issue.title, issue.bodyMd));

    onProgress?.(Math.min(batchStart + BATCH_SIZE, toProcess.length), toProcess.length);

    const embeddings = await generateEmbeddings(texts, config);

    for (let j = 0; j < batch.length; j++) {
      const issue = batch[j];
      const buf = float32ArrayToBuffer(embeddings[j]);
      const isNew = !hashMap.has(issue.id);

      upsertEmbedding(db, issue.id, buf, config.model, embeddings[j].length, hashes[j]);

      if (isNew) {
        result.created++;
      } else {
        result.updated++;
      }
    }
  }

  return result;
};

/**
 * Generate/update embedding for a single issue
 */
export const updateSingleEmbedding = async (
  db: Database.Database,
  issueId: number,
  config: EmbeddingClientConfig
): Promise<void> => {
  const stmt = db.prepare('SELECT title, body_md FROM issues WHERE id = @issueId AND is_deleted = 0');
  const row = stmt.get({ issueId }) as { title: string | null; body_md: string } | undefined;
  if (!row) {
    throw new Error(`Issue #${issueId} not found or deleted`);
  }

  const text = formatDocumentText(row.title, row.body_md);
  const contentHash = computeContentHash(row.title, row.body_md);
  const embedding = await generateEmbedding(text, config);
  const buf = float32ArrayToBuffer(embedding);

  upsertEmbedding(db, issueId, buf, config.model, embedding.length, contentHash);
};

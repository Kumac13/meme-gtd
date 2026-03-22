import Database from 'better-sqlite3';

export interface EmbeddingRow {
  issueId: number;
  embedding: Buffer;
  model: string;
  dimensions: number;
  contentHash: string;
  createdAt: string;
  updatedAt: string;
}

export interface EmbeddingWithIssue {
  issueId: number;
  embedding: Buffer;
  issueType: string;
}

export interface UnembeddedIssue {
  id: number;
  type: string;
  title: string | null;
  bodyMd: string;
}

const rowToEmbedding = (row: any): EmbeddingRow => ({
  issueId: row.issue_id,
  embedding: row.embedding,
  model: row.model,
  dimensions: row.dimensions,
  contentHash: row.content_hash,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

/**
 * Insert or update an embedding for an issue
 */
export const upsertEmbedding = (
  db: Database.Database,
  issueId: number,
  embedding: Buffer,
  model: string,
  dimensions: number,
  contentHash: string
): void => {
  const now = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
  const stmt = db.prepare(`
    INSERT INTO issue_embeddings (issue_id, embedding, model, dimensions, content_hash, created_at, updated_at)
    VALUES (@issueId, @embedding, @model, @dimensions, @contentHash, @now, @now)
    ON CONFLICT(issue_id) DO UPDATE SET
      embedding = @embedding,
      model = @model,
      dimensions = @dimensions,
      content_hash = @contentHash,
      updated_at = @now
  `);
  stmt.run({ issueId, embedding, model, dimensions, contentHash, now });
};

/**
 * Get embedding for a specific issue
 */
export const getEmbedding = (
  db: Database.Database,
  issueId: number
): EmbeddingRow | null => {
  const stmt = db.prepare('SELECT * FROM issue_embeddings WHERE issue_id = @issueId');
  const row = stmt.get({ issueId }) as any | undefined;
  return row ? rowToEmbedding(row) : null;
};

/**
 * Get all embeddings with issue type info (for KNN search)
 */
export const getAllEmbeddings = (
  db: Database.Database
): EmbeddingWithIssue[] => {
  const stmt = db.prepare(`
    SELECT e.issue_id, e.embedding, i.type as issue_type
    FROM issue_embeddings e
    JOIN issues i ON e.issue_id = i.id
    WHERE i.is_deleted = 0
  `);
  const rows = stmt.all() as any[];
  return rows.map((row) => ({
    issueId: row.issue_id,
    embedding: row.embedding,
    issueType: row.issue_type,
  }));
};

/**
 * Delete embedding for a specific issue
 */
export const deleteEmbedding = (
  db: Database.Database,
  issueId: number
): void => {
  const stmt = db.prepare('DELETE FROM issue_embeddings WHERE issue_id = @issueId');
  stmt.run({ issueId });
};

/**
 * List issues that need embedding generation:
 * - No embedding exists
 * - Model has changed (different model requested)
 *
 * Content hash change detection is handled at the service layer
 * since SHA-256 hashing is done in JS, not SQL.
 */
export const listUnembeddedIssues = (
  db: Database.Database,
  currentModel: string
): UnembeddedIssue[] => {
  const stmt = db.prepare(`
    SELECT i.id, i.type, i.title, i.body_md
    FROM issues i
    LEFT JOIN issue_embeddings e ON i.id = e.issue_id
    WHERE i.is_deleted = 0
      AND (
        e.issue_id IS NULL
        OR e.model != @currentModel
      )
    ORDER BY i.id ASC
  `);
  const rows = stmt.all({ currentModel }) as any[];
  return rows.map((row) => ({
    id: row.id,
    type: row.type,
    title: row.title,
    bodyMd: row.body_md,
  }));
};

/**
 * List all issues with their current embedding content_hash for staleness detection.
 * Service layer compares these hashes with freshly computed SHA-256 to find stale entries.
 */
export const listEmbeddingHashes = (
  db: Database.Database
): Array<{ issueId: number; contentHash: string }> => {
  const stmt = db.prepare(`
    SELECT e.issue_id, e.content_hash
    FROM issue_embeddings e
    JOIN issues i ON e.issue_id = i.id
    WHERE i.is_deleted = 0
  `);
  const rows = stmt.all() as any[];
  return rows.map((row) => ({
    issueId: row.issue_id,
    contentHash: row.content_hash,
  }));
};

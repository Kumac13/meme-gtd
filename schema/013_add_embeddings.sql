-- Add embeddings table for semantic vector search (Graph RAG Phase 1)
-- Stores pre-computed embeddings as BLOBs for cosine similarity search

CREATE TABLE IF NOT EXISTS issue_embeddings (
    issue_id INTEGER PRIMARY KEY,
    embedding BLOB NOT NULL,
    model TEXT NOT NULL,
    dimensions INTEGER NOT NULL,
    content_hash TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
    FOREIGN KEY (issue_id) REFERENCES issues(id) ON DELETE CASCADE
);

INSERT OR REPLACE INTO schema_migrations (version) VALUES ('013_add_embeddings');

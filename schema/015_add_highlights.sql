-- Migration: 015_add_highlights
-- Purpose: Article highlights (text markings on article body).
--   A highlight anchors to a range of an article's body using a W3C
--   TextQuoteSelector (exact + prefix/suffix context). The article body is an
--   immutable snapshot, so the quote alone is a robust anchor (no character
--   offsets / normalized-text projection needed). `exact` doubles as the text
--   used for Copy and the bottom-of-article comment timeline quote.
--   Comments attach to a highlight via comments.highlight_id (added in 016).
-- Sync: uuid / server_seq mirror the issues/comments pattern from 014; the
--   stamping triggers below are the same shape (SQLite triggers cover the CLI
--   write path that bypasses the API). No backfill needed (new table).
-- Note: this file contains no ALTER TABLE ADD COLUMN, so table + triggers may
--   live together (see schema/CLAUDE.md).

CREATE TABLE IF NOT EXISTS highlights (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    uuid TEXT,
    server_seq INTEGER,
    issue_id INTEGER NOT NULL,
    exact TEXT NOT NULL,
    prefix TEXT,
    suffix TEXT,
    color TEXT NOT NULL DEFAULT 'green',
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
    is_deleted INTEGER NOT NULL DEFAULT 0,
    FOREIGN KEY (issue_id) REFERENCES issues(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_highlights_issue_id ON highlights(issue_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_highlights_uuid ON highlights(uuid);
CREATE INDEX IF NOT EXISTS idx_highlights_server_seq ON highlights(server_seq);

-- Stamping triggers (same shape as 014's issues/comments triggers).
-- The stamp UPDATE only touches server_seq/uuid, which are excluded from the
-- AFTER UPDATE OF column list, so the trigger never re-fires itself.
CREATE TRIGGER IF NOT EXISTS highlights_sync_ai AFTER INSERT ON highlights
BEGIN
    UPDATE sync_sequence SET seq = seq + 1 WHERE id = 1;
    UPDATE highlights SET
        server_seq = (SELECT seq FROM sync_sequence WHERE id = 1),
        uuid = COALESCE(NEW.uuid, lower(
            hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' ||
            substr(hex(randomblob(2)), 2) || '-' ||
            substr('89ab', (abs(random()) % 4) + 1, 1) ||
            substr(hex(randomblob(2)), 2) || '-' || hex(randomblob(6))
        ))
    WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS highlights_sync_au AFTER UPDATE OF
    issue_id, exact, prefix, suffix, color, updated_at, is_deleted
ON highlights
BEGIN
    UPDATE sync_sequence SET seq = seq + 1 WHERE id = 1;
    UPDATE highlights SET server_seq = (SELECT seq FROM sync_sequence WHERE id = 1)
    WHERE id = NEW.id;
END;

INSERT OR REPLACE INTO schema_migrations (version) VALUES ('015_add_highlights');

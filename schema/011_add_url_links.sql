-- Migration: Add url_links table for external URL links
-- This table stores URLs attached to issues (tasks/memos/articles)
-- Separate from links table which handles issue-to-issue relationships

CREATE TABLE IF NOT EXISTS url_links (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    issue_id INTEGER NOT NULL,
    url TEXT NOT NULL,
    title TEXT,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
    FOREIGN KEY (issue_id) REFERENCES issues(id) ON DELETE CASCADE
);

-- Index for faster lookups by issue_id
CREATE INDEX IF NOT EXISTS idx_url_links_issue_id ON url_links(issue_id);

-- Record migration
INSERT OR REPLACE INTO schema_migrations (version) VALUES ('011_add_url_links');

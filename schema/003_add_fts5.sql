-- Add Full-Text Search (FTS5) for issues
-- This migration adds FTS5 virtual table and triggers for full-text search on tasks and memos

-- Drop existing FTS table if it exists to ensure clean state
DROP TABLE IF EXISTS issues_fts;

-- Create FTS5 virtual table
CREATE VIRTUAL TABLE issues_fts
USING fts5(
    issue_id UNINDEXED,
    title,
    body_md,
    tokenize = 'unicode61'
);

-- Populate FTS5 table with existing data
INSERT INTO issues_fts(issue_id, title, body_md)
SELECT id, COALESCE(title, ''), body_md
FROM issues;

-- Drop existing triggers to ensure they are recreated with correct logic
DROP TRIGGER IF EXISTS issues_ai;
DROP TRIGGER IF EXISTS issues_ad;
DROP TRIGGER IF EXISTS issues_au;

-- Trigger: After INSERT on issues
CREATE TRIGGER issues_ai AFTER INSERT ON issues
BEGIN
    INSERT INTO issues_fts(issue_id, title, body_md)
    VALUES (NEW.id, COALESCE(NEW.title, ''), NEW.body_md);
END;

-- Trigger: After DELETE on issues
CREATE TRIGGER issues_ad AFTER DELETE ON issues
BEGIN
    DELETE FROM issues_fts WHERE issue_id = OLD.id;
END;

-- Trigger: After UPDATE on issues (title or body_md changed)
CREATE TRIGGER issues_au AFTER UPDATE OF title, body_md ON issues
BEGIN
    UPDATE issues_fts
    SET title = COALESCE(NEW.title, ''),
        body_md = NEW.body_md
    WHERE issue_id = NEW.id;
END;

INSERT OR REPLACE INTO schema_migrations (version) VALUES ('003_add_fts5');

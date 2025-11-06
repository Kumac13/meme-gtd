-- Add Full-Text Search (FTS5) for issues
-- This migration adds FTS5 virtual table and triggers for full-text search on tasks and memos

-- Create FTS5 virtual table
CREATE VIRTUAL TABLE IF NOT EXISTS issues_fts
USING fts5(
    issue_id UNINDEXED,
    title,
    body_md,
    tokenize = 'unicode61'
);

-- Populate FTS5 table with existing data
INSERT INTO issues_fts(issue_id, title, body_md)
SELECT id, COALESCE(title, ''), body_md
FROM issues
WHERE is_deleted = 0;

-- Trigger: After INSERT on issues
CREATE TRIGGER IF NOT EXISTS issues_ai AFTER INSERT ON issues
BEGIN
    INSERT INTO issues_fts(issue_id, title, body_md)
    VALUES (NEW.id, COALESCE(NEW.title, ''), NEW.body_md);
END;

-- Trigger: After DELETE on issues
CREATE TRIGGER IF NOT EXISTS issues_ad AFTER DELETE ON issues
BEGIN
    DELETE FROM issues_fts WHERE issue_id = OLD.id;
END;

-- Trigger: After UPDATE on issues (title or body_md changed)
CREATE TRIGGER IF NOT EXISTS issues_au AFTER UPDATE ON issues
WHEN OLD.title IS NOT NEW.title OR OLD.body_md IS NOT NEW.body_md
BEGIN
    UPDATE issues_fts
    SET title = COALESCE(NEW.title, ''),
        body_md = NEW.body_md
    WHERE issue_id = NEW.id;
END;

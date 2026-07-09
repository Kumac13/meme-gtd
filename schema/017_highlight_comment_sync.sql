-- Migration: 017_highlight_comment_sync
-- Purpose: Finish wiring comments.highlight_id (added in 016) into sync + queries.
--   * Recreate comments_sync_au so it also bumps server_seq when highlight_id
--     changes. The 014 trigger enumerates columns in AFTER UPDATE OF; a column
--     not listed there would not advance server_seq, so offline clients would
--     never learn about a comment's highlight association (schema/CLAUDE.md).
--   * Index comments(highlight_id) for listing a highlight's comments.

DROP TRIGGER IF EXISTS comments_sync_au;
CREATE TRIGGER IF NOT EXISTS comments_sync_au AFTER UPDATE OF
    issue_id, highlight_id, body_md, updated_at, is_deleted
ON comments
BEGIN
    UPDATE sync_sequence SET seq = seq + 1 WHERE id = 1;
    UPDATE comments SET server_seq = (SELECT seq FROM sync_sequence WHERE id = 1)
    WHERE id = NEW.id;
END;

CREATE INDEX IF NOT EXISTS idx_comments_highlight_id ON comments(highlight_id);

INSERT OR REPLACE INTO schema_migrations (version) VALUES ('017_highlight_comment_sync');

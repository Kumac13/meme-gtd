-- Migration: 016_add_comment_highlight_id
-- Purpose: Associate a comment with an article highlight.
--   Existing memo/task comments keep highlight_id NULL; article comments set it
--   to the highlight they annotate. Reusing the comments table gives article
--   highlight comments the existing revision history, #id mention rewriting,
--   sync, activity log, and three-dot menu UI for free.
-- Note: ADD COLUMN only (no other DDL / backfill), per schema/CLAUDE.md — the
--   comments_sync_au trigger is recreated separately in 017 so it also stamps
--   server_seq when highlight_id changes.

ALTER TABLE comments ADD COLUMN highlight_id INTEGER REFERENCES highlights(id) ON DELETE CASCADE;

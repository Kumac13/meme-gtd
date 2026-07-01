-- Restore calendar datetime indexes lost in migration 010
-- Migration 010 rebuilt the issues table (DROP TABLE + RENAME) and recreated
-- the FTS triggers, but did not recreate the indexes added by migration 007.
-- Any database migrated past 010 therefore lost:
--   idx_issues_scheduled_start / idx_issues_scheduled_end / idx_issues_actual_start
-- which makes calendar date-range queries fall back to full table scans.

CREATE INDEX IF NOT EXISTS idx_issues_scheduled_start ON issues(scheduled_start);
CREATE INDEX IF NOT EXISTS idx_issues_scheduled_end ON issues(scheduled_end);
CREATE INDEX IF NOT EXISTS idx_issues_actual_start ON issues(actual_start);

INSERT OR REPLACE INTO schema_migrations (version) VALUES ('014_restore_calendar_indexes');

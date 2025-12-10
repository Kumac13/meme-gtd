-- Migration: 009_activity_log_immutability
-- Purpose: Enforce append-only constraint on activity_log table (FR-003)

-- Trigger to prevent UPDATE on activity_log
CREATE TRIGGER IF NOT EXISTS activity_log_no_update
BEFORE UPDATE ON activity_log
BEGIN
    SELECT RAISE(ABORT, 'activity_log is append-only: UPDATE not allowed');
END;

-- Trigger to prevent DELETE on activity_log
CREATE TRIGGER IF NOT EXISTS activity_log_no_delete
BEFORE DELETE ON activity_log
BEGIN
    SELECT RAISE(ABORT, 'activity_log is append-only: DELETE not allowed');
END;

INSERT OR REPLACE INTO schema_migrations (version) VALUES ('009_activity_log_immutability');

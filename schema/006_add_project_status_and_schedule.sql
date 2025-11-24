-- Migration: 006_add_project_status_and_schedule
-- Adds lifecycle status and schedule dates to projects

ALTER TABLE projects ADD COLUMN status TEXT NOT NULL DEFAULT 'planned' CHECK (status IN ('planned','active','paused','done','canceled'));
ALTER TABLE projects ADD COLUMN start_date TEXT;
ALTER TABLE projects ADD COLUMN end_date TEXT;

-- Enforce start_date <= end_date when both are provided
CREATE TRIGGER IF NOT EXISTS trg_projects_start_end_check_update
AFTER UPDATE ON projects
WHEN NEW.start_date IS NOT NULL AND NEW.end_date IS NOT NULL
BEGIN
  SELECT CASE WHEN NEW.start_date > NEW.end_date THEN RAISE(ABORT, 'start_date must be <= end_date') END;
END;

CREATE TRIGGER IF NOT EXISTS trg_projects_start_end_check_insert
AFTER INSERT ON projects
WHEN NEW.start_date IS NOT NULL AND NEW.end_date IS NOT NULL
BEGIN
  SELECT CASE WHEN NEW.start_date > NEW.end_date THEN RAISE(ABORT, 'start_date must be <= end_date') END;
END;

INSERT OR REPLACE INTO schema_migrations (version) VALUES ('006_add_project_status_and_schedule');

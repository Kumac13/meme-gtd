-- Migration: 004_add_task_time_fields
-- Add start_time, end_time, and duration columns to issues table

ALTER TABLE issues ADD COLUMN start_time TEXT;
ALTER TABLE issues ADD COLUMN end_time TEXT;
ALTER TABLE issues ADD COLUMN duration INTEGER;

INSERT OR REPLACE INTO schema_migrations (version) VALUES ('004_add_task_time_fields');

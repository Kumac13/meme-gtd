-- Migration: Add view_meta column to projects table
-- Date: 2025-10-24
-- Feature: Project Management (Issue #19)

PRAGMA foreign_keys = ON;

-- Add view_meta column to projects table
ALTER TABLE projects ADD COLUMN view_meta TEXT;

-- Insert migration record
INSERT OR REPLACE INTO schema_migrations (version) VALUES ('002_add_project_view_meta');

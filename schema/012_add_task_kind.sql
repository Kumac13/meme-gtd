-- Add task_kind column to support event/action distinction
-- Default: 'action' (most existing tasks are actionable items)
-- 'event' for time-bound calendar events like meetings

ALTER TABLE issues ADD COLUMN task_kind TEXT DEFAULT 'action'
  CHECK (task_kind IN ('event', 'action'));

-- Migrate existing data: label='mtg' → event
UPDATE issues
SET task_kind = 'event'
WHERE type = 'task'
  AND id IN (
    SELECT issue_id FROM issue_labels il
    JOIN labels l ON l.id = il.label_id
    WHERE l.name = 'mtg'
  );

-- Create index for efficient filtering by task_kind
CREATE INDEX idx_issues_task_kind ON issues(task_kind) WHERE type = 'task';

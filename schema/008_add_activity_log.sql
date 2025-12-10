-- Migration: 008_add_activity_log
-- Purpose: Event sourcing style activity log for tracking all user actions

CREATE TABLE IF NOT EXISTS activity_log (
    -- 固定カラム（全イベント共通メタデータ）
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_type TEXT NOT NULL,
    occurred_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    source_type TEXT NOT NULL CHECK (source_type IN ('cli', 'api', 'system')),
    payload TEXT NOT NULL DEFAULT '{}',

    -- Generated Columns（検索用仮想カラム）
    issue_id INTEGER GENERATED ALWAYS AS (json_extract(payload, '$.issue_id')) VIRTUAL,
    project_id INTEGER GENERATED ALWAYS AS (json_extract(payload, '$.project_id')) VIRTUAL,
    label_id INTEGER GENERATED ALWAYS AS (json_extract(payload, '$.label_id')) VIRTUAL,
    link_id INTEGER GENERATED ALWAYS AS (json_extract(payload, '$.link_id')) VIRTUAL,
    comment_id INTEGER GENERATED ALWAYS AS (json_extract(payload, '$.comment_id')) VIRTUAL
);

-- インデックス
CREATE INDEX IF NOT EXISTS idx_activity_log_occurred_at ON activity_log(occurred_at);
CREATE INDEX IF NOT EXISTS idx_activity_log_event_type ON activity_log(event_type);
CREATE INDEX IF NOT EXISTS idx_activity_log_source_type ON activity_log(source_type);
CREATE INDEX IF NOT EXISTS idx_activity_log_issue_id ON activity_log(issue_id) WHERE issue_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_activity_log_project_id ON activity_log(project_id) WHERE project_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_activity_log_label_id ON activity_log(label_id) WHERE label_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_activity_log_link_id ON activity_log(link_id) WHERE link_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_activity_log_comment_id ON activity_log(comment_id) WHERE comment_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_activity_log_issue_timeline ON activity_log(issue_id, occurred_at) WHERE issue_id IS NOT NULL;

INSERT OR REPLACE INTO schema_migrations (version) VALUES ('008_add_activity_log');

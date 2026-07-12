-- Migration: 015_add_template_issue_type
-- Purpose: Introduce the 'template' issue type and a template_target column.
--   * type CHECK gains 'template' (templates are stored as issues, reusing
--     labels/projects/body/sync machinery). Changing a CHECK constraint requires
--     rebuilding the table (SQLite has no ALTER for CHECK) — same pattern as 010.
--   * template_target ('task'|'article') records what a template produces, chosen
--     at template creation. NULL for non-template rows.
-- The rebuild must carry every column added through 014 (task_kind from 012,
-- uuid/server_seq from 014) and re-create every index and trigger on issues
-- (dropped together with the old table): FTS triggers (issues_ai/ad/au) and the
-- 014 sync triggers (issues_sync_ai/au). template_target is added to the
-- issues_sync_au column list so template edits stamp server_seq and reach iOS.

PRAGMA foreign_keys=OFF;
-- legacy_alter_table=ON stops the RENAME below from re-parsing triggers/views on
-- OTHER tables that reference `issues` (e.g. 014's issue_labels_sync_ad, which
-- reads `issues` in its body). Without this, the rename re-analyzes that trigger
-- while `issues` is transiently absent and fails ("no such table: main.issues").
-- 010 avoided this only because those sync triggers did not exist yet.
PRAGMA legacy_alter_table=ON;

CREATE TABLE IF NOT EXISTS issues_new (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    type TEXT NOT NULL CHECK (type IN ('memo', 'task', 'article', 'template')),
    title TEXT,
    body_md TEXT NOT NULL,
    status TEXT,
    scheduled_on TEXT,
    meta TEXT,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
    is_bookmarked INTEGER NOT NULL DEFAULT 0,
    is_deleted INTEGER NOT NULL DEFAULT 0,
    -- Columns from 004
    start_time TEXT,
    end_time TEXT,
    duration INTEGER,
    -- Columns from 005
    end_date TEXT,
    -- Columns from 006/007
    scheduled_start TEXT,
    scheduled_end TEXT,
    is_all_day INTEGER NOT NULL DEFAULT 0,
    actual_start TEXT,
    actual_end TEXT,
    -- Column from 012
    task_kind TEXT DEFAULT 'action' CHECK (task_kind IN ('event', 'action')),
    -- Columns from 014
    uuid TEXT,
    server_seq INTEGER,
    -- New in 015: what a template produces (NULL unless type='template')
    template_target TEXT CHECK (template_target IN ('task', 'article'))
);

INSERT INTO issues_new (
    id, type, title, body_md, status, scheduled_on, meta, created_at, updated_at, is_bookmarked, is_deleted,
    start_time, end_time, duration,
    end_date,
    scheduled_start, scheduled_end, is_all_day,
    actual_start, actual_end,
    task_kind,
    uuid, server_seq
)
SELECT
    id, type, title, body_md, status, scheduled_on, meta, created_at, updated_at, is_bookmarked, is_deleted,
    start_time, end_time, duration,
    end_date,
    scheduled_start, scheduled_end, is_all_day,
    actual_start, actual_end,
    task_kind,
    uuid, server_seq
FROM issues;

DROP TABLE issues;
ALTER TABLE issues_new RENAME TO issues;

PRAGMA legacy_alter_table=OFF;
PRAGMA foreign_keys=ON;

-- Re-create indexes (dropped with the old table)
CREATE UNIQUE INDEX IF NOT EXISTS idx_issues_uuid ON issues(uuid);
CREATE INDEX IF NOT EXISTS idx_issues_server_seq ON issues(server_seq);
CREATE INDEX IF NOT EXISTS idx_issues_task_kind ON issues(task_kind) WHERE type = 'task';

-- Re-create FTS triggers
DROP TRIGGER IF EXISTS issues_ai;
DROP TRIGGER IF EXISTS issues_ad;
DROP TRIGGER IF EXISTS issues_au;

CREATE TRIGGER issues_ai AFTER INSERT ON issues
BEGIN
    INSERT INTO issues_fts(issue_id, title, body_md)
    VALUES (NEW.id, COALESCE(NEW.title, ''), NEW.body_md);
END;

CREATE TRIGGER issues_ad AFTER DELETE ON issues
BEGIN
    DELETE FROM issues_fts WHERE issue_id = OLD.id;
END;

CREATE TRIGGER issues_au AFTER UPDATE OF title, body_md ON issues
BEGIN
    UPDATE issues_fts
    SET title = COALESCE(NEW.title, ''),
        body_md = NEW.body_md
    WHERE issue_id = NEW.id;
END;

-- Re-create sync triggers (014). template_target added to the AFTER UPDATE OF list
-- so template edits stamp server_seq and reach offline clients.
DROP TRIGGER IF EXISTS issues_sync_ai;
DROP TRIGGER IF EXISTS issues_sync_au;

CREATE TRIGGER issues_sync_ai AFTER INSERT ON issues
BEGIN
    UPDATE sync_sequence SET seq = seq + 1 WHERE id = 1;
    UPDATE issues SET
        server_seq = (SELECT seq FROM sync_sequence WHERE id = 1),
        uuid = COALESCE(NEW.uuid, lower(
            hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' ||
            substr(hex(randomblob(2)), 2) || '-' ||
            substr('89ab', (abs(random()) % 4) + 1, 1) ||
            substr(hex(randomblob(2)), 2) || '-' || hex(randomblob(6))
        ))
    WHERE id = NEW.id;
END;

CREATE TRIGGER issues_sync_au AFTER UPDATE OF
    type, title, body_md, status, scheduled_on, meta, updated_at,
    is_bookmarked, is_deleted, start_time, end_time, duration, end_date,
    scheduled_start, scheduled_end, is_all_day, actual_start, actual_end, task_kind,
    template_target
ON issues
BEGIN
    UPDATE sync_sequence SET seq = seq + 1 WHERE id = 1;
    UPDATE issues SET server_seq = (SELECT seq FROM sync_sequence WHERE id = 1)
    WHERE id = NEW.id;
END;

INSERT OR REPLACE INTO schema_migrations (version) VALUES ('015_add_template_issue_type');

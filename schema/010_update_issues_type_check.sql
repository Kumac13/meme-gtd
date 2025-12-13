-- Migration: 010_update_issues_type_check
PRAGMA foreign_keys=OFF;

CREATE TABLE IF NOT EXISTS issues_new (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    type TEXT NOT NULL CHECK (type IN ('memo', 'task', 'article')),
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
    -- Columns from 006
    scheduled_start TEXT,
    scheduled_end TEXT,
    is_all_day INTEGER NOT NULL DEFAULT 0,
    -- Columns from 007
    actual_start TEXT,
    actual_end TEXT
);

INSERT INTO issues_new (
    id, type, title, body_md, status, scheduled_on, meta, created_at, updated_at, is_bookmarked, is_deleted,
    start_time, end_time, duration,
    end_date,
    scheduled_start, scheduled_end, is_all_day,
    actual_start, actual_end
)
SELECT 
    id, type, title, body_md, status, scheduled_on, meta, created_at, updated_at, is_bookmarked, is_deleted,
    start_time, end_time, duration,
    end_date,
    scheduled_start, scheduled_end, is_all_day,
    actual_start, actual_end
FROM issues;

DROP TABLE issues;
ALTER TABLE issues_new RENAME TO issues;

PRAGMA foreign_keys=ON;

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

INSERT OR REPLACE INTO schema_migrations (version) VALUES ('010_update_issues_type_check');

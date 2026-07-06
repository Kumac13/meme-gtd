-- Migration: 014_add_sync_support
-- Purpose: Foundation for iOS offline sync (Phase 1).
--   * uuid column on issues/comments so offline clients can mint stable identities
--   * server_seq: a global monotonic sequence stamped on every write, used as the
--     pull cursor for delta sync (GET /api/sync/changes?since=<seq>)
--   * sync_tombstones: records hard-deletes of labels/issue_labels (soft-deleted
--     issues/comments act as their own tombstones via is_deleted)
--   * sync_applied_ops: idempotency ledger for POST /api/sync/push
--   Stamping is done with SQLite triggers (not application code) because the CLI
--   writes through packages/core -> packages/db directly, bypassing the API;
--   triggers are the only layer covering every write path.
-- Note: the legacy sync_state table from 001_init is intentionally left untouched.

-- 1. Columns ---------------------------------------------------------------

ALTER TABLE issues ADD COLUMN uuid TEXT;
ALTER TABLE issues ADD COLUMN server_seq INTEGER;
ALTER TABLE comments ADD COLUMN uuid TEXT;
ALTER TABLE comments ADD COLUMN server_seq INTEGER;
ALTER TABLE labels ADD COLUMN server_seq INTEGER;
ALTER TABLE issue_labels ADD COLUMN server_seq INTEGER;

-- 2. Sync bookkeeping tables -------------------------------------------------

CREATE TABLE IF NOT EXISTS sync_sequence (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    seq INTEGER NOT NULL
);
INSERT OR IGNORE INTO sync_sequence (id, seq) VALUES (1, 0);

-- Tombstones for hard-deleted entities. entity_key is JSON carrying both the
-- integer ids (always resolvable in the trigger) and, when available, the
-- human keys (labelName / issueUuid). On CASCADE deletes the parent labels row
-- is already gone when the issue_labels trigger fires, so labelName may be NULL
-- there; clients then rely on the accompanying 'label' tombstone.
CREATE TABLE IF NOT EXISTS sync_tombstones (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    entity TEXT NOT NULL CHECK (entity IN ('label', 'issue_label')),
    entity_key TEXT NOT NULL,
    server_seq INTEGER NOT NULL,
    deleted_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX IF NOT EXISTS idx_sync_tombstones_server_seq ON sync_tombstones(server_seq);

-- Idempotency ledger for sync push operations (op_id is client-generated).
CREATE TABLE IF NOT EXISTS sync_applied_ops (
    op_id TEXT PRIMARY KEY,
    device_id TEXT NOT NULL,
    result TEXT NOT NULL,
    applied_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- 3. Backfill existing rows (before triggers exist, so nothing double-fires) --

-- uuid backfill: v4-format from randomblob. Ordering does not matter for
-- pre-existing rows, so v4 is fine here (new rows get UUIDv7 from repositories).
UPDATE issues SET uuid = lower(
    hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' ||
    substr(hex(randomblob(2)), 2) || '-' ||
    substr('89ab', (abs(random()) % 4) + 1, 1) ||
    substr(hex(randomblob(2)), 2) || '-' || hex(randomblob(6))
) WHERE uuid IS NULL;

UPDATE comments SET uuid = lower(
    hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' ||
    substr(hex(randomblob(2)), 2) || '-' ||
    substr('89ab', (abs(random()) % 4) + 1, 1) ||
    substr(hex(randomblob(2)), 2) || '-' || hex(randomblob(6))
) WHERE uuid IS NULL;

-- server_seq backfill: assign disjoint ascending ranges per table so an initial
-- pull (since=0) returns every existing row exactly once.
UPDATE issues SET server_seq = id WHERE server_seq IS NULL;

UPDATE comments SET server_seq = id + (SELECT COALESCE(MAX(server_seq), 0) FROM issues)
WHERE server_seq IS NULL;

UPDATE labels SET server_seq = id + (
    SELECT MAX(m) FROM (
        SELECT COALESCE(MAX(server_seq), 0) AS m FROM issues
        UNION ALL SELECT COALESCE(MAX(server_seq), 0) FROM comments
    )
) WHERE server_seq IS NULL;

UPDATE issue_labels SET server_seq = rowid + (
    SELECT MAX(m) FROM (
        SELECT COALESCE(MAX(server_seq), 0) AS m FROM issues
        UNION ALL SELECT COALESCE(MAX(server_seq), 0) FROM comments
        UNION ALL SELECT COALESCE(MAX(server_seq), 0) FROM labels
    )
) WHERE server_seq IS NULL;

UPDATE sync_sequence SET seq = (
    SELECT MAX(m) FROM (
        SELECT COALESCE(MAX(server_seq), 0) AS m FROM issues
        UNION ALL SELECT COALESCE(MAX(server_seq), 0) FROM comments
        UNION ALL SELECT COALESCE(MAX(server_seq), 0) FROM labels
        UNION ALL SELECT COALESCE(MAX(server_seq), 0) FROM issue_labels
    )
) WHERE id = 1;

-- 4. Indexes -----------------------------------------------------------------

CREATE UNIQUE INDEX IF NOT EXISTS idx_issues_uuid ON issues(uuid);
CREATE UNIQUE INDEX IF NOT EXISTS idx_comments_uuid ON comments(uuid);
CREATE INDEX IF NOT EXISTS idx_issues_server_seq ON issues(server_seq);
CREATE INDEX IF NOT EXISTS idx_comments_server_seq ON comments(server_seq);
CREATE INDEX IF NOT EXISTS idx_labels_server_seq ON labels(server_seq);
CREATE INDEX IF NOT EXISTS idx_issue_labels_server_seq ON issue_labels(server_seq);

-- 5. Stamping triggers ---------------------------------------------------------
-- The stamp UPDATE only touches server_seq/uuid, which are excluded from every
-- AFTER UPDATE OF column list below, so triggers never re-fire themselves.

-- issues: stamp on insert (with uuid fallback for write paths that omit it)
CREATE TRIGGER IF NOT EXISTS issues_sync_ai AFTER INSERT ON issues
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

CREATE TRIGGER IF NOT EXISTS issues_sync_au AFTER UPDATE OF
    type, title, body_md, status, scheduled_on, meta, updated_at,
    is_bookmarked, is_deleted, start_time, end_time, duration, end_date,
    scheduled_start, scheduled_end, is_all_day, actual_start, actual_end, task_kind
ON issues
BEGIN
    UPDATE sync_sequence SET seq = seq + 1 WHERE id = 1;
    UPDATE issues SET server_seq = (SELECT seq FROM sync_sequence WHERE id = 1)
    WHERE id = NEW.id;
END;

-- comments
CREATE TRIGGER IF NOT EXISTS comments_sync_ai AFTER INSERT ON comments
BEGIN
    UPDATE sync_sequence SET seq = seq + 1 WHERE id = 1;
    UPDATE comments SET
        server_seq = (SELECT seq FROM sync_sequence WHERE id = 1),
        uuid = COALESCE(NEW.uuid, lower(
            hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' ||
            substr(hex(randomblob(2)), 2) || '-' ||
            substr('89ab', (abs(random()) % 4) + 1, 1) ||
            substr(hex(randomblob(2)), 2) || '-' || hex(randomblob(6))
        ))
    WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS comments_sync_au AFTER UPDATE OF
    issue_id, body_md, updated_at, is_deleted
ON comments
BEGIN
    UPDATE sync_sequence SET seq = seq + 1 WHERE id = 1;
    UPDATE comments SET server_seq = (SELECT seq FROM sync_sequence WHERE id = 1)
    WHERE id = NEW.id;
END;

-- labels (hard-deleted -> tombstone)
CREATE TRIGGER IF NOT EXISTS labels_sync_ai AFTER INSERT ON labels
BEGIN
    UPDATE sync_sequence SET seq = seq + 1 WHERE id = 1;
    UPDATE labels SET server_seq = (SELECT seq FROM sync_sequence WHERE id = 1)
    WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS labels_sync_au AFTER UPDATE OF name, description ON labels
BEGIN
    UPDATE sync_sequence SET seq = seq + 1 WHERE id = 1;
    UPDATE labels SET server_seq = (SELECT seq FROM sync_sequence WHERE id = 1)
    WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS labels_sync_ad AFTER DELETE ON labels
BEGIN
    UPDATE sync_sequence SET seq = seq + 1 WHERE id = 1;
    INSERT INTO sync_tombstones (entity, entity_key, server_seq)
    VALUES (
        'label',
        json_object('labelId', OLD.id, 'labelName', OLD.name),
        (SELECT seq FROM sync_sequence WHERE id = 1)
    );
END;

-- issue_labels (hard-deleted -> tombstone; fires for CASCADE deletes too)
CREATE TRIGGER IF NOT EXISTS issue_labels_sync_ai AFTER INSERT ON issue_labels
BEGIN
    UPDATE sync_sequence SET seq = seq + 1 WHERE id = 1;
    UPDATE issue_labels SET server_seq = (SELECT seq FROM sync_sequence WHERE id = 1)
    WHERE issue_id = NEW.issue_id AND label_id = NEW.label_id;
END;

CREATE TRIGGER IF NOT EXISTS issue_labels_sync_ad AFTER DELETE ON issue_labels
BEGIN
    UPDATE sync_sequence SET seq = seq + 1 WHERE id = 1;
    INSERT INTO sync_tombstones (entity, entity_key, server_seq)
    VALUES (
        'issue_label',
        json_object(
            'issueId', OLD.issue_id,
            'labelId', OLD.label_id,
            'issueUuid', (SELECT uuid FROM issues WHERE id = OLD.issue_id),
            'labelName', (SELECT name FROM labels WHERE id = OLD.label_id)
        ),
        (SELECT seq FROM sync_sequence WHERE id = 1)
    );
END;

INSERT OR REPLACE INTO schema_migrations (version) VALUES ('014_add_sync_support');

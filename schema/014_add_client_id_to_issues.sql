-- Migration: 014_add_client_id_to_issues
-- Adds an optional client-supplied identifier to support idempotent
-- POST retries from the iOS offline outbox. The client generates a ULID
-- before sending; if the same client_id arrives twice, the server returns
-- the existing memo instead of duplicating it.

ALTER TABLE issues ADD COLUMN client_id TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS issues_client_id_unique
    ON issues(client_id)
    WHERE client_id IS NOT NULL;

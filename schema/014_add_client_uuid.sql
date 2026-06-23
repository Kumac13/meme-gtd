-- Add client_uuid columns for idempotent writes from offline-capable clients (iOS).
-- The column is nullable so existing Web/CLI flows are unaffected. iOS sends a
-- client-generated UUID so that retries after network failures do not create
-- duplicate rows. Uniqueness is enforced only on non-NULL values via a partial
-- index so historical rows (all NULL) do not collide.

ALTER TABLE issues ADD COLUMN client_uuid TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_issues_client_uuid
    ON issues(client_uuid)
    WHERE client_uuid IS NOT NULL;

ALTER TABLE comments ADD COLUMN client_uuid TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_comments_client_uuid
    ON comments(client_uuid)
    WHERE client_uuid IS NOT NULL;

INSERT OR REPLACE INTO schema_migrations (version) VALUES ('014_add_client_uuid');

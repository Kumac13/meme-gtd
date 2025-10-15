import Database from 'better-sqlite3';
import { nowIso, Label } from 'meme-gtd-shared';

/**
 * List all labels in the database
 * @param db Database instance
 * @returns Array of all labels ordered by name
 */
export const listAllLabels = (db: Database.Database): Label[] => {
  const stmt = db.prepare('SELECT * FROM labels ORDER BY name ASC');
  const rows = stmt.all() as Array<{
    id: number;
    name: string;
    description: string | null;
    created_at: string;
  }>;

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    description: row.description,
    createdAt: row.created_at,
  }));
};

/**
 * Get a single label by ID
 * @param db Database instance
 * @param id Label ID
 * @returns Label object
 * @throws Error if label not found
 */
export const getLabel = (db: Database.Database, id: number): Label => {
  const stmt = db.prepare('SELECT * FROM labels WHERE id = @id');
  const row = stmt.get({ id }) as
    | {
        id: number;
        name: string;
        description: string | null;
        created_at: string;
      }
    | undefined;

  if (!row) {
    throw new Error(`Label #${id} not found`);
  }

  return {
    id: row.id,
    name: row.name,
    description: row.description,
    createdAt: row.created_at,
  };
};

/**
 * Get a single label by name
 * @param db Database instance
 * @param name Label name
 * @returns Label object or null if not found
 */
export const getLabelByName = (
  db: Database.Database,
  name: string
): Label | null => {
  const stmt = db.prepare('SELECT * FROM labels WHERE name = @name');
  const row = stmt.get({ name }) as
    | {
        id: number;
        name: string;
        description: string | null;
        created_at: string;
      }
    | undefined;

  if (!row) {
    return null;
  }

  return {
    id: row.id,
    name: row.name,
    description: row.description,
    createdAt: row.created_at,
  };
};

/**
 * Create a new label
 * @param db Database instance
 * @param name Label name (must be unique)
 * @param description Optional label description
 * @returns Created label object
 * @throws Error if label with the same name already exists
 */
export const createLabel = (
  db: Database.Database,
  name: string,
  description?: string
): Label => {
  // Check uniqueness
  const existing = getLabelByName(db, name);
  if (existing) {
    throw new Error(`Label '${name}' already exists`);
  }

  const now = nowIso();
  const stmt = db.prepare(
    `INSERT INTO labels (name, description, created_at)
     VALUES (@name, @description, @createdAt)`
  );
  const result = stmt.run({ name, description: description ?? null, createdAt: now });
  return getLabel(db, Number(result.lastInsertRowid));
};

/**
 * Attach a label to an issue (memo or task)
 * @param db Database instance
 * @param issueId Issue ID
 * @param labelId Label ID
 * @throws Error if issue not found, deleted, or label not found
 */
export const attachLabelToIssue = (
  db: Database.Database,
  issueId: number,
  labelId: number
): void => {
  // Check issue exists and not deleted
  const issue = db
    .prepare('SELECT id, type, is_deleted FROM issues WHERE id = @id')
    .get({ id: issueId }) as
    | { id: number; type: string; is_deleted: number }
    | undefined;

  if (!issue || issue.is_deleted === 1) {
    throw new Error(`Issue #${issueId} not found or deleted`);
  }

  // Check label exists
  const label = getLabel(db, labelId);
  if (!label) {
    throw new Error(`Label #${labelId} not found`);
  }

  // Insert (idempotent - ignore if already exists)
  db.prepare(
    `INSERT OR IGNORE INTO issue_labels (issue_id, label_id, assigned_at)
     VALUES (@issueId, @labelId, @assignedAt)`
  ).run({ issueId, labelId, assignedAt: nowIso() });
};

/**
 * Delete a label (CASCADE removes from all issues)
 * @param db Database instance
 * @param name Label name
 * @throws Error if label not found
 */
export const deleteLabel = (db: Database.Database, name: string): void => {
  const label = getLabelByName(db, name);
  if (!label) {
    throw new Error(`Label '${name}' not found`);
  }

  // Delete label (CASCADE removes issue_labels automatically)
  db.prepare('DELETE FROM labels WHERE name = @name').run({ name });
};

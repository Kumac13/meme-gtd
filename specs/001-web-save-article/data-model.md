# Data Model: Web Article

## Entity: Article

**Storage**: Mapped to `issues` table in SQLite.

| Field | Type | Storage Column | Description |
|-------|------|----------------|-------------|
| id | string | id | Unique ID (UUID). |
| type | string | type | Constant 'article'. |
| title | string | title | Article title. |
| body | string | body_md | Article content in Markdown with block IDs. |
| originalUrl | string | meta (json) | Source URL. |
| siteName | string | meta (json) | Name of the source website. |
| archivedAt | string | meta (json) | ISO timestamp of when it was saved. |
| createdAt | number | created_at | Creation timestamp (Unix epoch). |
| updatedAt | number | updated_at | Update timestamp (Unix epoch). |

## Relationships

- **Labels**: Many-to-Many via `issue_labels` (existing).
- **Links**: Many-to-Many via `issue_links` (existing).
- **Comments**: One-to-Many via `comments` table (existing).

## Highlights (Phase 2 Preview)

**Storage**: New table `article_highlights`.

| Field | Type | Description |
|-------|------|-------------|
| id | string | Unique ID. |
| articleId | string | FK to issues.id. |
| startBlockId | string | ID of the start block. |
| startOffset | number | Character offset in start block. |
| endBlockId | string | ID of the end block. |
| endOffset | number | Character offset in end block. |
| color | string | Highlight color. |
| note | string | Optional user note. |

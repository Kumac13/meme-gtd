# Implementation Plan: Web Article Saving

**Branch**: `001-web-save-article` | **Date**: 2025-12-11 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/001-web-save-article/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

## Summary

Implement a web article saving feature consisting of a Browser Extension for capturing content (HTML -> Markdown) and a local API for storage. Articles are stored in the existing SQLite database. The Web UI provides a Reader View and integration with GTD tasks/memos.

## Technical Context

**Architecture**: Monorepo with packages (api, web, core, db). Local-first application.
**Frontend**: React (packages/web), Chrome Extension (new package).
**Backend**: Node.js API (packages/api).
**Database**: SQLite (packages/db). Storage in `issues` table with `type='article'`.

**Dependencies**:
- `readability` (or similar logic) in Browser Extension (for extracting content).
- `turndown` (or similar) in Browser Extension (for HTML to Markdown).
- `better-sqlite3` (existing project dependency).

**Integrations**:
- **Database**: Integrate with existing `issues` table.
- **UI**: Reuse `LabelPicker`, `LinkManager`, `CommentSection` components from `packages/web`.

**Resolved Unknowns**:
- **Extension Location**: `packages/extension`.
- **Block ID Format**: Markdown Attributes syntax `{#block-id}`.

**Research**: See [research.md](./research.md) for details.

## Constitution Check

- [x] **Library-First**: Core logic for article management will be in `packages/core` (or similar shared lib) before being exposed via API/CLI.
- [x] **CLI Interface**: Spec defines CLI commands (`article list`, `article view`, etc.) mirroring the API capabilities.
- [x] **Test-First**: Plan will explicitly schedule test writing before implementation for each component (Extension, API, Web UI).
- [x] **Simplicity**: Reusing existing `issues` table and UI components minimizes complexity.

**Result**: PASS

## Project Structure

### Documentation (this feature)

```text
specs/001-web-save-article/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
packages/
├── api/
│   ├── src/routes/articles.ts       # API Endpoints
│   └── test/integration/articles.test.ts
├── core/
│   ├── src/domain/article/          # Core Logic
│   └── test/domain/article/
├── extension/                       # NEW Package
│   ├── src/
│   │   ├── background/              # API communication
│   │   ├── content/                 # Readability & Markdown conversion
│   │   └── popup/                   # Simple UI
│   ├── manifest.json
│   └── package.json
└── web/
    ├── src/pages/Articles/          # List & Reader Views
    └── src/components/Article/
```

**Structure Decision**: Using existing monorepo structure. Adding `packages/extension` for the browser extension.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| - | - | - |

## Implementation Strategy

**Strategy**: Test-Driven Development (TDD). Tests will be written *before* implementation for each component.

### Phase 1: Core & API

- **Goal**: Enable storing and retrieving articles via API.
- **Key Changes**:
  - **Schema**: Update `packages/db` to support `type='article'` (if needed) or just use valid types.
  - **Core**: Implement `ArticleService` in `packages/core`.
    - *Test*: Unit tests for service methods.
  - **API**: Implement POST/GET endpoints in `packages/api`.
    - *Test*: Integration tests ensuring valid JSON payloads are saved and retrieved.
- **Verification**: Run `pnpm test:api` and verify endpoints pass.

### Phase 2: Browser Extension (Basic)

- **Goal**: Capture page content and send to API.
- **Key Changes**:
  - **Setup**: Initialize `packages/extension`.
  - **Logic**: Implement Readability extraction and Markdown conversion.
    - *Test*: Unit tests with sample HTML inputs -> expected Markdown output (with IDs).
  - **UI**: Simple popup with "Save" button.
- **Verification**: Load extension, click Save, verify data in API/DB.

### Phase 3: Web UI (Viewer)

- **Goal**: View list and read articles.
- **Key Changes**:
  - **List**: Add `/articles` route and list component.
  - **Reader**: Add `/articles/:id` route and reader component.
  - **Integration**: Link/Label UI reuse.
- **Verification**: Verify UI renders correctly and interacts with API.
# Research: Web Article Saving

## 1. Extension Location
**Question**: Where should the browser extension code reside?
**Decision**: `packages/extension`
**Rationale**: 
- Follows the existing monorepo structure (`packages/web`, `packages/cli`, `packages/api`).
- Keeps the extension isolated but managed within the same workspace.
- Allows sharing code (types, utilities) from `packages/shared`.

## 2. Block ID Format in Markdown
**Question**: How to persist unique block IDs in Markdown for future highlighting?
**Decision**: Use Markdown Attributes syntax `{#block-id}`.
**Rationale**:
- Supported by `markdown-it-attrs` (common library).
- Keeps the content readable as Markdown (vs. embedding HTML <div>s everywhere).
- Example:
  ```markdown
  # Article Title {#block-0}
  
  This is a paragraph. {#block-1}
  ```
**Implementation Detail**:
- The extension's HTML-to-Markdown converter (e.g., `turndown`) needs a plugin or custom rule to extract the ID from the DOM element (assigned during Readability phase) and append `{#id}` to the Markdown output.

## 3. Extension-to-API Communication
**Question**: How does the extension communicate with the local API?
**Decision**: Standard `fetch` to `http://localhost:3000/api/articles` (or configured port).
**Security**: The API needs to allow CORS from the extension (or specific origin).
**Rationale**: Simple, standard.

## 4. Test-First Strategy
**Question**: How to apply TDD to this feature?
**Plan**:
1. **Core/DB**: Write tests for `ArticleService.create()` and `ArticleRepository.save()` before implementation.
2. **API**: Write integration tests (supertest) for `POST /api/articles` and `GET /api/articles` before implementation.
3. **Extension**: Write unit tests for the "Extraction Logic" (HTML -> Markdown with IDs) using mocked DOM/HTML input.

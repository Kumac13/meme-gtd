# Tasks: Web Article Saving

**Feature Branch**: `001-web-save-article`
**Spec**: [spec.md](./spec.md)
**Plan**: [plan.md](./plan.md)

## Phase 1: Setup

- [x] T001 Create `packages/extension` directory structure packages/extension
- [x] T002 Initialize `packages/extension/package.json` with dependencies (turndown, readability, etc.) packages/extension/package.json
- [x] T003 Create `packages/extension/manifest.json` (Manifest V3) packages/extension/manifest.json
- [x] T004 Create `packages/extension/tsconfig.json` packages/extension/tsconfig.json
- [x] T005 [P] Setup build script (vite or tsc) for extension in `packages/extension/vite.config.ts` packages/extension/vite.config.ts

## Phase 2: Foundational

- [x] T006 Ensure `issues` table in `packages/db` supports `type='article'` (check constraints) packages/db/src/schema.ts
- [x] T007 Define Article entity type definition in `packages/core/src/domain/article/types.ts` packages/core/src/domain/article/types.ts

## Phase 3: User Story 1 - Save Web Article (P1)

**Goal**: Capture web content via extension and save to local DB via API.
**Tests**: Unit tests for extraction logic, Integration tests for API endpoint.

- [x] T008 [US1] Create unit test for Article Service creation in `packages/core/test/domain/article/ArticleService.test.ts` packages/core/test/domain/article/ArticleService.test.ts
- [x] T009 [US1] Implement `ArticleRepository` save method in `packages/db/src/repositories/ArticleRepository.ts` packages/db/src/repositories/ArticleRepository.ts
- [x] T010 [US1] Implement `ArticleService` create method in `packages/core/src/domain/article/ArticleService.ts` packages/core/src/domain/article/ArticleService.ts
- [x] T011 [P] [US1] Create integration test for POST /api/articles in `packages/api/test/integration/articles.test.ts` packages/api/test/integration/articles.test.ts
- [x] T012 [US1] Implement POST /api/articles endpoint in `packages/api/src/routes/articles.ts` packages/api/src/routes/articles.ts
- [x] T013 [US1] Create unit test for HTML-to-Markdown extraction logic in `packages/extension/src/content/extractor.test.ts` packages/extension/src/content/extractor.test.ts
- [x] T014 [US1] Implement Readability and Turndown logic with block ID generation in `packages/extension/src/content/extractor.ts` packages/extension/src/content/extractor.ts
- [x] T015 [US1] Implement content script to run extractor and send message in `packages/extension/src/content/index.ts` packages/extension/src/content/index.ts
- [x] T016 [US1] Implement background script to handle API request in `packages/extension/src/background/index.ts` packages/extension/src/background/index.ts
- [x] T017 [US1] Create simple Popup UI with Save button in `packages/extension/src/popup/Popup.tsx` packages/extension/src/popup/Popup.tsx

## Phase 4: User Story 2 - View Article List (P1)

**Goal**: Display list of saved articles in Web UI.
**Tests**: API Integration test.

- [x] T018 [US2] Create unit test for Article Repository list method in `packages/db/test/repositories/ArticleRepository.test.ts` packages/db/test/repositories/ArticleRepository.test.ts
- [x] T019 [US2] Implement `ArticleRepository` list method (pagination support) in `packages/db/src/repositories/ArticleRepository.ts` packages/db/src/repositories/ArticleRepository.ts
- [x] T020 [P] [US2] Create integration test for GET /api/articles in `packages/api/test/integration/articles.test.ts` packages/api/test/integration/articles.test.ts
- [x] T021 [US2] Implement GET /api/articles endpoint in `packages/api/src/routes/articles.ts` packages/api/src/routes/articles.ts
- [x] T022 [US2] Implement Article List component in `packages/web/src/pages/Articles/ArticleList.tsx` packages/web/src/pages/Articles/ArticleList.tsx
- [x] T023 [US2] Add /articles route to main router in `packages/web/src/App.tsx` packages/web/src/App.tsx

## Phase 5: User Story 3 - Read Article (P1)

**Goal**: Reader View for saved articles.
**Tests**: API Integration test.

- [x] T024 [US3] Implement `ArticleRepository` findById method in `packages/db/src/repositories/ArticleRepository.ts` packages/db/src/repositories/ArticleRepository.ts
- [x] T025 [P] [US3] Create integration test for GET /api/articles/:id in `packages/api/test/integration/articles.test.ts` packages/api/test/integration/articles.test.ts
- [x] T026 [US3] Implement GET /api/articles/:id endpoint in `packages/api/src/routes/articles.ts` packages/api/src/routes/articles.ts
- [x] T027 [US3] Implement Markdown Renderer component (with block ID support) in `packages/web/src/components/Article/MarkdownRenderer.tsx` packages/web/src/components/Article/MarkdownRenderer.tsx
- [x] T028 [US3] Implement Article Reader page in `packages/web/src/pages/Articles/ArticleReader.tsx` packages/web/src/pages/Articles/ArticleReader.tsx

## Phase 6: User Story 4 - Organize and Link (P2)

**Goal**: Label and link articles.
**Tests**: N/A (UI Integration only).

- [x] T029 [US4] Integrate `LabelPicker` component into Article Reader in `packages/web/src/pages/Articles/ArticleReader.tsx` packages/web/src/pages/Articles/ArticleReader.tsx
- [x] T030 [US4] Integrate `LinkManager` component into Article Reader in `packages/web/src/pages/Articles/ArticleReader.tsx` packages/web/src/pages/Articles/ArticleReader.tsx
- [x] T031 [US4] Integrate `CommentSection` component into Article Reader in `packages/web/src/pages/Articles/ArticleReader.tsx` packages/web/src/pages/Articles/ArticleReader.tsx

## Phase 7: Polish & Cross-Cutting

- [x] T032 Fix any CORS issues in API for Extension access packages/api/src/index.ts
- [x] T033 Verify Extension build and load process packages/extension/package.json
- [x] T034 Manual verification of Reader View styling (typography, spacing) packages/web/src/pages/Articles/ArticleReader.tsx

## Phase 8: Bug Fixes

- [x] T035 [FIX] Remove {#block-N} from rendered markdown display packages/web/src/pages/Articles/ArticleReader.tsx
- [x] T036 [FIX] Hide bookmark button from ArticleReader (backend not implemented) packages/web/src/pages/Articles/ArticleReader.tsx packages/web/src/components/ItemDetail.tsx
- [x] T037 [FIX] Hide CommentSection from ArticleReader (API not implemented for articles) packages/web/src/components/ItemDetail.tsx

## Dependencies

1. **Phase 1 (Setup)**: Must be done first.
2. **Phase 2 (Foundational)**: Unlocks Core/DB work.
3. **Phase 3 (Save)**: Unlocks data ingestion.
4. **Phase 4 (List)**: Depends on data ingestion (to see results) but technically independent implementation-wise.
5. **Phase 5 (Reader)**: Depends on List (navigation) and Data (ingestion).
6. **Phase 6 (Organize)**: Depends on Reader View.

## Parallel Execution Examples

- **US1**: T011 (API Test) and T013 (Extension Test) can be written in parallel.
- **US2**: T020 (API Test) and T022 (UI Component) can be started in parallel.

## Implementation Strategy

**MVP Scope**: Phase 1, 2, and 3 (Save & Verify in DB).
**Incremental Delivery**:
1. Extension can save to DB (verified via SQL or API).
2. UI List shows saved items.
3. UI Reader shows content.
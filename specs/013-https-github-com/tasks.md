# Tasks: Link Command Enhancement

**Input**: Design documents from `/specs/013-https-github-com/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/api-changes.md

**Tests**: Included - testing is explicitly required per plan.md Constitution Check

**Organization**: Tasks are grouped by enhancement type since the basic link commands already exist. This is an enhancement feature, not a greenfield project.

## Format: `[ID] [P?] [Enhancement] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- **[Enhancement]**: Which enhancement this task belongs to (V5=Inverse Duplicate, V6=Circular Detection, API=API Parity)
- Include exact file paths in descriptions

## Path Conventions
- Monorepo structure: `packages/{cli,core,db,api}/src/`
- Tests: `packages/{core,api}/test/`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Minimal setup - project structure already exists

- [x] T001 [P] Review existing LinkService implementation in `packages/core/src/linkService.ts`
- [x] T002 [P] Review existing link database functions in `packages/db/src/linkRepository.ts`
- [x] T003 [P] Review existing link CLI commands in `packages/cli/src/commands/link/`
- [x] T004 [P] Review existing link API handlers in `packages/api/src/handlers/linkHandlers.ts`

---

## Phase 2: Foundational (Database Layer Enhancements)

**Purpose**: Add database query functions needed by ALL validations

**⚠️ CRITICAL**: These functions must be complete before any validation logic can be implemented

- [ ] T005 [V5+V6] Add `findInverseParentChildLink()` function to `packages/db/src/links.ts`
  - Accepts: sourceId, targetId, proposedType
  - Returns: Link | null (if inverse parent/child link exists)
  - Query: Check for (A→B or B→A) with parent/child types excluding exact match
  - Implementation: Use existing `findLink()` pattern as reference

- [ ] T006 [V5+V6] Add `hasAncestor()` function to `packages/db/src/links.ts`
  - Accepts: descendantId, ancestorId
  - Returns: boolean (true if ancestorId is ancestor of descendantId)
  - Query: Recursive CTE to traverse parent-child hierarchy upward
  - Implementation: Use research.md Recursive CTE approach
  - Performance: Limit depth to 10 levels

- [ ] T007 [V5+V6] Export new functions from `packages/db/src/index.ts`
  - Add exports for `findInverseParentChildLink` and `hasAncestor`

**Checkpoint**: Database layer ready - validation implementation can now begin

---

## Phase 3: User Story 1 Enhancement - Circular Detection (Priority: P1) 🎯 MVP

**Goal**: Add circular parent-child hierarchy detection (FR-013) to prevent cycles like A→B→C→A

**Independent Test**: Create A→B link, then B→C link, then attempt C→A link. System must reject with circular error.

**Why this is MVP**: This is the most critical validation - prevents data corruption and infinite loops

### Tests for User Story 1 Enhancement

**NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [ ] T008 [P] [V6] Add circular detection test: Direct cycle (A→B, B→A) in `packages/core/test/linkService.test.ts`
  - Test: Create parent link A→B, attempt parent link B→A
  - Expected: Throws error with "Circular relationship detected"

- [ ] T009 [P] [V6] Add circular detection test: 3-level cycle (A→B→C→A) in `packages/core/test/linkService.test.ts`
  - Test: Create A→B, B→C, attempt C→A
  - Expected: Throws error with "Circular relationship detected"

- [ ] T010 [P] [V6] Add circular detection test: Deeper cycle (5 levels) in `packages/core/test/linkService.test.ts`
  - Test: Create A→B→C→D→E, attempt E→A
  - Expected: Throws error with "Circular relationship detected"

- [ ] T011 [P] [V6] Add circular detection test: Non-hierarchical types allowed in `packages/core/test/linkService.test.ts`
  - Test: Create A→B with parent, B→C with parent, then C→A with "relates"
  - Expected: Success - relates links don't participate in cycle detection

- [ ] T012 [P] [V6] Add API integration test for circular detection in `packages/api/test/integration/links.test.ts`
  - Test: POST /api/links to create A→B→C→A cycle
  - Expected: 400 VALIDATION_ERROR response

### Implementation for User Story 1 Enhancement

- [ ] T013 [V6] Implement circular detection in `packages/core/src/linkService.ts` `create()` method
  - Location: After V5 inverse duplicate check, before database insert
  - Condition: Only apply if `linkType` is 'parent' or 'child'
  - Logic: Call `hasAncestor(targetId, sourceId)` from db layer
  - Error: "Circular relationship detected: Creating this link would form a cycle in the parent-child hierarchy (Issue #{source} is already an ancestor of Issue #{target})"
  - Performance: Should add ~20-50ms per parent/child link creation

- [ ] T014 [V6] Add error mapping for circular detection in `packages/api/src/handlers/linkHandlers.ts`
  - Location: In createLinkHandler catch block, after existing error checks
  - Condition: `error.message.includes('Circular relationship detected')`
  - Action: `throw new ValidationError(error.message)`

**Checkpoint**: Circular detection complete - hierarchies are now safe from cycles

---

## Phase 4: User Story 1 Enhancement - Inverse Duplicate Detection (Priority: P1)

**Goal**: Add inverse duplicate prevention (FR-014) to block bidirectional parent-child like A parent of B + B parent of A

**Independent Test**: Create parent link A→B, then attempt parent link B→A. System must reject with inverse error.

**Why also P1**: Works hand-in-hand with circular detection - both are critical for hierarchy integrity

### Tests for Inverse Duplicate Detection

- [ ] T015 [P] [V5] Add inverse duplicate test: Same type inverse (A parent of B, B parent of A) in `packages/core/test/linkService.test.ts`
  - Test: Create parent link (source=1, target=2), attempt parent link (source=2, target=1)
  - Expected: Throws error with "Cannot create inverse parent-child link"

- [ ] T016 [P] [V5] Add inverse duplicate test: Mixed type inverse (A parent of B, A child of B) in `packages/core/test/linkService.test.ts`
  - Test: Create parent link (source=1, target=2), attempt child link (source=1, target=2)
  - Expected: Throws error with "Cannot create inverse parent-child link"

- [ ] T017 [P] [V5] Add inverse duplicate test: Relates type allowed in `packages/core/test/linkService.test.ts`
  - Test: Create relates link (1→2), then relates link (2→1)
  - Expected: Success - relates links are bidirectional

- [ ] T018 [P] [V5] Add API integration test for inverse duplicate in `packages/api/test/integration/links.test.ts`
  - Test: POST /api/links to create A→B, then POST B→A
  - Expected: 400 VALIDATION_ERROR response

### Implementation for Inverse Duplicate Detection

- [ ] T019 [V5] Implement inverse duplicate check in `packages/core/src/linkService.ts` `create()` method
  - Location: After V4 duplicate check, before V6 circular check
  - Condition: Only apply if `linkType` is 'parent' or 'child'
  - Logic: Call `findInverseParentChildLink(sourceId, targetId, type)` from db layer
  - Error: "Cannot create inverse parent-child link: Issue #{target} is already a {type} of Issue #{source}"
  - Performance: Should add <5ms per parent/child link creation

- [ ] T020 [V5] Add error mapping for inverse duplicate in `packages/api/src/handlers/linkHandlers.ts`
  - Location: In createLinkHandler catch block
  - Condition: `error.message.includes('Cannot create inverse parent-child link')`
  - Action: `throw new ValidationError(error.message)`

**Checkpoint**: Parent-child hierarchies are now fully validated (V5 + V6 complete)

---

## Phase 5: User Story 2 Enhancement - API Type Filtering (Priority: P2)

**Goal**: Add `?type=` query parameter to `GET /api/issues/:id/links` to achieve feature parity with CLI

**Independent Test**: GET /api/issues/5/links?type=parent returns only parent links, filtering out child/relates/derived_from

**Why P2**: This is a usability enhancement - not critical for data integrity, but important for CLI/API parity

### Tests for API Type Filtering

- [ ] T021 [P] [API] Add API test: Filter by parent type in `packages/api/test/integration/links.test.ts`
  - Test: Create links of all types, GET /api/issues/:id/links?type=parent
  - Expected: Returns only parent links

- [ ] T022 [P] [API] Add API test: Filter by child type in `packages/api/test/integration/links.test.ts`
  - Test: GET /api/issues/:id/links?type=child
  - Expected: Returns only child links

- [ ] T023 [P] [API] Add API test: Filter by relates type in `packages/api/test/integration/links.test.ts`
  - Test: GET /api/issues/:id/links?type=relates
  - Expected: Returns only relates links

- [ ] T024 [P] [API] Add API test: No filter returns all types in `packages/api/test/integration/links.test.ts`
  - Test: GET /api/issues/:id/links (no query param)
  - Expected: Returns all links

- [ ] T025 [P] [API] Add API test: Invalid type returns 400 in `packages/api/test/integration/links.test.ts`
  - Test: GET /api/issues/:id/links?type=invalid
  - Expected: 400 VALIDATION_ERROR response

### Implementation for API Type Filtering

- [ ] T026 [P] [API] Add `ListLinksQuerySchema` to `packages/api/src/schemas/linkSchemas.ts`
  - Schema: `{ type: LinkTypeSchema.optional() }`
  - Export type: `ListLinksQuery`

- [ ] T027 [API] Update `listLinksHandler` signature in `packages/api/src/handlers/linkHandlers.ts`
  - Add: `Querystring: ListLinksQuery` to FastifyRequest type
  - Logic: Extract `request.query.type`, pass as filter to `linkService.list(issueId, { type })`
  - Note: LinkService.list() already supports filters parameter

- [ ] T028 [API] Update route schema for `GET /api/issues/:id/links` in `packages/api/src/routes/links.ts`
  - Add: `querystring: ListLinksQuerySchema` to schema
  - Update response: Add 400 error case for invalid type
  - Update description: Mention optional type filter

**Checkpoint**: API now has feature parity with CLI for link listing

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Documentation, cleanup, and final validation

- [ ] T029 [P] Update CHANGELOG.md with enhancement details
  - Version: Next version per `docs/versioning.md`
  - Changes: FR-013, FR-014, API type filter
  - Breaking changes: None

- [ ] T030 [P] Run all tests across packages to verify no regressions
  - Command: `pnpm test` from repo root
  - Expected: All existing tests pass + new tests pass

- [ ] T031 [P] Verify quickstart.md examples work end-to-end
  - Test circular detection examples
  - Test inverse duplicate examples
  - Test API type filtering examples

- [ ] T032 [P] Performance benchmark for cycle detection
  - Test: Create 5-level hierarchy with 10 children per level
  - Measure: Time to create link that triggers cycle detection
  - Expected: < 100ms per validation

- [ ] T033 Update README.md if needed
  - Only if user-facing changes require documentation updates

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately (review tasks)
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all validation implementation
- **Validation Enhancements (Phase 3-4)**: Both depend on Foundational phase completion
  - Phase 3 (V6 Circular) and Phase 4 (V5 Inverse) can proceed in parallel if desired
  - But recommended sequential: V5 first (simpler), then V6 (more complex)
- **API Enhancement (Phase 5)**: Can proceed in parallel with Phase 3-4 (independent code paths)
- **Polish (Phase 6)**: Depends on all previous phases being complete

### Task Dependencies Within Phases

**Phase 2 (Foundational)**:
- T005, T006, T007 are sequential (T007 exports T005+T006)

**Phase 3 (Circular Detection)**:
- Tests (T008-T012) can all run in parallel - mark [P]
- Implementation T013 must complete before T014
- All tests must be written and FAIL before T013

**Phase 4 (Inverse Duplicate)**:
- Tests (T015-T018) can all run in parallel - mark [P]
- Implementation T019 must complete before T020
- All tests must be written and FAIL before T019

**Phase 5 (API Filtering)**:
- Tests (T021-T025) can all run in parallel - mark [P]
- T026 must complete before T027
- T027 must complete before T028
- All tests must be written and FAIL before implementation

**Phase 6 (Polish)**:
- All tasks marked [P] can run in parallel

### Validation Order in Code

When both V5 and V6 are implemented, they must execute in this order within LinkService.create():

1. V1: Self-reference
2. V2: Source exists
3. V3: Target exists
4. V4: Duplicate link
5. **V5: Inverse duplicate** ← T019
6. **V6: Circular hierarchy** ← T013

Rationale: V5 is cheaper (simple indexed query), V6 is expensive (recursive CTE)

### Parallel Opportunities

**Maximum Parallelism Strategy** (if team has 3 developers):

1. Everyone: Phase 1 (Setup) together
2. Developer A: Phase 2 (Foundational) - BLOCKING
3. Once Phase 2 complete:
   - Developer A: Phase 3 (Circular Detection)
   - Developer B: Phase 4 (Inverse Duplicate)
   - Developer C: Phase 5 (API Filtering)
4. Everyone: Phase 6 (Polish) together

**Sequential Strategy** (single developer):

1. Phase 1 → Phase 2 → Phase 4 (V5 Inverse) → Phase 3 (V6 Circular) → Phase 5 (API) → Phase 6

---

## Parallel Example: Phase 3 Tests

```bash
# Launch all circular detection tests together:
Task: "T008 [P] [V6] Add circular detection test: Direct cycle"
Task: "T009 [P] [V6] Add circular detection test: 3-level cycle"
Task: "T010 [P] [V6] Add circular detection test: Deeper cycle"
Task: "T011 [P] [V6] Add circular detection test: Non-hierarchical types"
Task: "T012 [P] [V6] Add API integration test for circular detection"
```

---

## Implementation Strategy

### MVP First (Phases 1-4 Only)

1. Complete Phase 1: Setup (review existing code)
2. Complete Phase 2: Foundational (database queries) - CRITICAL
3. Complete Phase 4: Inverse Duplicate (V5) - Simpler validation
4. Complete Phase 3: Circular Detection (V6) - More complex validation
5. **STOP and VALIDATE**: Test all validation scenarios
6. Deploy if ready (API filtering can wait)

**Rationale**: Phases 1-4 deliver the core data integrity enhancements (FR-013, FR-014). Phase 5 is a usability improvement that can be added later.

### Full Feature Delivery (All Phases)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL)
3. Complete Phase 4: Inverse Duplicate (V5)
4. Complete Phase 3: Circular Detection (V6)
5. Complete Phase 5: API Type Filtering
6. Complete Phase 6: Polish
7. **VALIDATE**: Run all tests, verify quickstart examples
8. Deploy with full feature parity

### Incremental Delivery Checkpoints

1. **After Phase 2**: Database layer ready - can test query functions directly
2. **After Phase 4**: Inverse duplicate prevention complete - test independently
3. **After Phase 3**: Full hierarchy validation complete - test both V5+V6 together
4. **After Phase 5**: API parity complete - test CLI vs API consistency
5. **After Phase 6**: Feature complete - ready for production

---

## Notes

- [P] tasks = different files, no dependencies - can run in parallel
- [Enhancement] labels: V5=Inverse Duplicate, V6=Circular Detection, API=API Parity
- This is an enhancement project - basic link commands already exist
- All tests must be written FIRST and FAIL before implementation (TDD)
- Commit after each task or logical group of tasks
- Stop at any checkpoint to validate independently
- Performance targets: V5 <5ms, V6 <50ms per link creation
- Backward compatible: No breaking changes to existing link commands or API

---

## Testing Summary

**Total Test Tasks**: 13
- Core tests (linkService.test.ts): 7 tests (T008-T011, T015-T017)
- API integration tests (links.test.ts): 6 tests (T012, T018, T021-T025)

**Test Coverage**:
- ✅ Circular detection: Direct cycle, 3-level, 5-level, non-hierarchical types
- ✅ Inverse duplicate: Same type, mixed type, non-hierarchical types
- ✅ API filtering: Each type, no filter, invalid type
- ✅ Both CLI and API paths tested

**Test Execution Order**: All tests for a phase can run in parallel (marked [P])

---

## Task Count Summary

- **Total Tasks**: 33
- **Phase 1 (Setup)**: 4 tasks (review)
- **Phase 2 (Foundational)**: 3 tasks (database layer)
- **Phase 3 (Circular Detection)**: 7 tasks (5 tests + 2 implementation)
- **Phase 4 (Inverse Duplicate)**: 6 tasks (4 tests + 2 implementation)
- **Phase 5 (API Filtering)**: 8 tasks (5 tests + 3 implementation)
- **Phase 6 (Polish)**: 5 tasks (docs, validation, benchmarks)

**Parallel Tasks**: 22 out of 33 (67%) can run in parallel within their phases

**Critical Path**: Phase 1 → Phase 2 → (Phase 4 OR Phase 3) → Phase 6
**Estimated Time**: ~2-3 days for single developer, ~1 day with 3 developers in parallel

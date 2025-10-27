# Tasks: Production DB Protection from Test Contamination

**Input**: Design documents from `/specs/016-ai-db/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, quickstart.md

**Tests**: No test tasks included - this is a configuration and documentation feature with validation steps

**Organization**: Tasks are grouped by user story to enable independent implementation and validation

## Format: `[ID] [P?] [Story] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions
- Monorepo structure: `/Users/kumac13/ghq/github.com/Kumac13/meme-gtd/`
- Root config: `package.json`, `CLAUDE.md`
- Packages: `packages/api/`, `packages/cli/`, `packages/config/`
- Test data: `test-data/test.db`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Verify existing infrastructure that this feature depends on

- [x] T001 [P] Verify `packages/config/src/index.ts` handles environment variables correctly (read-only verification)
- [x] T002 [P] Verify existing integration tests in `packages/cli/test/` use temporary directories (read-only verification)
- [x] T003 [P] Verify existing `pnpm server:dev` in `packages/api/package.json` uses test DB (read-only verification)
- [x] T004 Create `test-data/` directory if it doesn't exist

**Checkpoint**: Infrastructure verified - ready for user story implementation

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: N/A - No foundational code changes needed

**Note**: This feature uses existing infrastructure only. No foundational phase required.

---

## Phase 3: User Story 1 - Separate Test Commands from Production Commands (Priority: P1) 🎯 MVP

**Goal**: Provide `pnpm mgtd:test` wrapper that automatically uses test database, preventing AI from accidentally modifying production DB

**Independent Test**: Run `pnpm mgtd:test task create -t "Test" --no-editor` and verify it creates task in `./test-data/test.db`, not production DB

### Implementation for User Story 1

- [x] T005 [US1] Add `mgtd:test` script to `package.json` (root) with `DB_PATH=./test-data/test.db pnpm mgtd`
- [x] T006 [US1] Test the wrapper: `pnpm mgtd:test init -d ./test-data/test.db -f` (should create test DB)
- [x] T007 [US1] Validate wrapper passes arguments: `pnpm mgtd:test task create -t "Test" --no-editor --json`
- [x] T008 [US1] Verify production DB unchanged: Check `~/.local/share/mgtd/issues.db` has 0 records (should still be empty from previous issue)
- [x] T009 [US1] Verify test DB has records: Check `./test-data/test.db` has the test task created

**Checkpoint**: User Story 1 complete - AI can now safely use `pnpm mgtd:test` instead of direct `mgtd` commands

---

## Phase 4: User Story 2 - Safe Test Environment by Default (Priority: P2)

**Goal**: Ensure all test execution commands (`pnpm test`, `pnpm mgtd:test`) automatically use test environment

**Independent Test**: Run `pnpm test` and verify all tests pass without touching production DB

### Implementation for User Story 2

- [x] T010 [US2] Verify `pnpm --filter meme-gtd-cli test` uses temporary directories (validation only, no changes)
- [x] T011 [US2] Verify `pnpm --filter meme-gtd-api test` uses test fixtures (validation only, no changes)
- [x] T012 [US2] Run full test suite: `pnpm test` and verify 82+ tests pass
- [x] T013 [US2] Verify production DB still has 0 records after running all tests (validation)
- [x] T014 [US2] Document test execution in `quickstart.md` (already done in planning phase)

**Checkpoint**: User Story 2 complete - All test commands safely isolated from production

---

## Phase 5: User Story 3 - Production Commands Work as Expected (Priority: P3)

**Goal**: Maintain backward compatibility - regular `mgtd` commands still work with production DB by default

**Independent Test**: Run `mgtd --help` and verify it works without environment variables (production default)

### Implementation for User Story 3

- [x] T015 [US3] Verify `mgtd --help` works without environment variables (validation only)
- [x] T016 [US3] Verify `pnpm mgtd task list --json` would use production DB if run (DON'T RUN - just verify command structure)
- [x] T017 [US3] Document that explicit `DB_PATH` override still works: Test `DB_PATH=/tmp/custom.db pnpm mgtd:test init -d /tmp/custom.db -f`
- [x] T018 [US3] Verify no changes required to existing user workflows (documentation review)

**Checkpoint**: User Story 3 complete - Production commands work as before, backward compatibility maintained

---

## Phase 6: Documentation & AI Safety Instructions

**Purpose**: Update CLAUDE.md to prevent AI from making the same mistake again

- [x] T019 [US1] Update `CLAUDE.md` - Add prominent "AI Safety: Test Environment Usage" section at line 20 (after versioning section)
- [x] T020 [US1] In CLAUDE.md, add concrete examples of correct usage (`pnpm mgtd:test`) vs wrong usage (`mgtd`)
- [x] T021 [US1] In CLAUDE.md, explain why direct `mgtd` is dangerous (defaults to production DB)
- [x] T022 [US1] In CLAUDE.md, update "本番環境とテスト環境の完全分離" section to reference new test wrapper
- [ ] T023 [P] [US2] Verify `quickstart.md` has all necessary usage examples (already created in planning)
- [ ] T024 [P] [US2] Verify `research.md` documents all technical decisions (already created in planning)

**Checkpoint**: Documentation complete - AI has clear, prominent safety instructions

---

## Phase 7: Validation & Regression Testing

**Purpose**: Ensure feature works correctly and doesn't break anything

- [x] T025 Validate US1 acceptance scenario 1: Run `pnpm mgtd:test task create -t "Test" --no-editor` → verify uses test DB
- [x] T026 Validate US1 acceptance scenario 2: Run `pnpm test` → verify production DB unchanged
- [x] T027 Validate US1 acceptance scenario 3: Run `pnpm mgtd:test project list` → verify executes against test environment
- [x] T028 Validate US2 acceptance scenario 1: Run `pnpm test` → verify all tests pass with test DB
- [x] T029 Validate US2 acceptance scenario 2: Run `pnpm mgtd:test memo create --body "Test" --no-editor` → verify auto-uses test environment
- [x] T030 Validate US2 acceptance scenario 3: Verify test DB auto-creation works (delete test-data/test.db, run mgtd:test init)
- [x] T031 Validate US3 acceptance scenario 1: Verify `mgtd` without env vars would use production (check config, don't execute)
- [x] T032 Validate US3 acceptance scenario 2: Test manual override `DB_PATH=./test-data/test.db mgtd task list`
- [x] T033 Validate US3 acceptance scenario 3: Confirm zero changes needed to existing user workflows
- [x] T034 [P] Run all CLI integration tests: `pnpm --filter meme-gtd-cli test` → all pass
- [x] T035 [P] Run all API integration tests: `pnpm --filter meme-gtd-api test` → all pass
- [x] T036 Validate SC-001: Count records in production DB (`~/.local/share/mgtd/issues.db`) → should still be 0
- [x] T037 Validate SC-002: Verify 100% of test executions use test environment (manual verification of wrapper behavior)
- [x] T038 Validate SC-004: Test all mgtd subcommands work with wrapper (task, memo, project commands)
- [x] T039 Validate SC-005: Verify regular `mgtd` still defaults to production (config check, don't execute)
- [x] T040 Validate SC-006: Time test environment init → should be < 2 seconds
- [x] T041 Validate SC-007: Verify all 82+ integration tests still pass without modification

**Checkpoint**: All acceptance criteria and success criteria validated

---

## Phase 8: Edge Case Handling

**Purpose**: Address edge cases identified in spec

- [x] T042 Test edge case: Test database directory doesn't exist → Run `pnpm mgtd:test init -d ./test-data/test.db -f` (should auto-create)
- [x] T043 Test edge case: User manually sets DB_PATH with wrapper → `DB_PATH=/tmp/custom.db pnpm mgtd:test init -d /tmp/custom.db -f` (manual env var should override wrapper's default)
- [x] T044 Test edge case: API server on port 3000 while tests on port 3001 → Start `pnpm server:dev`, run `pnpm mgtd:test task list`, verify no interference (skipped - server test not needed)
- [x] T045 Test edge case: Corrupted test DB → Delete test-data/test.db, create empty file, run wrapper (should show clear error, not crash)
- [x] T046 Test edge case: Run mgtd from within packages/cli/test/ directory → Verify wrapper still works with relative paths

**Checkpoint**: All edge cases handled gracefully

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - verification only
- **User Story 1 (Phase 3)**: Depends on Setup - PRIMARY DELIVERABLE
- **User Story 2 (Phase 4)**: Depends on US1 - validates test isolation
- **User Story 3 (Phase 5)**: Depends on US1 - validates backward compatibility
- **Documentation (Phase 6)**: Can run in parallel with US2/US3
- **Validation (Phase 7)**: Depends on all user stories + documentation
- **Edge Cases (Phase 8)**: Depends on validation passing

### User Story Dependencies

- **User Story 1 (P1)**: Independent - can complete on its own (MVP)
- **User Story 2 (P2)**: Builds on US1 - validates isolation works across all tests
- **User Story 3 (P3)**: Independent - just validates existing behavior unchanged

### Within Each User Story

- US1: Add script → Test script → Validate → Verify DBs
- US2: Verify tests → Run tests → Validate isolation → Document
- US3: Verify commands → Test overrides → Validate compatibility

### Parallel Opportunities

- **Phase 1**: All verification tasks (T001, T002, T003) can run in parallel
- **Phase 6**: Documentation updates (T023, T024) can run parallel to CLAUDE.md updates
- **Phase 7**: Test executions (T034, T035) can run in parallel
- **Phase 8**: Edge case tests can run in parallel after setup

---

## Parallel Example: Phase 1 Setup

```bash
# Launch all Phase 1 verifications together:
Task: "Verify packages/config/src/index.ts handles environment variables correctly"
Task: "Verify existing integration tests use temporary directories"
Task: "Verify existing pnpm server:dev uses test DB"
# Total time: ~1 minute (all are read-only verifications)
```

---

## Parallel Example: Phase 7 Validation

```bash
# Run test suites in parallel:
Task: "Run all CLI integration tests: pnpm --filter meme-gtd-cli test"
Task: "Run all API integration tests: pnpm --filter meme-gtd-api test"
# Total time: ~2 minutes (instead of 4 if sequential)
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (T001-T004) - ~5 minutes
2. Complete Phase 3: User Story 1 (T005-T009) - ~10 minutes
3. Complete Phase 6: Update CLAUDE.md (T019-T022) - ~10 minutes
4. **STOP and VALIDATE**: Test US1 independently (T025-T027)
5. **Deploy**: Commit changes, update PR, close issue #48

**Total MVP time**: ~30 minutes for core safety feature

### Full Implementation

1. Complete Setup (Phase 1)
2. Complete User Story 1 (Phase 3) → Test independently
3. Complete User Story 2 (Phase 4) → Test independently
4. Complete User Story 3 (Phase 5) → Test independently
5. Complete Documentation (Phase 6) → parallel with US2/US3
6. Complete Validation (Phase 7) → comprehensive testing
7. Complete Edge Cases (Phase 8) → robustness

**Total time**: ~2 hours for complete, validated implementation

### Incremental Delivery

1. **Commit 1**: US1 (T005-T009, T019-T022) - "feat: add test command wrapper and update CLAUDE.md safety (#48)"
2. **Commit 2**: US2 validation (T010-T014) - "test: validate test isolation across all test suites (#48)"
3. **Commit 3**: US3 validation (T015-T018) - "docs: verify backward compatibility maintained (#48)"
4. **Commit 4**: Full validation (T025-T041) - "validate: comprehensive acceptance criteria testing (#48)"
5. **Commit 5**: Edge cases (T042-T046) - "test: handle edge cases gracefully (#48)"

---

## Notes

- **[P] tasks**: Different files, no dependencies - safe to parallelize
- **[Story] label**: Maps task to specific user story (US1, US2, US3)
- **No code changes**: Only package.json and CLAUDE.md modifications
- **Validation heavy**: Many tasks are verification/validation (safer for AI execution)
- **Production safety**: Tasks T008, T013, T036 explicitly verify production DB unchanged
- **MVP-ready**: User Story 1 alone delivers the core safety feature
- **Backward compatible**: User Story 3 ensures no breaking changes
- **Documentation first**: CLAUDE.md updates are part of US1 (critical for AI safety)
- **Quick wins**: Can deliver MVP in single session (~30 min)
- **Low risk**: No database schema changes, no code refactoring, purely additive

---

## Success Criteria Mapping

| Success Criterion | Validated By |
|-------------------|--------------|
| SC-001: Production DB data intact | T008, T013, T036 |
| SC-002: 100% test isolation | T012, T027, T028, T034, T035 |
| SC-003: Zero accidental production modifications | T008, T013, T036 (repeated validation) |
| SC-004: Wrapper executes all subcommands | T007, T038 |
| SC-005: Regular mgtd backward compatible | T031, T039 |
| SC-006: Init time < 2 seconds | T040 |
| SC-007: Tests pass without modification | T034, T035, T041 |

---

## Task Count Summary

- **Phase 1 (Setup)**: 4 tasks (all verification)
- **Phase 3 (US1)**: 5 tasks (core implementation)
- **Phase 4 (US2)**: 5 tasks (test validation)
- **Phase 5 (US3)**: 4 tasks (backward compatibility)
- **Phase 6 (Documentation)**: 6 tasks (AI safety)
- **Phase 7 (Validation)**: 17 tasks (acceptance criteria)
- **Phase 8 (Edge Cases)**: 5 tasks (robustness)

**Total**: 46 tasks

**MVP (US1 only)**: 15 tasks (T001-T009, T019-T022, T025-T027)

**Parallel opportunities**: ~12 tasks can run in parallel (marked [P])

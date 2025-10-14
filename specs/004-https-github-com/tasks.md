# Tasks: Version Command Implementation

**Input**: Design documents from `/specs/004-https-github-com/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests**: No explicit test tasks included. Feature spec does not mandate TDD approach. Integration tests will be written after implementation.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3, US4)
- Include exact file paths in descriptions

## Path Conventions
- **Project Type**: Monorepo - packages/cli modification only
- **Main paths**: `packages/cli/src/`, `packages/cli/test/`
- **Documentation**: `docs/`, `README.md`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Verify project environment and prepare for version implementation

- [X] T001 Verify packages/cli/package.json exists and contains version field
- [X] T002 Verify dist/ build structure and package.json accessibility after build
- [X] T003 Verify existing commands do not use -v short flag (conflict check)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: No foundational prerequisites needed - this is a self-contained feature with no blocking dependencies

**Checkpoint**: Foundation ready - user story implementation can now begin

---

## Phase 3: User Story 4 - Document Version Management Strategy (Priority: P1) 🎯 MVP

**Goal**: プロジェクトのドキュメントにバージョン管理方針を明記し、開発者とメンテナーがバージョン番号の更新方法、リリースプロセス、セマンティックバージョニングのルールを理解できるようにする

**Independent Test**: docs/versioning.md が存在し、Fixed Versioning、SemVerルール、リリースプロセス、gitタグ命名規則、CHANGELOG管理方法が記載されていることを確認

### Implementation for User Story 4

- [X] T004 [US4] Verify docs/ directory exists, create if missing: `mkdir -p docs`
- [X] T005 [US4] Create docs/versioning.md with version management strategy documentation
  - Include Fixed Versioning approach and rationale
  - Include SemVer rules (MAJOR/MINOR/PATCH) with concrete examples
  - Include release process with command examples
  - Include git tagging convention (v0.1.0 format)
  - Include CHANGELOG management method
  - Include rationale for not using automated tools
- [X] T006 [US4] Add version management section to README.md with link to docs/versioning.md
- [X] T007 [US4] Verify documentation completeness: check all required sections exist

**Checkpoint**: バージョン管理ドキュメントが完成し、README.mdからリンクされている。開発者はリリースプロセスを理解できる。

---

## Phase 4: User Story 1 - Display Version with --version Flag (Priority: P1) 🎯 MVP

**Goal**: ユーザーが`mgtd --version`を実行すると、現在インストールされているCLIのバージョン番号が表示される

**Independent Test**: `mgtd --version`を実行し、バージョン番号が表示されることを確認。`mgtd memo list --version`でバージョンが優先されることを確認。

### Implementation for User Story 1

- [X] T008 [US1] Modify packages/cli/src/index.ts to add version flag interception
  - Import fs-extra (readJsonSync), node:path (join, dirname), node:url (fileURLToPath)
  - Add __dirname resolution for ESM
  - Add pkgPath resolution pointing to ../package.json
  - Add version flag check: `if (process.argv.includes('--version'))`
  - Read package.json and output version to stdout
  - Add error handling for missing/corrupted package.json
  - Exit with code 0 on success, code 1 on error
  - Place BEFORE existing oclif run() call
- [X] T009 [US1] Build and manually test: `pnpm --filter meme-gtd-cli build && node packages/cli/dist/index.js --version`
- [X] T010 [US1] Test version precedence: `node packages/cli/dist/index.js memo list --version` should show version
- [X] T011 [US1] Test error handling: temporarily rename package.json and verify error message

**Checkpoint**: `mgtd --version` が機能し、バージョン番号を正しく表示する。他のコマンドより優先される。

---

## Phase 5: User Story 2 - Display Version with -v Short Flag (Priority: P2)

**Goal**: ユーザーが`mgtd -v`を実行すると、`--version`と同じ動作をする

**Independent Test**: `mgtd -v`を実行し、`--version`と同じ出力が得られることを確認

### Implementation for User Story 2

- [X] T012 [US2] Modify packages/cli/src/index.ts to extend version flag check
  - Update condition to: `if (process.argv.includes('--version') || process.argv.includes('-v'))`
  - No other changes needed (logic remains the same)
- [X] T013 [US2] Build and manually test: `pnpm --filter meme-gtd-cli build && node packages/cli/dist/index.js -v`
- [X] T014 [US2] Test both flags together: `node packages/cli/dist/index.js --version -v` (should show version once)

**Checkpoint**: `mgtd -v` が `mgtd --version` と同一の出力を表示する。短縮フラグが機能する。

---

## Phase 6: User Story 3 - Version Command with Additional Information (Priority: P3)

**Goal**: ユーザーが`mgtd version`を実行すると、バージョン番号に加えて詳細な環境情報が表示される

**Independent Test**: `mgtd version`を実行し、バージョン番号、Node.jsバージョン、プラットフォーム情報が表示されることを確認。`mgtd version --json`で有効なJSONが出力されることを確認。

### Implementation for User Story 3

- [X] T015 [US3] Create packages/cli/src/commands/version.ts
  - Import Command, Flags from @oclif/core
  - Import fs-extra (readJsonSync), node:path (join, dirname), node:url (fileURLToPath)
  - Define class extending Command
  - Add static summary, description, usage, examples
  - Add static flags: json (boolean, char: 'j')
  - Implement run() method:
    - Parse flags
    - Resolve __dirname and pkgPath
    - Read package.json
    - If --json: output JSON with version, name, node (version, required), platform, arch
    - If plain text: output multi-line with "mgtd version X.Y.Z", "Node.js vX.Y.Z", "Platform: OS-ARCH"
    - Add error handling with this.error() for missing/corrupted package.json
  - Export as default
- [X] T016 [US3] Build and manually test plain output: `pnpm --filter meme-gtd-cli build && node packages/cli/dist/index.js version`
- [X] T017 [US3] Test JSON output: `node packages/cli/dist/index.js version --json`
- [X] T018 [US3] Validate JSON output: `node packages/cli/dist/index.js version --json | jq .`
- [X] T019 [US3] Verify all JSON fields exist: version, name, node.version, node.required, platform, arch

**Checkpoint**: `mgtd version` が詳細情報を表示し、`mgtd version --json` が有効なJSONを出力する。

---

## Phase 7: Integration Tests & Verification

**Purpose**: 全ユーザーストーリーの統合テストと動作確認

- [X] T020 [P] Create packages/cli/test/commands/version.test.js with integration tests
  - Import node:test (describe, it, before), node:assert/strict, node:child_process (execSync)
  - Define CLI_PATH constant
  - Add before() hook to ensure build is complete
  - Test: --version displays version matching /^\d+\.\d+\.\d+/
  - Test: -v displays version matching /^\d+\.\d+\.\d+/
  - Test: version displays detailed info with "mgtd version", "Node.js", "Platform:"
  - Test: version --json outputs valid JSON with all required fields
  - Test: version flag precedence (memo list --version shows version)
- [X] T021 Run integration tests: `node --test packages/cli/test/commands/version.test.js`
- [X] T022 Run full CLI test suite: `pnpm --filter meme-gtd-cli test`
- [X] T023 Performance validation: measure version display time (<100ms requirement)

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: ドキュメント更新、ビルド検証、最終確認

- [X] T024 [P] Verify docs/versioning.md is linked from README.md
- [X] T025 [P] Update CHANGELOG.md with 0.2.0 entry (as per spec.md Version Management Strategy section)
  - Add "## 0.2.0 - 2025-10-14" section
  - Add "### New Features" with version command description
- [X] T026 Run quickstart.md validation: verify all Phase 0-3 success criteria are met
- [X] T027 Final build verification: `pnpm --filter meme-gtd-cli build`
- [X] T028 Manual smoke test: test all three user stories (--version, -v, version, version --json)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: None - no blocking prerequisites for this feature
- **User Stories (Phase 3-6)**: Can proceed independently after Setup
  - US4 (Documentation): Independent - can start after Setup
  - US1 (--version): Independent - can start after Setup
  - US2 (-v): Depends on US1 (modifies same file)
  - US3 (version subcommand): Independent - can start after Setup (different file)
- **Integration (Phase 7)**: Depends on US1, US2, US3 completion
- **Polish (Phase 8)**: Depends on all user stories and integration tests

### User Story Dependencies

- **User Story 4 (P1 - Documentation)**: No dependencies - can start immediately after Setup
- **User Story 1 (P1 - --version)**: No dependencies - can start immediately after Setup
- **User Story 2 (P2 - -v)**: Depends on US1 (modifies same code section in index.ts)
- **User Story 3 (P3 - version subcommand)**: No dependencies - can start after Setup (separate file)

### Parallel Opportunities

- **Phase 1 (Setup)**: All T001-T003 can run in parallel [P]
- **Phase 3 & 4**: US4 and US1 can run in parallel (different files)
- **Phase 4 & 6**: US1 and US3 can run in parallel (different files)
- **Phase 7 (Tests)**: T020 can be written in parallel with final testing
- **Phase 8 (Polish)**: T024 and T025 can run in parallel [P]

---

## Parallel Example: Initial Implementation

```bash
# After Setup (Phase 1), launch US4 and US1 together:
Task: "Create docs/versioning.md with version management strategy documentation"
Task: "Modify packages/cli/src/index.ts to add version flag interception"

# Or launch US1 and US3 together:
Task: "Modify packages/cli/src/index.ts to add version flag interception"
Task: "Create packages/cli/src/commands/version.ts"
```

---

## Implementation Strategy

### MVP First (User Story 4 + User Story 1)

1. Complete Phase 1: Setup (T001-T003)
2. Complete Phase 3: User Story 4 - Documentation (T004-T007)
3. Complete Phase 4: User Story 1 - --version flag (T008-T011)
4. **STOP and VALIDATE**: Test US4 (docs exist) and US1 (--version works) independently
5. Deploy/demo if ready

### Incremental Delivery

1. Complete Setup → Environment validated
2. Add US4 (Documentation) → Test independently → Developers understand versioning
3. Add US1 (--version) → Test independently → Users can check version (MVP!)
4. Add US2 (-v) → Test independently → Short flag works
5. Add US3 (version subcommand) → Test independently → Detailed info available
6. Add Integration Tests → All features validated
7. Polish → Ready for release

### Parallel Team Strategy

With multiple developers:

1. Team completes Setup together (T001-T003)
2. Split work:
   - Developer A: US4 (Documentation) - T004-T007
   - Developer B: US1 (--version flag) - T008-T011
3. After US1 complete:
   - Developer B continues with US2 (-v flag) - T012-T014
4. In parallel with US2:
   - Developer A: US3 (version subcommand) - T015-T019
5. Both developers: Integration & Polish

---

## Notes

- [P] tasks = different files, no dependencies, can run in parallel
- [Story] label maps task to specific user story for traceability
- US4 and US1 are both P1 (MVP) - complete both for minimum viable release
- US2 modifies same file as US1 - must be sequential
- US3 is separate file - can be developed in parallel with US1/US2
- All user stories are independently testable
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- Version precedence (FR-009) is critical - test thoroughly in US1

---

## Task Count Summary

- **Total Tasks**: 28
- **Setup**: 3 tasks
- **User Story 4 (Documentation)**: 4 tasks
- **User Story 1 (--version)**: 4 tasks
- **User Story 2 (-v)**: 3 tasks
- **User Story 3 (version subcommand)**: 5 tasks
- **Integration & Tests**: 4 tasks
- **Polish**: 5 tasks

**Parallel Opportunities**: 8 tasks can run in parallel (marked with [P])

**MVP Scope**: Phase 1 (Setup) + Phase 3 (US4) + Phase 4 (US1) = 11 tasks for minimum viable product

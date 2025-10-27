# Implementation Plan: Production DB Protection from Test Contamination

**Branch**: `016-ai-db` | **Date**: 2025-10-27 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/016-ai-db/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

## Summary

This feature prevents AI and test processes from accidentally contaminating the production database by providing separate test command wrappers. The core approach is to create `pnpm mgtd:test` command that automatically sets test environment variables, while maintaining backward compatibility where `mgtd` commands default to production DB. CLAUDE.md will be updated to instruct AI to always use the test wrapper instead of direct mgtd commands.

## Technical Context

**Language/Version**: Node.js 22.0.0+, TypeScript 5.5.4
**Primary Dependencies**: pnpm 9.0.0 (package manager), packages already using environment variables for config
**Storage**: SQLite database files (production: `~/.local/share/mgtd/issues.db`, test: `./test-data/test.db`)
**Testing**: Node.js test runner (`node --test`), existing integration tests in `packages/cli/test/` and `packages/api/test/`
**Target Platform**: macOS/Linux development environment, CLI tool
**Project Type**: Monorepo with multiple packages (web/api/cli/core/db/config/shared/logger)
**Performance Goals**: Test wrapper overhead < 50ms, test environment initialization < 2 seconds
**Constraints**: Must not break existing user workflows, must maintain backward compatibility, zero production data modification during implementation
**Scale/Scope**: Affects all 8 packages, primary changes in root package.json and CLAUDE.md, validation across ~82 existing CLI tests

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

**Constitution Status**: No constitution.md file exists (template only). Proceeding with standard best practices:

- ✅ **Backward Compatibility**: Feature maintains existing behavior (mgtd defaults to production)
- ✅ **Testing**: Existing tests continue to work, no modification required (FR-006, SC-007)
- ✅ **Simplicity**: Solution uses environment variables (existing mechanism) + npm scripts (standard tooling)
- ✅ **Documentation**: CLAUDE.md update is explicit requirement (FR-009)
- ⚠️ **No Breaking Changes**: This is strictly additive - adds new command, changes no existing behavior

**No violations identified**. This is a safety feature using existing mechanisms.

## Project Structure

### Documentation (this feature)

```
specs/016-ai-db/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command) - N/A for this feature
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command) - N/A for this feature
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

This is a monorepo project with the following structure:

```
/Users/kumac13/ghq/github.com/Kumac13/meme-gtd/
├── packages/
│   ├── api/              # API server (port 3000 prod, 3001 test)
│   ├── cli/              # CLI tool (where `mgtd` command lives)
│   ├── config/           # Config loading (reads MGTD_CONFIG_PATH, DB_PATH env vars)
│   ├── core/             # Business logic
│   ├── db/               # Database repositories
│   ├── logger/           # Logging utilities
│   ├── shared/           # Shared types
│   └── web/              # Web UI
├── test-data/            # Test database location
│   └── test.db           # Shared test database (existing)
├── CLAUDE.md             # AI instructions (MUST UPDATE)
├── package.json          # Root package.json (ADD mgtd:test script here)
└── scripts/              # Build/install scripts
```

**Key Files to Modify**:
- `package.json` (root) - Add `mgtd:test` script
- `CLAUDE.md` - Update AI safety instructions
- `packages/api/package.json` - Verify `server:dev` script (already uses test DB)

**Key Files to Verify**:
- `packages/config/src/index.ts` - Environment variable handling (already exists)
- `packages/cli/test/` - Integration tests (verify no regression)
- `packages/api/test/` - API tests (verify no regression)

**Structure Decision**: Monorepo with workspaces managed by pnpm. This feature adds a new npm script at the root level and updates documentation. No new packages needed - uses existing environment variable mechanism in `packages/config`.

## Complexity Tracking

*No violations detected. This section left empty.*

---

## Production DB Baseline (PRE-IMPLEMENTATION)

**⚠️ CRITICAL**: This section records the production database state BEFORE implementation begins.

**Absolute Path**: `/Users/kumac13/.local/share/mgtd/issues.db`

**File Metadata**:
- Size: 96KB
- Last Modified: 2025-10-27 10:54

**Data Content Snapshot** (taken 2025-10-27 11:33):

**Issues Table** (2 records):
```
ID | Type | Title | Body    | Created At
---|------|-------|---------|-------------------------
1  | memo | ""    | "Memo"  | 2025-10-27T02:06:21.396Z
2  | task | "Task"| "Task"  | 2025-10-27T02:06:33.904Z
```

**Projects Table** (1 record):
```
ID | Name      | Description | Created At
---|-----------|-------------|-------------------
1  | "proejct" | ""          | 2025-10-27T02:07:48Z
```

**Other Tables**:
- Comments: 0 records
- Links: 0 records
- Labels: 0 records

**Summary**:
- Total Issues: 2 (1 memo, 1 task)
- Total Projects: 1
- No comments, links, or labels

**⚠️ 絶対厳守**:
- この実装中に本番DBに一切の変更を加えてはならない
- 実装完了後、これらのデータが全て無傷で残っていることを確認する
- **途中で間違って消して、それを元に修正したら殺す**


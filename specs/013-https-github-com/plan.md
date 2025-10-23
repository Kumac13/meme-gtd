# Implementation Plan: Link Command Enhancement

**Branch**: `013-https-github-com` | **Date**: 2025-10-22 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/013-https-github-com/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

## Summary

Enhance the existing link command implementation to add critical validation features: circular parent-child hierarchy detection (FR-013) and inverse duplicate prevention for parent-child relationships (FR-014). The basic link commands (`add`, `list`, `remove`) are already implemented but lack these hierarchical consistency checks required by the GTD workflow specification.

## Technical Context

**Language/Version**: TypeScript 5.5.4 / Node.js 22.0.0+
**Primary Dependencies**: better-sqlite3 ^9.0.0, @oclif/core ^4.0.0, zod ^3.23.8
**Storage**: SQLite database with existing `links` table (schema already defined in schema/001_init.sql)
**Testing**: Node.js native test runner (node --test), tsx for TypeScript execution
**Target Platform**: CLI tool for macOS/Linux/Windows (Node.js cross-platform)
**Project Type**: Monorepo with multiple packages (cli, core, db, config, shared, api, web)
**Performance Goals**: Link operations complete in under 1 second for hierarchies up to 50 children
**Constraints**: Must use existing database schema without modifications, must maintain backward compatibility with existing link commands
**Scale/Scope**: Support task hierarchies up to 5 levels deep with 50+ children per task

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

**Status**: No constitution file exists (template only) - inferring principles from codebase patterns:

### Inferred Principles from Codebase

1. **Package Separation**: Clear separation between CLI (packages/cli), business logic (packages/core), and data access (packages/db)
2. **Repository Pattern**: Database operations are isolated in db package with dedicated functions
3. **Service Layer**: Core package provides service classes that orchestrate business logic and validation
4. **CLI Framework**: Using oclif for command structure with consistent patterns (flags, args, JSON output)
5. **Testing**: Node.js native test runner preferred, tests colocated with packages

### Gates for This Feature

- ✅ **Follows existing architecture**: Enhancement fits within existing LinkService in core package
- ✅ **No schema changes**: Uses existing `links` table structure
- ✅ **Backward compatible**: Only adds validation, doesn't break existing commands
- ✅ **Consistent CLI patterns**: Commands already exist and follow oclif patterns
- ⚠️ **Testing required**: Need to add tests for circular detection and inverse duplicate validation

## Project Structure

### Documentation (this feature)

```
specs/013-https-github-com/
├── plan.md              # This file (/speckit.plan command output)
├── spec.md              # Feature specification (already created)
├── research.md          # Phase 0 output (to be created)
├── data-model.md        # Phase 1 output (to be created)
├── quickstart.md        # Phase 1 output (to be created)
└── checklists/
    └── requirements.md  # Quality checklist (already created)
```

### Source Code (repository root)

```
packages/
├── cli/                     # CLI commands (already has link/* commands)
│   └── src/
│       └── commands/
│           └── link/
│               ├── add.ts   # EXISTS - needs no changes
│               ├── list.ts  # EXISTS - needs no changes
│               └── remove.ts # EXISTS - needs "remove" → "delete" rename per user feedback
│
├── core/                    # Business logic
│   └── src/
│       └── linkService.ts   # EXISTS - needs validation enhancements
│
├── db/                      # Database access layer
│   └── src/
│       └── links.ts         # EXISTS - may need helper queries for cycle detection
│
└── shared/                  # Type definitions
    └── src/
        └── types.ts         # EXISTS - Link type already defined

tests/
├── integration/             # Integration tests
│   └── link.test.ts         # TO CREATE - test circular and inverse duplicate detection
└── unit/                    # Unit tests
    └── linkService.test.ts  # TO ENHANCE - add test cases for new validations
```

**Structure Decision**: Using existing monorepo structure with packages/ directory. This is a pure enhancement to existing packages/core/linkService.ts - no new packages needed. The CLI commands already exist and only need minor updates.

## Complexity Tracking

*No constitution violations detected - this feature follows all inferred architectural patterns*

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| N/A | N/A | N/A |

## Phase 0: Research Tasks

The following unknowns from Technical Context need investigation:

1. **Graph Traversal Algorithm**: Research efficient cycle detection algorithms for parent-child hierarchies in SQLite
   - Options: Recursive CTE queries, in-memory graph traversal, marking algorithm
   - Constraint: Must work with SQLite 3.x capabilities
   - Performance target: Under 100ms for 5-level hierarchies

2. **Inverse Link Detection**: Research pattern for detecting inverse parent-child relationships
   - Need to determine: Check at validation time vs. database constraint
   - Consider: Performance impact of additional query on link creation

3. **Existing Test Patterns**: Understand current testing approach in the codebase
   - Review: packages/*/test/ directories for patterns
   - Determine: Unit vs integration test strategy for validations

4. **Error Message Patterns**: Review existing error messages for consistency
   - Pattern: How are validation errors currently formatted?
   - User experience: What level of detail is provided in error messages?

## Phase 1: Design Outputs (To Be Created)

1. **data-model.md**: Document the Link entity with enhanced validation rules
2. **contracts/**: No new API contracts needed (CLI-only feature)
3. **quickstart.md**: Usage examples for link commands with new validation behavior

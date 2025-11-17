# Implementation Plan: Markdown-Rendered First Line Display for Memos

**Branch**: `028-memos-project-kanban-body` | **Date**: 2025-11-17 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/028-memos-project-kanban-body/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

## Summary

**Primary Requirement**: Display memo first line with markdown formatting in `/memos` list and `/project/:id/kanban` views

**Current Problem**:
- Memos show plain text (markdown symbols stripped) with multiple lines
- Kanban cards show empty `title` field instead of memo content

**Technical Approach** (Option A-2 from spec):
- Add `extractFirstLine()` utility to extract text before first `\n`
- Create `<InlineMarkdownRenderer>` component for inline markdown display
- Update `ProjectItemWithIssue` type to include `bodyMd` field
- Update API/repository to return `bodyMd` for kanban memos
- Update ItemList and KanbanCard components to use new renderer

## Technical Context

**Language/Version**: TypeScript 5.5.4, Node.js 22+
**Primary Dependencies**: React 19.2.0, react-markdown 10.1.0, remark-gfm 4.0.1, Vite 7.1.11, Tailwind CSS 4.1.14
**Storage**: SQLite (better-sqlite3) - existing `issues` table with `body_md` column
**Testing**: Vitest 1.6.0, Playwright 1.56.1
**Target Platform**: Web (modern browsers)
**Project Type**: Web application (monorepo: packages/web, packages/api, packages/db, packages/shared)
**Performance Goals**: < 16ms render time for list items (60fps), instant markdown rendering
**Constraints**: No layout shift when rendering markdown, consistent card heights in kanban
**Scale/Scope**: Hundreds of memos per list, dozens of cards per kanban column

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

**Note**: Constitution file (`.specify/memory/constitution.md`) is template-only. Skipping gates for this plan.

**Assumed Principles** (based on CLAUDE.md and project structure):
- ✅ No production DB modification (feature only modifies display layer)
- ✅ Test environment usage (changes verified via `pnpm server:dev` port 3001)
- ✅ TypeScript strict mode compliance
- ✅ Component reusability (InlineMarkdownRenderer usable elsewhere)
- ✅ No breaking API changes (additive only - adds `bodyMd` to response)

## Project Structure

### Documentation (this feature)

```
specs/[###-feature]/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

```
packages/
├── web/                          # Frontend (React + Vite)
│   ├── src/
│   │   ├── components/
│   │   │   ├── ItemList.tsx     # ✏️ MODIFY: Use InlineMarkdownRenderer
│   │   │   └── KanbanCard.tsx   # ✏️ MODIFY: Use InlineMarkdownRenderer + bodyMd
│   │   └── utils/
│   │       └── markdown.tsx     # ✏️ MODIFY: Add extractFirstLine() + InlineMarkdownRenderer
│   └── tests/
│
├── shared/                       # Shared types
│   └── src/
│       └── types/
│           └── project.ts       # ✏️ MODIFY: Add bodyMd to ProjectItemWithIssue
│
├── db/                           # Database layer
│   └── src/
│       └── projectItemRepository.ts  # ✏️ MODIFY: SELECT body_md in SQL
│
└── api/                          # Backend API
    └── src/
        └── routes/
            └── projects.ts      # ✏️ (possibly) Verify bodyMd returned
```

**Structure Decision**: Web monorepo architecture
- Frontend changes: 2 components + 1 utility file
- Type changes: 1 shared type definition
- Backend changes: 1 repository SQL query
- No new files created (all modifications to existing files)

## Complexity Tracking

*Fill ONLY if Constitution Check has violations that must be justified*

**No violations** - Feature is display-layer only modification with no architectural changes.


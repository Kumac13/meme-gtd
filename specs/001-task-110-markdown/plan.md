# Implementation Plan: Markdown Code Block Copy Button

**Branch**: `001-task-110-markdown` | **Date**: 2025-11-26 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/001-task-110-markdown/spec.md`

## Summary

Add a copy button to fenced code blocks (```) in markdown content, similar to GitHub's implementation. The button will be always visible in the top-right corner of each code block, allowing users to copy the code content with a single click. Visual feedback (checkmark icon) will be displayed upon successful copy.

## Technical Context

**Language/Version**: TypeScript 5.5.4 / Node.js 22+
**Primary Dependencies**: React 19.2.0, react-markdown 10.1.0, remark-gfm 4.0.1, Tailwind CSS 4.1.14
**Storage**: N/A (UI-only feature, no data model changes)
**Testing**: Vitest 1.6.0 + @testing-library/react 16.3.0, Playwright 1.56.1 for E2E
**Target Platform**: Web browser (PWA-enabled)
**Project Type**: Monorepo (pnpm workspaces) - changes in `packages/web/` only
**Performance Goals**: Copy operation < 0.5 seconds with visible feedback
**Constraints**: Must work with Clipboard API (navigator.clipboard.writeText)
**Scale/Scope**: Single component enhancement in markdown renderer

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| Library-First | N/A | UI component enhancement only |
| CLI Interface | N/A | Web-only feature |
| Test-First | ✅ Pass | Will write Vitest tests before implementation |
| Integration Testing | ✅ Pass | E2E test with Playwright |
| Simplicity | ✅ Pass | Reuses existing `useCopyToClipboard` hook |

**Result**: All applicable gates passed. Proceeding with Phase 0.

## Project Structure

### Documentation (this feature)

```text
specs/001-task-110-markdown/
├── spec.md              # Feature specification
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output (N/A - UI only)
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output (N/A - no API changes)
└── tasks.md             # Phase 2 output (/speckit.tasks command)
```

### Source Code (repository root)

```text
packages/web/
├── src/
│   ├── utils/
│   │   └── markdown.tsx           # MODIFY: Add CodeBlockWithCopy component
│   ├── components/
│   │   └── CodeBlockCopyButton.tsx # NEW: Copy button component (optional extraction)
│   └── hooks/
│       └── useCopyToClipboard.ts  # REUSE: Existing clipboard hook
└── tests/
    ├── unit/
    │   └── markdown.test.tsx      # NEW: Unit tests for copy functionality
    └── e2e/
        └── code-block-copy.spec.ts # NEW: E2E test for copy button
```

**Structure Decision**: Changes confined to `packages/web/` only. The feature is a pure UI enhancement with no backend changes. We will modify the existing `markdown.tsx` to override the `pre` component in react-markdown, wrapping fenced code blocks with a container that includes the copy button.

## Complexity Tracking

> No constitution violations. Feature is simple and focused.

| Aspect | Approach | Justification |
|--------|----------|---------------|
| Copy logic | Reuse `useCopyToClipboard` hook | Existing, tested implementation |
| Button styling | Tailwind CSS classes | Consistent with codebase |
| Icon | SVG inline or existing icon system | No new dependencies |

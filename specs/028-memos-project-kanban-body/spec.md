# Feature Specification: Markdown-Rendered First Line Display for Memos

**Feature Branch**: `028-memos-project-kanban-body`
**Created**: 2025-11-17
**Status**: Draft
**Input**: User description: "/memosや/project/:id/kanbanでのメモの表示が汚い。md表示になっていないし。bodyの1行目だけ出すはずがそうなってない。現状の実装がどうなっているかを確認した上で、改善選択肢を示してください。"

## Current Implementation Analysis

### Problem Statement

**Issue**: Memo display in `/memos` list and `/project/:id/kanban` views is showing:
1. Raw markdown syntax (not rendered with formatting)
2. Multiple lines instead of just the first line
3. In kanban view, showing empty `title` field instead of `bodyMd`

### Current Code

**`packages/web/src/components/ItemList.tsx:160`** (memos in list view):
```typescript
{truncateMarkdown(item.bodyMd, 150)}
```
- Uses `truncateMarkdown()` which strips ALL markdown formatting to plain text
- Processes entire body (not just first line)
- Shows up to 150 characters from anywhere in the body

**`packages/web/src/components/KanbanCard.tsx:58`** (memos in kanban):
```typescript
{item.issue.title}
```
- Displays `title` field (which is typically empty/null for memos)
- Does NOT use `bodyMd` at all
- `ProjectItemWithIssue` type does NOT include `bodyMd` field

**`packages/web/src/utils/markdown.tsx:174-180`**:
```typescript
export function truncateMarkdown(markdown: string, maxLength: number = 100): string {
  const plainText = markdownToPlainText(markdown);  // Strips ALL markdown
  if (plainText.length <= maxLength) {
    return plainText;
  }
  return plainText.slice(0, maxLength).trim() + '...';
}
```

### Root Causes

1. `truncateMarkdown()` converts markdown to plain text (removes `#`, `**`, etc.)
2. No first-line extraction logic exists
3. Kanban type definition missing `bodyMd` field
4. Kanban component not using `bodyMd`

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Markdown-Rendered First Line in List View (Priority: P1)

When browsing memos in `/memos`, users see the first line of each memo rendered with markdown formatting (headings as headings, bold as bold, etc.).

**Why this priority**: Core requirement - memos must show formatted first line, not plain text or multiple lines

**Independent Test**: Navigate to `/memos`, create memo with `# Heading\nSecond line`, verify only "Heading" displays with heading style (bold, larger text)

**Acceptance Scenarios**:

1. **Given** memo with body `# お金について\nDetails...`, **When** viewing in `/memos`, **Then** display shows "お金について" styled as heading (bold, larger)
2. **Given** memo with body `**重要** メモ\n詳細...`, **When** viewing in `/memos`, **Then** display shows "**重要** メモ" with bold formatting on "重要"
3. **Given** memo with body `一行だけ`, **When** viewing in `/memos`, **Then** display shows "一行だけ" as normal text
4. **Given** memo with empty body, **When** viewing in `/memos`, **Then** display shows "Memo #[ID]"

---

### User Story 2 - Markdown-Rendered First Line in Kanban View (Priority: P1)

When viewing memos in `/project/:id/kanban`, cards show the first line of memo body rendered with markdown formatting.

**Why this priority**: Core requirement - kanban must show memo content, not empty title field

**Independent Test**: Navigate to project kanban, add memo with `# Title\nBody`, verify card shows "Title" with heading style

**Acceptance Scenarios**:

1. **Given** memo in kanban with body `# お金について\n...`, **When** viewing card, **Then** displays "お金について" with heading style
2. **Given** memo in kanban with body `**Bold** text\n...`, **When** viewing card, **Then** displays "**Bold** text" with bold formatting
3. **Given** memo in kanban with empty body, **When** viewing card, **Then** displays "Memo #[ID]"
4. **Given** memo in kanban with very long first line, **When** viewing card, **Then** truncates with ellipsis after ~80 characters

---

### Edge Cases

- Empty or whitespace-only body → Display "Memo #[ID]"
- First line with image `![alt](url)` → Display alt text with formatting
- First line with link `[text](url)` → Display as clickable link
- Very long first line → Truncate at character limit (150 for list, 80 for kanban) with ellipsis
- Unicode/emoji → Handle correctly without corruption

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST extract first line from memo `bodyMd` (text before first `\n`)
- **FR-002**: System MUST render extracted first line with markdown formatting preserved (headings, bold, italic, links, code)
- **FR-003**: System MUST display rendered first line inline without block-level margins or line breaks
- **FR-004**: System MUST truncate long first lines (150 chars for list view, 80 chars for kanban view) with ellipsis
- **FR-005**: System MUST display "Memo #[ID]" when body is empty/null/whitespace-only
- **FR-006**: Kanban cards MUST display memo body (not title field)
- **FR-007**: `ProjectItemWithIssue` type MUST include `bodyMd: string` field
- **FR-008**: Project item API MUST return `bodyMd` for memos in kanban view

### Key Entities

- **Memo**: Has `bodyMd` (markdown text), typically no `title`
- **First Line**: Text before first `\n` character in `bodyMd`
- **Inline Markdown**: Markdown rendered without block margins, suitable for list/card display

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Memos in `/memos` display first line with markdown formatting (headings bold/larger, bold text appears bold)
- **SC-002**: Memos in kanban display first line with markdown formatting (not empty title)
- **SC-003**: Zero memos display multiple lines in list or kanban views
- **SC-004**: 100% of non-empty memos show readable formatted content (not plain text)
- **SC-005**: Empty memos show "Memo #[ID]" fallback in 100% of cases

## Design Options

### Option A-1: Simple Markdown First-Line Rendering

**Implementation**:
- Add `extractFirstLine(markdown: string): string` utility
- Use existing `<MarkdownRenderer>` on extracted first line
- Update ItemList and KanbanCard to use new utility

**Pros**: Reuses existing renderer
**Cons**: `<MarkdownRenderer>` adds block margins, not suitable for inline display

---

### Option A-2: Inline Markdown First-Line Rendering (RECOMMENDED)

**Implementation**:
1. Add `extractFirstLine(markdown: string): string` utility
2. Add `<InlineMarkdownRenderer>` component with inline-optimized markdown rendering:
   - Headings → `<strong>` with larger text
   - Paragraphs → `<span>` (no block margins)
   - Lists → Remove markers, display as inline text
   - Bold/italic/code → Preserve formatting
3. Update ItemList.tsx to use `<InlineMarkdownRenderer content={extractFirstLine(item.bodyMd)} />`
4. Add `bodyMd` to `ProjectItemWithIssue` type
5. Update project item repository to SELECT `body_md`
6. Update KanbanCard.tsx to use `<InlineMarkdownRenderer content={extractFirstLine(item.issue.bodyMd || '')} />`

**Pros**:
- Preserves markdown formatting
- Optimized for inline/list display
- No unwanted margins or line breaks

**Cons**:
- Requires new component
- Slightly more code than A-1

---

### Option A-3: CSS-Controlled Markdown Rendering

**Implementation**:
- Same as A-2 but use existing `<MarkdownRenderer>` with CSS to remove margins
- Add `.inline-markdown` class that resets all block margins to 0

**Pros**: Reuses existing component
**Cons**: CSS overrides are fragile, harder to maintain

---

### Recommended Approach

**Option A-2** because:
- Meets requirement: "md表示" (markdown rendering required)
- Meets requirement: "1行目だけ" (first line only)
- Inline-optimized prevents layout issues
- Clean, maintainable solution

## Assumptions

1. "md表示" means markdown must be rendered with formatting, not stripped to plain text
2. "1行目だけ" means extract text before first `\n` character
3. Inline rendering without block margins is acceptable for list/card views
4. Detail view keeps full multi-line markdown rendering (unchanged)
5. Empty memo fallback "Memo #[ID]" is acceptable

## Out of Scope

1. Multi-line previews
2. Full markdown complexity (tables, multi-line code blocks)
3. Hover tooltips
4. User-configurable display modes
5. Changes to detail view rendering
6. Changes to task display (tasks use `title` field)

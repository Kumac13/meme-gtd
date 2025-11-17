# Research: Markdown-Rendered First Line Display for Memos

**Feature**: 028-memos-project-kanban-body
**Date**: 2025-11-17

## Research Questions

### Q1: How to render markdown inline without block margins?

**Decision**: Create custom `InlineMarkdownRenderer` component with inline-optimized component map

**Rationale**:
- Existing `MarkdownRenderer` uses block-level elements (`<h1>`, `<p>`) with margins
- List/card display requires inline rendering without vertical spacing
- react-markdown allows custom component mapping per element type

**Implementation**:
```typescript
// Convert block elements to inline equivalents
const inlineComponents: Components = {
  p: ({ children }) => <span>{children}</span>,  // No <p> margins
  h1-h6: ({ children }) => <strong className="...">{children}</strong>,  // Inline bold
  ul/ol/li: Flatten to inline spans
  blockquote: Strip to plain italic span
};
```

**Alternatives Considered**:
- **CSS overrides**: `.inline-markdown p { margin: 0 }`
  - Rejected: Fragile, hard to maintain, doesn't handle all block elements
- **Use existing MarkdownRenderer as-is**:
  - Rejected: Creates layout shifts and unwanted spacing in lists

---

### Q2: How to extract first line from markdown?

**Decision**: Simple string split on `\n` character

**Rationale**:
- First line defined as "text before first newline"
- Simple, predictable, no parsing overhead
- Works for all markdown syntax (headings, bold, links, etc.)

**Implementation**:
```typescript
export function extractFirstLine(markdown: string): string {
  return markdown.split('\n')[0] || '';
}
```

**Alternatives Considered**:
- **Markdown AST parsing**: Use remark to parse and extract first block
  - Rejected: Overkill, adds complexity, slower performance
- **Regex-based extraction**: `/^(.+?)$/m`
  - Rejected: Equivalent to split, less readable

---

### Q3: How to add `bodyMd` to kanban API response?

**Decision**: Modify existing `getProjectItemsWithIssues` SQL query to SELECT `i.body_md`

**Rationale**:
- `issues` table already has `body_md` column (TEXT)
- Current query joins `project_items` with `issues` but doesn't SELECT `body_md`
- Adding one column to SELECT is minimal change

**Current SQL** (`packages/db/src/projectItemRepository.ts`):
```sql
SELECT
  pi.*,
  i.id as issue_id,
  i.type as issue_type,
  i.title as issue_title,
  i.status as issue_status
FROM project_items pi
JOIN issues i ON pi.issue_id = i.id
WHERE pi.project_id = ?
```

**Modified SQL**:
```sql
SELECT
  pi.*,
  i.id as issue_id,
  i.type as issue_type,
  i.title as issue_title,
  i.body_md as issue_body_md,  -- ← ADD THIS
  i.status as issue_status
FROM project_items pi
JOIN issues i ON pi.issue_id = i.id
WHERE pi.project_id = ?
```

**Alternatives Considered**:
- **Separate API endpoint**: `/api/memos/:id/body`
  - Rejected: Requires N+1 requests for kanban with N memos, poor performance
- **GraphQL with selective fields**:
  - Rejected: Project doesn't use GraphQL, too large a change

---

### Q4: How to handle truncation of rendered markdown?

**Decision**: Truncate markdown source text BEFORE rendering, not after

**Rationale**:
- Truncating after rendering (HTML) is complex (mid-tag issues)
- Truncating source markdown maintains valid syntax
- Character limits already defined: 150 (list), 80 (kanban)

**Implementation**:
```typescript
// Option 1: Truncate in extractFirstLine
export function extractFirstLine(markdown: string, maxLength?: number): string {
  const firstLine = markdown.split('\n')[0] || '';
  if (maxLength && firstLine.length > maxLength) {
    return firstLine.slice(0, maxLength).trim() + '...';
  }
  return firstLine;
}

// Usage:
<InlineMarkdownRenderer content={extractFirstLine(item.bodyMd, 150)} />
```

**Alternatives Considered**:
- **CSS `text-overflow: ellipsis`**:
  - Rejected: Doesn't work well with inline markdown elements, no character count control
- **Truncate rendered HTML**:
  - Rejected: Risk of cutting mid-tag (e.g., `<stro...`), invalid HTML

---

### Q5: How to handle empty memo bodies?

**Decision**: Check for empty string before rendering, show fallback

**Implementation**:
```typescript
// In component:
{item.bodyMd && item.bodyMd.trim()
  ? <InlineMarkdownRenderer content={extractFirstLine(item.bodyMd)} />
  : <span className="text-gray-500">Memo #{item.id}</span>
}
```

**Rationale**:
- Prevents rendering empty markdown (renders as empty span)
- Provides clear visual fallback for empty memos
- Consistent with task display pattern (shows "Task #ID" when no title)

**Alternatives Considered**:
- **Always render, let renderer handle empty**:
  - Rejected: Creates empty, zero-height elements, confusing UX
- **Hide empty memos entirely**:
  - Rejected: Memos should always be visible, even if empty

---

## Technology Decisions

### react-markdown Configuration

**Decision**: Use existing `react-markdown` v10.1.0 with custom components

**Rationale**:
- Already installed and used in project
- Proven, maintained library (10.1.0 is current stable)
- Component customization API fits inline rendering needs perfectly

**Configuration**:
```typescript
<ReactMarkdown
  remarkPlugins={[remarkGfm]}  // Already used for tables, strikethrough
  components={inlineComponents}  // Custom inline mapping
>
  {content}
</ReactMarkdown>
```

**No additional dependencies needed**

---

### TypeScript Type Safety

**Decision**: Add `bodyMd: string` to `ProjectItemWithIssue.issue` interface

**File**: `packages/shared/src/types/project.ts`

**Change**:
```typescript
export interface ProjectItemWithIssue extends ProjectItem {
  issue: {
    id: number;
    type: 'task' | 'memo';
    title: string;
    bodyMd: string;  // ← ADD
    status: 'inbox' | 'open' | ... | null;
  };
}
```

**Rationale**:
- Ensures type safety across frontend/backend
- Compiler will catch missing `bodyMd` in API responses
- Makes `bodyMd` mandatory (non-nullable) since DB column is `TEXT NOT NULL`

---

## Performance Considerations

### Rendering Performance

**Concern**: Will rendering markdown for hundreds of list items cause lag?

**Analysis**:
- react-markdown is React component-based (virtual DOM diffing applies)
- Rendering first line only (not full document) = minimal parse overhead
- Inline components simpler than block components (less DOM nodes)

**Benchmarking Plan**:
- Test with 100+ memo list
- Measure render time via React DevTools Profiler
- Target: < 16ms per list item (60fps)

**Mitigation** (if needed):
- Virtualization (`react-window`) for very long lists
- Memoize `InlineMarkdownRenderer` with `React.memo()`

### Bundle Size

**Concern**: Does this increase bundle size?

**Analysis**:
- react-markdown already bundled (used in detail view)
- New code: ~50 lines (InlineMarkdownRenderer + extractFirstLine)
- **No new dependencies**

**Impact**: Negligible (< 1KB gzipped)

---

## Edge Cases Handled

| Case | Handling |
|------|----------|
| Empty body | Show "Memo #[ID]" fallback |
| Whitespace-only body | `.trim()` check, treated as empty |
| Very long first line | Truncate at 150/80 chars with `...` |
| Multi-line body | Split on `\n`, take `[0]` |
| Markdown image `![alt](url)` | react-markdown renders as `<img>` (browsers hide if broken), alt text shows |
| Markdown link `[text](url)` | Renders as clickable `<a>` tag |
| Unicode/emoji | JavaScript `.split()` is Unicode-aware, no corruption |
| Code blocks in first line | Render as inline `<code>` (no block margins) |

---

## Testing Strategy

### Unit Tests

**File**: `packages/web/src/utils/markdown.test.tsx`

Test cases:
1. `extractFirstLine()` extracts text before `\n`
2. `extractFirstLine()` returns empty string for empty input
3. `extractFirstLine()` truncates long lines with ellipsis
4. `InlineMarkdownRenderer` renders heading as bold
5. `InlineMarkdownRenderer` renders bold/italic
6. `InlineMarkdownRenderer` has no block margins

### Integration Tests

**File**: `packages/web/tests/e2e/memos.spec.ts` (Playwright)

Test cases:
1. Navigate to `/memos`, verify memo with `# Heading` shows formatted heading
2. Navigate to `/project/:id/kanban`, verify memo card shows formatted first line
3. Create memo with multi-line body, verify only first line shows
4. Create memo with empty body, verify "Memo #ID" fallback

---

## Summary

**Key Decisions**:
1. Custom `InlineMarkdownRenderer` component for inline markdown
2. Simple `split('\n')[0]` for first-line extraction
3. Add `bodyMd` to existing SQL query (no new endpoints)
4. Truncate markdown source before rendering
5. Fallback to "Memo #[ID]" for empty bodies

**No Architecture Changes**:
- Uses existing react-markdown library
- Modifies existing components/types only
- No new database schema changes
- No new API endpoints

**Performance**: Expected to be negligible impact, measurable via profiling

**Ready for Phase 1**: Data model and contracts documentation

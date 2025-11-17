# Quickstart: Markdown-Rendered First Line Display for Memos

**Feature**: 028-memos-project-kanban-body
**Date**: 2025-11-17

## Developer Setup

### Prerequisites

- Node.js 22+
- pnpm 9.0.0
- Running meme-gtd monorepo

### Branch

```bash
git checkout 028-memos-project-kanban-body
```

---

## Implementation Checklist

### 1. Backend Changes (packages/db)

**File**: `packages/db/src/projectItemRepository.ts`

**Task**: Add `body_md` to SELECT query

```typescript
// Find the SQL query in getProjectItemsWithIssues()
// ADD this line to the SELECT:
SELECT
  pi.*,
  i.id as issue_id,
  i.type as issue_type,
  i.title as issue_title,
  i.body_md as issue_body_md,  // ← ADD THIS
  i.status as issue_status
FROM project_items pi
JOIN issues i ON pi.issue_id = i.id
WHERE pi.project_id = ?

// Update the mapping object:
issue: {
  id: row.issue_id,
  type: row.issue_type,
  title: row.issue_title,
  bodyMd: row.issue_body_md,  // ← ADD THIS
  status: row.issue_status
}
```

**Build**:
```bash
pnpm --filter meme-gtd-db build
```

---

### 2. Type Definition Changes (packages/shared)

**File**: `packages/shared/src/types/project.ts`

**Task**: Add `bodyMd` to `ProjectItemWithIssue`

```typescript
export interface ProjectItemWithIssue extends ProjectItem {
  issue: {
    id: number;
    type: 'task' | 'memo';
    title: string;
    bodyMd: string;  // ← ADD THIS LINE
    status: 'inbox' | 'open' | 'next' | 'waiting' | 'scheduled' | 'someday' | 'done' | 'canceled' | null;
  };
}
```

**Build**:
```bash
pnpm --filter meme-gtd-shared build
```

---

### 3. Frontend Utilities (packages/web)

**File**: `packages/web/src/utils/markdown.tsx`

**Task**: Add `extractFirstLine()` and `InlineMarkdownRenderer`

```typescript
/**
 * Extract first line from markdown content
 */
export function extractFirstLine(markdown: string, maxLength?: number): string {
  const firstLine = markdown.split('\n')[0] || '';
  if (maxLength && firstLine.length > maxLength) {
    return firstLine.slice(0, maxLength).trim() + '...';
  }
  return firstLine;
}

/**
 * Inline markdown renderer for list/card previews
 */
export function InlineMarkdownRenderer({ content }: { content: string }) {
  const inlineComponents: Components = {
    p: ({ children }) => <span className="text-gray-900">{children}</span>,
    h1: ({ children }) => <strong className="text-base font-semibold text-gray-900">{children}</strong>,
    h2: ({ children }) => <strong className="text-base font-semibold text-gray-900">{children}</strong>,
    h3: ({ children }) => <strong className="text-sm font-semibold text-gray-900">{children}</strong>,
    h4: ({ children }) => <strong className="text-sm font-semibold text-gray-900">{children}</strong>,
    h5: ({ children }) => <strong className="text-xs font-semibold text-gray-900">{children}</strong>,
    h6: ({ children }) => <strong className="text-xs font-semibold text-gray-900">{children}</strong>,
    strong: ({ children }) => <strong className="font-bold text-gray-900">{children}</strong>,
    em: ({ children }) => <em className="italic text-gray-700">{children}</em>,
    code: ({ children }) => (
      <code className="bg-gray-100 text-red-600 px-1 py-0.5 rounded text-xs font-mono">
        {children}
      </code>
    ),
    a: ({ href, children }) => (
      <a
        href={href}
        className="text-github-green-600 hover:text-github-green-800 underline"
        target="_blank"
        rel="noopener noreferrer"
      >
        {children}
      </a>
    ),
    ul: ({ children }) => <span>{children}</span>,
    ol: ({ children }) => <span>{children}</span>,
    li: ({ children }) => <span className="mr-2">{children}</span>,
    blockquote: ({ children }) => <span className="italic text-gray-600">{children}</span>,
    hr: () => null,
    table: () => null,
    thead: () => null,
    tbody: () => null,
    tr: () => null,
    th: () => null,
    td: () => null,
  };

  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={inlineComponents}
    >
      {content}
    </ReactMarkdown>
  );
}
```

---

### 4. ItemList Component (packages/web)

**File**: `packages/web/src/components/ItemList.tsx`

**Task**: Replace `truncateMarkdown()` with `InlineMarkdownRenderer`

**BEFORE** (line ~160):
```typescript
<p className="text-gray-900 text-sm">
  {truncateMarkdown(item.bodyMd, 150)}
</p>
```

**AFTER**:
```typescript
{item.bodyMd && item.bodyMd.trim() ? (
  <InlineMarkdownRenderer content={extractFirstLine(item.bodyMd, 150)} />
) : (
  <span className="text-gray-500">Memo #{item.id}</span>
)}
```

**Import**:
```typescript
import { InlineMarkdownRenderer, extractFirstLine } from '../utils/markdown';
```

---

### 5. KanbanCard Component (packages/web)

**File**: `packages/web/src/components/KanbanCard.tsx`

**Task**: Use `bodyMd` for memos instead of `title`

**BEFORE** (line ~58):
```typescript
<div className="text-sm font-medium text-gray-900 hover:text-github-green-600">
  {item.issue.title}
</div>
```

**AFTER**:
```typescript
<div className="text-sm font-medium text-gray-900 hover:text-github-green-600">
  {item.issue.type === 'memo' ? (
    item.issue.bodyMd && item.issue.bodyMd.trim() ? (
      <InlineMarkdownRenderer content={extractFirstLine(item.issue.bodyMd, 80)} />
    ) : (
      <span className="text-gray-500">Memo #{item.issueId}</span>
    )
  ) : (
    item.issue.title || `Task #${item.issueId}`
  )}
</div>
```

**Import**:
```typescript
import { InlineMarkdownRenderer, extractFirstLine } from '../utils/markdown';
```

---

## Testing

### Local Development

**Start test environment**:
```bash
# Terminal 1: Start test API server (port 3001)
pnpm server:dev

# Terminal 2: Start test web UI
pnpm dev:web
```

**Access**:
- Web UI: http://localhost:3001
- API: http://localhost:3001/api

**Test Cases**:
1. Navigate to http://localhost:3001/memos
   - Create memo with `# Heading\nSecond line`
   - Verify: Only "Heading" shows, styled bold/larger
2. Navigate to http://localhost:3001/projects/[id]/kanban
   - Add memo with `**Bold** text\nMore text`
   - Verify: Card shows "Bold text" with bold formatting
3. Create empty memo
   - Verify: Shows "Memo #[ID]" fallback

### Unit Tests

**File**: `packages/web/src/utils/markdown.test.tsx` (create if not exists)

```typescript
import { describe, it, expect } from 'vitest';
import { extractFirstLine } from './markdown';

describe('extractFirstLine', () => {
  it('extracts text before first newline', () => {
    expect(extractFirstLine('Line 1\nLine 2')).toBe('Line 1');
  });

  it('returns empty string for empty input', () => {
    expect(extractFirstLine('')).toBe('');
  });

  it('truncates long lines with ellipsis', () => {
    const long = 'a'.repeat(200);
    expect(extractFirstLine(long, 100)).toBe('a'.repeat(100) + '...');
  });
});
```

**Run tests**:
```bash
pnpm --filter meme-gtd-web test
```

### Integration Tests (optional)

**File**: `packages/api/tests/integration/projects.test.ts`

```typescript
it('should include bodyMd in project items', async () => {
  const project = await createTestProject();
  const memo = await createTestMemo({ bodyMd: '# Test\nBody' });
  await addIssueToProject(project.id, memo.id);

  const response = await api.get(`/projects/${project.id}`);

  expect(response.data.items[0].issue.bodyMd).toBe('# Test\nBody');
});
```

---

## Verification

### Before/After Comparison

**Before** (current state):

`/memos` list:
```
データを4分類する データ: 0と1のrawデータ インフォメーション: KPIとかそういうの集計データ インサイト: データから読み解けること アクション
```

Kanban card:
```
[Empty or just "#24"]
```

**After** (expected):

`/memos` list:
```
データを4分類する  (styled as heading, larger/bold)
```

Kanban card:
```
お金について  (styled as heading, bold)
```

### API Response Check

```bash
# Fetch project via API
curl http://localhost:3001/api/projects/4 | jq '.items[0].issue'

# Should see:
{
  "id": 24,
  "type": "memo",
  "title": "",
  "bodyMd": "# お金について\n## Rule - Suica...",  # ← Present
  "status": null
}
```

---

## Build & Deploy

### Build All Packages

```bash
# From repo root
pnpm build
```

**Build order** (automatic via workspace dependencies):
1. `meme-gtd-shared` (types)
2. `meme-gtd-db` (repository)
3. `meme-gtd-api` (backend)
4. `meme-gtd-web` (frontend)

### Production Build Verification

```bash
# Build production assets
pnpm build:web

# Start production server
pnpm server:start

# Access http://localhost:3000
```

---

## Troubleshooting

### TypeScript Error: `Property 'bodyMd' does not exist`

**Cause**: Shared package not rebuilt after type changes

**Fix**:
```bash
pnpm --filter meme-gtd-shared build
pnpm --filter meme-gtd-web build
```

### Kanban Cards Still Show Empty

**Cause**: API not returning `bodyMd`

**Debug**:
```bash
# Check API response
curl http://localhost:3001/api/projects/4 | jq '.items[].issue | {type, bodyMd}'

# Should output bodyMd for each item
```

**Fix**: Verify SQL query in `projectItemRepository.ts` includes `i.body_md as issue_body_md`

### Markdown Not Rendering (Shows Raw Syntax)

**Cause**: Using `truncateMarkdown()` instead of `InlineMarkdownRenderer`

**Fix**: Replace with:
```typescript
<InlineMarkdownRenderer content={extractFirstLine(item.bodyMd)} />
```

---

## Performance Check

### Profile Rendering

```bash
# Open React DevTools Profiler
# Navigate to /memos with 100+ memos
# Record interaction
# Verify: Each memo renders in < 16ms
```

### Bundle Size Check

```bash
cd packages/web
pnpm build
ls -lh dist/assets/*.js

# Verify: No significant increase (< 1KB difference)
```

---

## Summary

**Files Modified**: 5
- `packages/db/src/projectItemRepository.ts` (SQL query)
- `packages/shared/src/types/project.ts` (type definition)
- `packages/web/src/utils/markdown.tsx` (utilities)
- `packages/web/src/components/ItemList.tsx` (memo list)
- `packages/web/src/components/KanbanCard.tsx` (kanban card)

**New Files**: 0

**Dependencies Added**: 0 (uses existing react-markdown)

**Database Changes**: 0 (uses existing schema)

**Estimated Time**: 1-2 hours implementation + testing

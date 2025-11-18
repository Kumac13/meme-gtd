# Quickstart Guide: Markdown Copy Button Implementation

**Feature**: Markdown Copy Button for Web UI
**Target**: Developer implementing this feature
**Estimated Time**: 4-6 hours (including tests)

## Prerequisites

- Node.js 22+ installed
- Repository cloned and dependencies installed (`pnpm install`)
- Web development server running (`pnpm dev:web` on port 3001)
- Familiarity with React 19, TypeScript, and Tailwind CSS

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│ ItemDetail (Page Component)                                 │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ Header: [Title] [Status] [Bookmark] [CopyAll Button]   │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
│ ┌─ EditableContent (Body) ───────────────────────────────┐ │
│ │ Markdown Content                         [⋮]           │ │
│ │                                     ┌────────┐         │ │
│ │ useCopyToClipboard() ──>            │Edit    │         │ │
│ │     Clipboard API                   │Copy    │         │ │
│ │                                     │Delete  │         │ │
│ │                                     └────────┘         │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
│ ┌─ CommentSection ───────────────────────────────────────┐ │
│ │ ┌─ EditableContent (Comment 1) ────────────────────┐   │ │
│ │ │ Comment text                        [⋮]          │   │ │
│ │ └──────────────────────────────────────────────────┘   │ │
│ │ ┌─ EditableContent (Comment 2) ────────────────────┐   │ │
│ │ │ Comment text                        [⋮]          │   │ │
│ │ └──────────────────────────────────────────────────┘   │ │
│ └─────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘

Components:
  EditableContent.tsx     - Modified to add "Copy" menu item
  useCopyToClipboard.ts   - Logic hook (Clipboard API + state)
  markdownFormatter.ts    - Utility (format "copy all" markdown)
```

## Implementation Steps

### Step 1: Create the useCopyToClipboard Hook (30 min)

**File**: `packages/web/src/hooks/useCopyToClipboard.ts`

```typescript
import { useState, useCallback } from 'react';

interface UseCopyToClipboardReturn {
  copied: boolean;
  copy: (text: string) => Promise<boolean>;
  reset: () => void;
}

export function useCopyToClipboard(): UseCopyToClipboardReturn {
  const [copied, setCopied] = useState(false);

  const copy = useCallback(async (text: string): Promise<boolean> => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1000); // 1秒後にリセット
      return true;
    } catch (error) {
      console.error('Failed to copy to clipboard:', error);
      return false;
    }
  }, []);

  const reset = useCallback(() => {
    setCopied(false);
  }, []);

  return { copied, copy, reset };
}
```

**Test**: `packages/web/tests/unit/useCopyToClipboard.test.ts`

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useCopyToClipboard } from '../../src/hooks/useCopyToClipboard';

describe('useCopyToClipboard', () => {
  beforeEach(() => {
    // Mock Clipboard API
    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn(() => Promise.resolve()),
      },
    });
  });

  it('should copy text successfully', async () => {
    const { result } = renderHook(() => useCopyToClipboard());

    await act(async () => {
      const success = await result.current.copy('Test markdown');
      expect(success).toBe(true);
    });

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('Test markdown');
    expect(result.current.copied).toBe(true);
  });

  it('should reset copied state after 1 second', async () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useCopyToClipboard());

    await act(async () => {
      await result.current.copy('Test');
    });

    expect(result.current.copied).toBe(true);

    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(result.current.copied).toBe(false);
    vi.useRealTimers();
  });
});
```

### Step 2: Add Copy to EditableContent Menu (45 min)

**File**: `packages/web/src/components/EditableContent.tsx` (MODIFY)

既存の三点リーダーメニューに「Copy」選択肢を追加：

```typescript
import { useCopyToClipboard } from '../hooks/useCopyToClipboard';

export default function EditableContent({ content, ... }) {
  const { copied, copy } = useCopyToClipboard();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const handleCopy = async () => {
    await copy(content);
    // メニューは閉じない（フィードバックを見せる）
    // または1秒後に閉じる場合は setTimeout を使用
  };

  return (
    <div className="border rounded-lg p-4 relative">
      {/* 三点リーダーボタン（既存） */}
      <button onClick={() => setIsMenuOpen(!isMenuOpen)}>
        ⋮
      </button>

      {isMenuOpen && (
        <div className="absolute right-0 mt-1 w-32 bg-white border border-gray-200 rounded-md shadow-lg z-10">
          <button onClick={() => { handleStartEdit(); setIsMenuOpen(false); }}
            className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">
            Edit
          </button>
          <button onClick={handleCopy}
            className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">
            {copied ? 'Copied!' : 'Copy'}
          </button>
          <button onClick={() => { handleDelete(); setIsMenuOpen(false); }}
            className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-gray-100">
            Delete
          </button>
        </div>
      )}

      {/* Existing content rendering ... */}
    </div>
  );
}
```

**Note**:
- Copyをクリック後、メニューは閉じない（「Copied!」を表示するため）
- メニューを閉じたい場合は、1秒後に自動で閉じる処理を追加

### Step 3: Create Markdown Formatter Utility (30 min)

**File**: `packages/web/src/utils/markdownFormatter.ts`

```typescript
interface FormattedMarkdownInput {
  title: string | null;
  bodyMd: string;
  comments: Array<{
    bodyMd: string;
    createdAt: string;
  }>;
  itemId?: number;
}

export function formatAllContent({
  title,
  bodyMd,
  comments,
  itemId,
}: FormattedMarkdownInput): string {
  // メモの場合（title === null）、デフォルトタイトルを使用
  const heading = title || `Memo #${itemId || 'Unknown'}`;

  let markdown = `# ${heading}\n\n${bodyMd}\n\n`;

  if (comments.length > 0) {
    markdown += `## Comments\n\n`;
    comments.forEach((comment, index) => {
      markdown += `### Comment ${index + 1} (${comment.createdAt})\n${comment.bodyMd}\n\n`;
    });
  }

  return markdown.trim();
}
```

**Test**: `packages/web/tests/unit/markdownFormatter.test.ts`

```typescript
import { describe, it, expect } from 'vitest';
import { formatAllContent } from '../../src/utils/markdownFormatter';

describe('formatAllContent', () => {
  it('should format task with body and comments', () => {
    const result = formatAllContent({
      title: 'Test Task',
      bodyMd: 'Body content',
      comments: [
        { bodyMd: 'Comment 1', createdAt: '2025-11-18T10:00:00Z' },
        { bodyMd: 'Comment 2', createdAt: '2025-11-18T11:00:00Z' },
      ],
    });

    expect(result).toContain('# Test Task');
    expect(result).toContain('Body content');
    expect(result).toContain('## Comments');
    expect(result).toContain('### Comment 1 (2025-11-18T10:00:00Z)');
    expect(result).toContain('Comment 1');
  });

  it('should use default title for memo', () => {
    const result = formatAllContent({
      title: null,
      bodyMd: 'Memo body',
      comments: [],
      itemId: 123,
    });

    expect(result).toContain('# Memo #123');
    expect(result).toContain('Memo body');
    expect(result).not.toContain('## Comments');
  });

  it('should omit comments section when empty', () => {
    const result = formatAllContent({
      title: 'Task',
      bodyMd: 'Body',
      comments: [],
    });

    expect(result).not.toContain('## Comments');
  });
});
```

### Step 4: Verify CommentSection Integration (10 min)

**File**: `packages/web/src/components/CommentSection.tsx`

各コメントはEditableContentを使用しているため、Step 2の変更で自動的にコピー機能が追加されます。追加作業は不要。

確認事項：
- 各コメントの三点リーダーメニューに「Copy」が表示されること
- コメントの`bodyMd`が正しくコピーされること

### Step 5: Add "Copy All" Button to ItemDetail (45 min)

**File**: `packages/web/src/components/ItemDetail.tsx` (MODIFY)

```typescript
import CopyButton from './CopyButton';
import { formatAllContent } from '../utils/markdownFormatter';
import { useState, useEffect } from 'react';
import { CommentsService } from '../api/services/CommentsService';

export default function ItemDetail({ item, itemType, ... }) {
  const [comments, setComments] = useState<Comment[]>([]);

  // コメント取得（既存のコードを流用または新規追加）
  useEffect(() => {
    async function fetchComments() {
      const response = itemType === 'memo'
        ? await CommentsService.listMemoComments(String(item.id))
        : await CommentsService.listTaskComments(String(item.id));
      setComments(response);
    }
    fetchComments();
  }, [item.id, itemType]);

  // すべてコピー用のMarkdownを生成
  const allContentMarkdown = formatAllContent({
    title: item.title,
    bodyMd: item.bodyMd,
    comments: comments.map(c => ({
      bodyMd: c.bodyMd,
      createdAt: c.createdAt,
    })),
    itemId: item.id,
  });

  return (
    <div className="max-w-7xl mx-auto px-4 py-2">
      {/* Header */}
      <div className="mb-4">
        <div className="flex items-start justify-between mb-3">
          <h1 className="text-3xl font-bold text-gray-900">
            {item.title || `${itemType === 'memo' ? 'Memo' : 'Task'} #${item.id}`}
          </h1>
          <div className="flex items-center gap-2">
            {/* Existing buttons (status, bookmark, etc.) */}

            {/* 新規: すべてコピーボタン */}
            <CopyButton
              text={allContentMarkdown}
              ariaLabel="Copy all content"
              className="border border-gray-300 bg-white"
            />
          </div>
        </div>
      </div>

      {/* Rest of the component ... */}
    </div>
  );
}
```

### Step 6: Write E2E Tests (60 min)

**File**: `packages/web/tests/e2e/copy-functionality.spec.ts`

```typescript
import { test, expect } from '@playwright/test';

test.describe('Copy Markdown Functionality', () => {
  test.beforeEach(async ({ page }) => {
    // テスト環境のタスク詳細ページに移動
    await page.goto('http://localhost:3001/tasks/1');
  });

  test('should copy body markdown from menu', async ({ page, context }) => {
    // 権限を付与
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);

    // 三点リーダーメニューを開く
    await page.click('button[aria-label="More options"]'); // または適切なセレクタ

    // 「Copy」メニュー項目をクリック
    await page.click('text=Copy');

    // クリップボードの内容を取得
    const clipboardText = await page.evaluate(() => navigator.clipboard.readText());

    // Markdown形式でコピーされていることを確認
    expect(clipboardText).toContain('## Start State');
  });

  test('should show "Copied!" text after successful copy', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);

    // 三点リーダーメニューを開く
    await page.click('button[aria-label="More options"]');

    // 初期状態: 「Copy」テキスト
    await expect(page.locator('text=Copy')).toBeVisible();

    // クリック
    await page.click('text=Copy');

    // 1秒間「Copied!」が表示される
    await expect(page.locator('text=Copied!')).toBeVisible();

    // 1秒後に「Copy」に戻る
    await page.waitForTimeout(1100);
    await expect(page.locator('text=Copy')).toBeVisible();
  });

  test('should copy all content with structured markdown', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);

    await page.click('[aria-label="Copy all content"]');

    const clipboardText = await page.evaluate(() => navigator.clipboard.readText());

    // タイトル（H1）
    expect(clipboardText).toMatch(/^# /);
    // コメントセクション（H2）
    expect(clipboardText).toContain('## Comments');
    // 個別コメント（H3）
    expect(clipboardText).toContain('### Comment');
  });
});
```

**Run E2E Tests**:
```bash
cd packages/web
pnpm test:e2e
```

### Step 7: Manual Testing Checklist (30 min)

1. **本文コピー**:
   - [ ] タスク詳細ページで三点リーダーメニューに「Copy」が表示される
   - [ ] Edit→Copy→Deleteの順序で表示される
   - [ ] 「Copy」クリックでMarkdownテキストがコピーされる
   - [ ] 1秒間「Copied!」に変化する
   - [ ] テキストエディタに貼り付けてMarkdown形式が保持されている

2. **コメントコピー**:
   - [ ] 各コメントの三点リーダーメニューに「Copy」が表示される
   - [ ] 特定のコメントだけがコピーされる

3. **すべてコピー**:
   - [ ] ヘッダーエリアに「すべてコピー」ボタンが表示される
   - [ ] タイトル、本文、全コメントが構造化されてコピーされる
   - [ ] メモ（タイトルなし）でも正しく動作する

4. **モバイルテスト**:
   - [ ] iOS Safari / Android Chromeでメニューが動作する
   - [ ] メニュー項目のタップ領域が十分大きい

5. **エラーハンドリング**:
   - [ ] HTTP（非HTTPS）環境でconsole.logにエラーが出力される
   - [ ] UIは無反応（エラーメッセージ表示なし）

## Development Workflow

1. **Start dev server**:
   ```bash
   pnpm server:dev  # API server (port 3001)
   ```

2. **Run unit tests** (watch mode):
   ```bash
   cd packages/web
   pnpm test
   ```

3. **Build**:
   ```bash
   pnpm build:web
   ```

4. **Lint**:
   ```bash
   pnpm --filter meme-gtd-web lint
   ```

## Troubleshooting

### Issue: Clipboard API not working in dev

**Solution**: Make sure you're accessing `http://localhost:3001` (localhost is exempt from HTTPS requirement)

### Issue: Tests fail with "navigator.clipboard is undefined"

**Solution**: Ensure mock is set up in test:
```typescript
Object.assign(navigator, {
  clipboard: {
    writeText: vi.fn(() => Promise.resolve()),
  },
});
```

### Issue: Menu text doesn't change to "Copied!"

**Solution**: Check React state update in useCopyToClipboard. Ensure setTimeout is called and state is managed correctly. Verify `copied` state is used in the menu button text.

### Issue: "Copy all" button not showing

**Solution**: Verify ItemDetail component has been updated with CopyButton import and allContentMarkdown generation.

### Issue: "Copy" menu item not appearing

**Solution**: Verify EditableContent component has been updated with:
- Import of `useCopyToClipboard` hook
- `handleCopy` function
- New "Copy" button in the dropdown menu between Edit and Delete

## Performance Targets

- [ ] Copy operation completes in <200ms (check DevTools Performance tab)
- [ ] Success rate ≥95% across browsers (Chrome, Firefox, Safari)
- [ ] Mobile success rate ≥90% (iOS Safari, Android Chrome)

## Next Steps

After implementation:
1. Run all tests (`pnpm test` + `pnpm test:e2e`)
2. Manual testing across browsers
3. Create PR and link to spec.md
4. Request code review

## References

- [Specification](./spec.md)
- [Research](./research.md)
- [Data Model](./data-model.md)
- [Clipboard API MDN](https://developer.mozilla.org/en-US/docs/Web/API/Clipboard_API)
- [react-icons Documentation](https://react-icons.github.io/react-icons/)


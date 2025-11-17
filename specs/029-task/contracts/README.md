# API Contracts

**Feature**: Markdown Copy Button for Web UI

## Overview

この機能は新規APIエンドポイントを追加しません。すべてクライアント側（UI層）での実装です。

## Existing APIs Used

この機能は以下の既存APIを使用します（変更なし）：

### Tasks API

- `GET /api/tasks/:id` - タスク詳細取得
- タスクの`title`、`bodyMd`をコピー機能で使用

### Memos API

- `GET /api/memos/:id` - メモ詳細取得
- メモの`bodyMd`をコピー機能で使用

### Comments API

- `GET /api/tasks/:taskId/comments` - タスクのコメント一覧取得
- `GET /api/memos/:memoId/comments` - メモのコメント一覧取得
- コメントの`bodyMd`、`createdAt`をコピー機能で使用

## Browser APIs Used

### Clipboard API

**API**: `navigator.clipboard.writeText(text: string): Promise<void>`

**Requirements**:
- HTTPS必須（localhost除く）
- User gesture必須（ボタンクリック）
- 書き込みに権限不要（読み取りは要）

**Error Handling**:
```typescript
try {
  await navigator.clipboard.writeText(markdown);
  // Success - show checkmark icon for 1 second
} catch (error) {
  // Error - no UI feedback, log to console only
  console.error('Clipboard copy failed:', error);
}
```

**Browser Support**:
- Chrome 63+
- Firefox 53+
- Safari 13.4+
- Edge 79+
- iOS Safari 13.4+
- Android Chrome 63+

## No New Contracts

この機能ではOpenAPI/GraphQLスキーマの追加・変更は発生しません。

## Frontend-Only Contract

### CopyButton Component Interface

```typescript
interface CopyButtonProps {
  text: string;               // Markdown text to copy
  ariaLabel?: string;         // Default: "Copy markdown"
  className?: string;         // Custom Tailwind classes
  onCopySuccess?: () => void; // Optional callback
  onCopyError?: (error: Error) => void; // Optional callback
}
```

### useCopyToClipboard Hook Interface

```typescript
interface UseCopyToClipboardReturn {
  copied: boolean;            // Copy success state (true for 1s)
  copy: (text: string) => Promise<boolean>; // Execute copy
  reset: () => void;          // Manual state reset
}

function useCopyToClipboard(): UseCopyToClipboardReturn;
```

### markdownFormatter Utility Interface

```typescript
interface FormatAllContentInput {
  title: string | null;       // Task title or null (Memo)
  bodyMd: string;             // Main content
  comments: Array<{
    bodyMd: string;
    createdAt: string;        // ISO8601
  }>;
  itemId?: number;            // For default title (Memo #${id})
}

function formatAllContent(input: FormatAllContentInput): string;
```

## Testing Contracts

### Unit Test Interface (Vitest)

```typescript
// Mock Clipboard API
Object.assign(navigator, {
  clipboard: {
    writeText: vi.fn(() => Promise.resolve()),
  },
});

// Test expectations
expect(navigator.clipboard.writeText).toHaveBeenCalledWith(expectedMarkdown);
```

### E2E Test Interface (Playwright)

```typescript
// Copy action
await page.click('[aria-label="Copy markdown"]');

// Verify clipboard content
const clipboardText = await page.evaluate(() => navigator.clipboard.readText());
expect(clipboardText).toBe(expectedMarkdown);

// Verify visual feedback (icon change)
await expect(page.locator('[aria-label="Copy markdown"] svg')).toHaveAttribute('data-icon', 'check');
await page.waitForTimeout(1000);
await expect(page.locator('[aria-label="Copy markdown"] svg')).toHaveAttribute('data-icon', 'clipboard');
```

## No Backend Changes

**Confirmation**: この機能はフロントエンドのみの変更です。バックエンド（API、DB）への変更は一切発生しません。


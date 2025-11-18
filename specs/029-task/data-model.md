# Data Model: Markdown Copy Button

**Date**: 2025-11-18
**Feature**: Markdown Copy Button for Web UI

## Overview

この機能は新規データエンティティを追加しません。既存のデータモデル（Task、Memo、Comment）を使用し、UIレイヤーでのみ実装します。

## Existing Data Models (Used)

### Task

```typescript
interface Task {
  id: number;
  type: 'task';
  title: string;              // H1として使用（すべてコピー時）
  bodyMd: string;             // Markdown raw text（コピー対象）
  status: TaskStatus;
  scheduledOn: string | null;
  isBookmarked: boolean;
  labels?: string[];
  createdAt: string;
  updatedAt: string;
}
```

**Usage in Copy Feature**:
- `title`: すべてコピー機能でH1見出しとして使用
- `bodyMd`: 本文コピー機能で直接コピー

### Memo

```typescript
interface Memo {
  id: number;
  type: 'memo';
  title: null;                // 常にnull（メモにタイトルなし）
  bodyMd: string;             // Markdown raw text（コピー対象）
  status: null;
  scheduledOn: null;
  isBookmarked: boolean;
  labels?: string[];
  createdAt: string;
  updatedAt: string;
}
```

**Usage in Copy Feature**:
- `title`: null → すべてコピー時は `# Memo #${id}` をデフォルトタイトルとして使用
- `bodyMd`: 本文コピー機能で直接コピー

### Comment

```typescript
interface Comment {
  id: number;
  issueId: number;
  bodyMd: string;             // Markdown raw text（コピー対象）
  createdAt: string;          // すべてコピー時にH3見出しに含める
  updatedAt: string;
  isDeleted: boolean;
}
```

**Usage in Copy Feature**:
- `bodyMd`: コメントコピー機能で直接コピー
- `createdAt`: すべてコピー時に `### Comment N (${createdAt})` として使用

## New UI State Models

### CopyButtonState

```typescript
interface CopyButtonState {
  copied: boolean;            // コピー成功状態（1秒間true）
  copying: boolean;           // コピー中状態（オプション、UI無効化用）
}
```

**State Transitions**:
```
Idle (copied: false, copying: false)
  ↓ [User clicks button]
Copying (copied: false, copying: true)
  ↓ [Clipboard API success]
Success (copied: true, copying: false)
  ↓ [After 1000ms]
Idle (copied: false, copying: false)

Error path:
Copying (copied: false, copying: true)
  ↓ [Clipboard API error]
Idle (copied: false, copying: false)  // 無反応
```

### FormattedMarkdown (すべてコピー用)

```typescript
interface FormattedMarkdown {
  title: string;              // H1見出し
  bodyMd: string;             // 本文（そのまま）
  comments: Array<{
    bodyMd: string;           // コメント本文
    createdAt: string;        // ISO8601形式
  }>;
}
```

**Output Format**:
```markdown
# ${title}

${bodyMd}

## Comments

### Comment 1 (${comments[0].createdAt})
${comments[0].bodyMd}

### Comment 2 (${comments[1].createdAt})
${comments[1].bodyMd}
```

## Component Props Interfaces

### CopyButton Props

```typescript
interface CopyButtonProps {
  text: string;               // コピーするMarkdownテキスト
  ariaLabel?: string;         // アクセシビリティラベル（デフォルト: "Copy markdown"）
  className?: string;         // カスタムスタイル
  onCopySuccess?: () => void; // コピー成功時のコールバック（オプション）
  onCopyError?: (error: Error) => void; // エラー時のコールバック（オプション）
}
```

### useCopyToClipboard Hook Return

```typescript
interface UseCopyToClipboardReturn {
  copied: boolean;            // コピー成功状態
  copy: (text: string) => Promise<boolean>; // コピー実行関数
  reset: () => void;          // 状態リセット関数（手動リセット用）
}
```

## Data Flow

### 1. 本文コピー

```
EditableContent Component
  ├── props.content (bodyMd: string)
  └── CopyButton
      └── useCopyToClipboard(content)
          ├── navigator.clipboard.writeText(content)
          └── setCopied(true) → 1000ms → setCopied(false)
```

### 2. コメントコピー

```
CommentSection Component
  ├── comments: Comment[]
  └── For each comment:
      └── EditableContent
          ├── props.content (comment.bodyMd: string)
          └── CopyButton
              └── useCopyToClipboard(comment.bodyMd)
```

### 3. すべてコピー

```
TaskDetail / MemoDetail Component
  ├── task/memo: Task | Memo
  ├── Fetch comments via CommentsService
  └── ItemDetail
      └── Header Actions
          └── CopyButton
              ├── formatAllContent(title, bodyMd, comments)
              │   └── Generates structured Markdown
              └── useCopyToClipboard(formattedMarkdown)
```

## Data Validation

### Input Validation

**本文/コメントコピー**:
- `bodyMd`: 空文字列OK（空のままコピー）
- 特殊文字: エスケープ不要（rawテキストとしてコピー）
- Null/Undefined: 発生しない（型システムで保証）

**すべてコピー**:
- `title`: Task→文字列、Memo→null（デフォルト`Memo #${id}`に変換）
- `comments`: 空配列OK（コメントセクション省略）
- 日時フォーマット: ISO8601形式（既存データから取得、変換不要）

### Output Validation

**Clipboard API**:
- 入力: UTF-8文字列（Markdown）
- 出力: なし（Promiseの成功/失敗のみ）
- 制限: ブラウザ依存（通常数MB、テキストなので問題なし）

## Error Handling

### Clipboard API Errors

```typescript
try {
  await navigator.clipboard.writeText(text);
  return true;
} catch (error) {
  // ケース1: Clipboard API非対応
  // ケース2: HTTPS要件未満（非HTTPSページ、localhostは除外）
  // ケース3: User gesture外での呼び出し（発生しない設計）

  console.error('Clipboard copy failed:', error);
  return false; // UIは無反応
}
```

**Error Types**:
- `NotAllowedError`: 権限不足（ユーザーがブラウザ設定でブロック）
- `NotSupportedError`: API非対応ブラウザ
- `NetworkError`: 一時的な失敗（稀）

## Performance Implications

### Memory

- **状態サイズ**: boolean 2つ（`copied`, `copying`）→ 数バイト
- **テキストサイズ**: 典型的なタスク/メモ→ 数KB、すべてコピー→ 最大数十KB
- **メモリリーク**: なし（1秒間のタイマー、自動クリーンアップ）

### Network

- **追加リクエスト**: なし（既存データを使用）
- **すべてコピー**: コメント取得は既に実行済み（ItemDetail内で）

### Computation

- **Markdown構造化**: O(n) where n = コメント数（通常<100、無視できる）
- **Clipboard API**: ブラウザネイティブ、高速（10-50ms）

## Testing Data Samples

### Sample 1: Task with Body and Comments

```typescript
const sampleTask: Task = {
  id: 39,
  type: 'task',
  title: 'mdのままコピーできるようにする',
  bodyMd: '## Start State\n- AIに渡すためにコピぺしようとすると、Edit画面にしないとmdの状態を反映できない\n\n## Goal State\n- WebUIで入力されたものbody、commentsをコピーできるボタンがある',
  status: 'next',
  // ...
};

const sampleComments: Comment[] = [
  {
    id: 1,
    issueId: 39,
    bodyMd: 'これは良いアイデアだと思います。',
    createdAt: '2025-11-17T10:00:00.000Z',
    // ...
  },
];
```

**Expected Copy All Output**:
```markdown
# mdのままコピーできるようにする

## Start State
- AIに渡すためにコピぺしようとすると、Edit画面にしないとmdの状態を反映できない

## Goal State
- WebUIで入力されたものbody、commentsをコピーできるボタンがある

## Comments

### Comment 1 (2025-11-17T10:00:00.000Z)
これは良いアイデアだと思います。
```

### Sample 2: Memo (No Title)

```typescript
const sampleMemo: Memo = {
  id: 123,
  type: 'memo',
  title: null,
  bodyMd: 'メモの内容です。',
  // ...
};
```

**Expected Copy All Output**:
```markdown
# Memo #123

メモの内容です。
```

### Sample 3: Empty Body

```typescript
const emptyTask: Task = {
  id: 1,
  type: 'task',
  title: 'Empty Task',
  bodyMd: '',
  // ...
};
```

**Expected Copy Body Output**: `""` (空文字列)

## Database Schema

**N/A**: この機能はデータベース変更を伴いません。すべて既存スキーマを使用。

## API Contracts

**N/A**: この機能は新規API呼び出しを追加しません。既存のAPI（`TasksService.getTask`, `MemosService.getMemo`, `CommentsService.listTaskComments`, `CommentsService.listMemoComments`）を使用。

## Migration Requirements

**N/A**: データマイグレーション不要（UI層のみの変更）。


# Data Model: HTTP API Server

**Date**: 2025-10-20
**Feature**: HTTP API Server for CLI-Equivalent Operations
**Status**: Phase 1 Design

このドキュメントはAPIで扱うデータモデルを定義します。既存の`meme-gtd-db`スキーマをベースに、HTTP API向けのリクエスト/レスポンスモデルを定義します。

## エンティティ関係図

```
┌─────────────────┐
│     issues      │
│  (memo/task)    │
│                 │
│  id             │◄──────┐
│  type           │       │
│  title          │       │ 1:N
│  body_md        │       │
│  status         │       │
│  scheduled_on   │       │
│  is_bookmarked  │       │
│  is_deleted     │       │
│  created_at     │       │
│  updated_at     │       │
└────────┬────────┘       │
         │                │
         │ 1:N            │
         │                │
         ▼                │
┌─────────────────┐       │
│   comments      │       │
│                 │       │
│  id             │       │
│  issue_id       ├───────┘
│  body_md        │
│  created_at     │
│  updated_at     │
│  is_deleted     │
└─────────────────┘

┌─────────────────┐       ┌─────────────────┐
│     labels      │       │  issue_labels   │
│                 │       │  (junction)     │
│  id             │◄──────┤  issue_id       │
│  name (UNIQUE)  │       │  label_id       │
│  description    │       └────────┬────────┘
│  created_at     │                │
└─────────────────┘                │
                                   │
┌─────────────────┐                │
│     issues      │                │
│                 │◄───────────────┘
│  id             │
└─────────────────┘

┌─────────────────┐
│      links      │
│                 │
│  id             │
│  source_id      ├───►  issues.id
│  target_id      ├───►  issues.id
│  link_type      │  (parent/child/relates/derived_from)
│  created_at     │
└─────────────────┘
```

---

## 1. Issue（Memo / Task）

### データベーススキーマ（既存）

```sql
CREATE TABLE issues (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  type TEXT NOT NULL CHECK (type IN ('memo', 'task')),
  title TEXT,  -- memo: 常にNULL, task: 必須
  body_md TEXT NOT NULL,  -- memo: 必須, task: 空文字列可（v0.4.0以降）
  status TEXT CHECK (status IN ('open', 'next', 'waiting', 'scheduled', 'done', 'canceled')),
  scheduled_on TEXT,  -- ISO 8601日付
  meta TEXT,  -- JSON
  is_bookmarked INTEGER NOT NULL DEFAULT 0,
  is_deleted INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```

### Zodスキーマ定義

```typescript
// 共通フィールド
const TimestampSchema = z.object({
  createdAt: z.string().datetime().describe('作成日時（ISO 8601形式）'),
  updatedAt: z.string().datetime().describe('更新日時（ISO 8601形式）'),
});

// Memo
const MemoSchema = z.object({
  id: z.number().int().positive().describe('メモID'),
  type: z.literal('memo'),
  bodyMd: z.string().min(1).describe('本文（Markdown形式、必須）'),
  isBookmarked: z.boolean().describe('ブックマーク状態'),
}).merge(TimestampSchema);

// Memoリクエスト
const CreateMemoRequestSchema = z.object({
  bodyMd: z.string().min(1, 'Body is required'),
  labels: z.array(z.string()).optional().describe('ラベル名の配列'),
});

const UpdateMemoRequestSchema = z.object({
  bodyMd: z.string().min(1).optional(),
});

// Task
const TaskStatusSchema = z.enum(['open', 'next', 'waiting', 'scheduled', 'done', 'canceled']);

const TaskSchema = z.object({
  id: z.number().int().positive().describe('タスクID'),
  type: z.literal('task'),
  title: z.string().min(1).max(200).describe('タイトル（必須）'),
  bodyMd: z.string().describe('本文（Markdown形式、空文字列可）'),
  status: TaskStatusSchema.describe('ステータス'),
  scheduledOn: z.string().date().nullable().describe('予定日（YYYY-MM-DD形式、nullableoptional）'),
  isBookmarked: z.boolean().describe('ブックマーク状態'),
}).merge(TimestampSchema);

// Taskリクエスト
const CreateTaskRequestSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200),
  bodyMd: z.string().default(''),
  status: TaskStatusSchema.optional().default('open'),
  scheduledOn: z.string().date().nullable().optional(),
  labels: z.array(z.string()).optional(),
});

const UpdateTaskRequestSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  bodyMd: z.string().optional(),
  status: TaskStatusSchema.optional(),
  scheduledOn: z.string().date().nullable().optional(),
});

// Memo昇格リクエスト
const PromoteMemoRequestSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200),
  bodyMd: z.string().optional().describe('省略時は元メモのbodyMdを使用'),
  status: TaskStatusSchema.optional().default('open'),
  scheduledOn: z.string().date().nullable().optional(),
  labels: z.array(z.string()).optional(),
});
```

### バリデーションルール

| フィールド | Memo | Task | 検証ルール |
|-----------|------|------|----------|
| `type` | ✓ | ✓ | リテラル型（'memo' or 'task'） |
| `title` | ✗ | ✓ | 1〜200文字、必須 |
| `bodyMd` | ✓ | ✓ | Memoは必須（1文字以上）、Taskは空文字列可 |
| `status` | ✗ | ✓ | 列挙型（open/next/waiting/scheduled/done/canceled） |
| `scheduledOn` | ✗ | △ | YYYY-MM-DD形式、nullable |
| `isBookmarked` | ✓ | ✓ | boolean |

### 状態遷移

**Taskのステータス遷移図**:

```
        ┌──────────┐
        │   open   │ ◄─── 初期状態
        └────┬─────┘
             │
      ┌──────┼──────┬────────┐
      │      │      │        │
      ▼      ▼      ▼        ▼
   ┌────┐ ┌────┐ ┌─────┐ ┌─────┐
   │next│ │wait│ │sched│ │done │
   └──┬─┘ └──┬─┘ └──┬──┘ └──┬──┘
      │      │      │       │
      └──────┴──────┴───────┘
             │
             ▼
        ┌──────────┐
        │ canceled │
        └──────────┘

凡例:
- open: Inbox（初期状態）
- next: Next Actions（実行予定）
- waiting: Waiting For（他者依存）
- scheduled: Scheduled（日付指定）
- done: 完了
- canceled: キャンセル
```

**許可される遷移**:
- `open` → `next`, `waiting`, `scheduled`, `done`, `canceled`
- `next` → `done`, `canceled`, `open`
- `waiting` → `done`, `canceled`, `open`
- `scheduled` → `done`, `canceled`, `open`
- `done` → `open`（再オープン）
- `canceled` → `open`（再オープン）

**エンドポイント別の状態変更**:
- `PATCH /api/tasks/:id` - 任意のステータスに変更可能（直接指定）
- `POST /api/tasks/:id/close` - `done`に変更
- `POST /api/tasks/:id/cancel` - `canceled`に変更
- `POST /api/tasks/:id/reopen` - `open`に変更

---

## 2. Label

### データベーススキーマ（既存）

```sql
CREATE TABLE labels (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE issue_labels (
  issue_id INTEGER NOT NULL,
  label_id INTEGER NOT NULL,
  assigned_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (issue_id, label_id),
  FOREIGN KEY (issue_id) REFERENCES issues(id) ON DELETE CASCADE,
  FOREIGN KEY (label_id) REFERENCES labels(id) ON DELETE CASCADE
);
```

### Zodスキーマ定義

```typescript
const LabelSchema = z.object({
  id: z.number().int().positive().describe('ラベルID'),
  name: z.string().min(1).max(50).describe('ラベル名（UNIQUE）'),
  description: z.string().max(200).optional().nullable().describe('説明'),
  createdAt: z.string().datetime().describe('作成日時'),
});

const CreateLabelRequestSchema = z.object({
  name: z.string().min(1, 'Name is required').max(50),
  description: z.string().max(200).optional(),
});

const AssignLabelRequestSchema = z.object({
  labelId: z.number().int().positive(),
});
```

### バリデーションルール

| フィールド | 必須 | 検証ルール |
|-----------|-----|----------|
| `name` | ✓ | 1〜50文字、UNIQUE制約 |
| `description` | ✗ | 最大200文字 |

### UNIQUE制約エラーハンドリング

```typescript
// SQLiteエラー: SQLITE_CONSTRAINT_UNIQUE
// HTTPレスポンス:
{
  "error": "Resource already exists (name must be unique)",
  "code": "SQLITE_CONSTRAINT_UNIQUE"
}
// ステータスコード: 409 Conflict
```

---

## 3. Link

### データベーススキーマ（既存）

```sql
CREATE TABLE links (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source_id INTEGER NOT NULL,
  target_id INTEGER NOT NULL,
  link_type TEXT NOT NULL CHECK (link_type IN ('parent', 'child', 'relates', 'derived_from')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (source_id) REFERENCES issues(id) ON DELETE CASCADE,
  FOREIGN KEY (target_id) REFERENCES issues(id) ON DELETE CASCADE,
  UNIQUE (source_id, target_id, link_type)
);
```

### Zodスキーマ定義

```typescript
const LinkTypeSchema = z.enum(['parent', 'child', 'relates', 'derived_from']);

const LinkSchema = z.object({
  id: z.number().int().positive().describe('リンクID'),
  sourceId: z.number().int().positive().describe('ソースissue ID'),
  targetId: z.number().int().positive().describe('ターゲットissue ID'),
  linkType: LinkTypeSchema.describe('リンクタイプ'),
  createdAt: z.string().datetime().describe('作成日時'),
});

// GET /api/issues/:id/links レスポンス用
const LinkWithDirectionSchema = LinkSchema.extend({
  direction: z.enum(['outgoing', 'incoming']).describe('リンクの方向'),
});

const CreateLinkRequestSchema = z.object({
  type: LinkTypeSchema.describe('リンクタイプ'),
  sourceId: z.number().int().positive(),
  targetId: z.number().int().positive(),
});
```

### リンクタイプの意味

| タイプ | 意味 | 使用例 |
|-------|------|--------|
| `parent` | source=子、target=親 | タスクの階層構造 |
| `child` | source=親、target=子 | 親タスクから子タスクへの参照 |
| `relates` | 一般的な関連 | 関連するタスク同士 |
| `derived_from` | sourceがtargetから派生 | memo promote時に自動作成 |

### バリデーションルール

| ルール | エラーコード | HTTPステータス | メッセージ |
|-------|------------|--------------|-----------|
| 自己参照禁止 | `SELF_REFERENCE` | 400 | "Cannot link issue to itself (ID: {id})" |
| 重複リンク禁止 | `SQLITE_CONSTRAINT_UNIQUE` | 409 | "Link already exists (source: {s}, target: {t}, type: {type})" |
| 存在しないissue | `SQLITE_CONSTRAINT_FOREIGNKEY` | 400 | "Issue #{id} not found" |

---

## 4. Comment

### データベーススキーマ（既存）

```sql
CREATE TABLE comments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  issue_id INTEGER NOT NULL,
  body_md TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  is_deleted INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY (issue_id) REFERENCES issues(id) ON DELETE CASCADE
);

CREATE TABLE comment_revisions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  comment_id INTEGER NOT NULL,
  body_md TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (comment_id) REFERENCES comments(id) ON DELETE CASCADE
);
```

### Zodスキーマ定義

```typescript
const CommentSchema = z.object({
  id: z.number().int().positive().describe('コメントID'),
  issueId: z.number().int().positive().describe('親issue ID'),
  bodyMd: z.string().min(1).describe('本文（Markdown形式）'),
  createdAt: z.string().datetime().describe('作成日時'),
  updatedAt: z.string().datetime().describe('更新日時'),
});

const CreateCommentRequestSchema = z.object({
  bodyMd: z.string().min(1, 'Body is required'),
});

const UpdateCommentRequestSchema = z.object({
  bodyMd: z.string().min(1, 'Body is required'),
});
```

### コメント編集時の動作

```typescript
// PATCH /api/memos/:memoId/comments/:commentId
// 1. 現在のbody_mdをcomment_revisionsに保存
// 2. commentsテーブルを更新
// 3. updated_atを現在時刻に更新
```

---

## 5. エラーレスポンス

### 共通エラーレスポンススキーマ

```typescript
const ErrorResponseSchema = z.object({
  error: z.string().describe('人間が読めるエラーメッセージ'),
  code: z.string().optional().describe('機械可読なエラーコード'),
  details: z.unknown().optional().describe('追加のエラーコンテキスト'),
  requestId: z.string().optional().describe('リクエスト追跡ID'),
});

const ValidationErrorResponseSchema = z.object({
  error: z.literal('Validation failed'),
  code: z.literal('VALIDATION_ERROR'),
  details: z.array(z.object({
    field: z.string().describe('エラーが発生したフィールド'),
    message: z.string().describe('エラーメッセージ'),
    receivedValue: z.unknown().optional().describe('受信した値'),
  })),
});
```

### HTTPステータスコード対応表

| ステータス | 用途 | エラーコード例 |
|-----------|------|--------------|
| 200 OK | 成功レスポンス | - |
| 201 Created | リソース作成成功 | - |
| 400 Bad Request | バリデーションエラー、不正なリクエスト | `VALIDATION_ERROR`, `SQLITE_CONSTRAINT_FOREIGNKEY` |
| 404 Not Found | リソースが存在しない | `RESOURCE_NOT_FOUND` |
| 409 Conflict | UNIQUE制約違反 | `SQLITE_CONSTRAINT_UNIQUE` |
| 500 Internal Server Error | サーバー内部エラー | `INTERNAL_ERROR`, `SQLITE_IOERR` |
| 503 Service Unavailable | DBロック中 | `SQLITE_BUSY`, `SQLITE_LOCKED` |

---

## 6. ページネーション

### クエリパラメータ

```typescript
const PaginationQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1).describe('ページ番号（1始まり）'),
  limit: z.coerce.number().int().min(1).max(100).default(20).describe('1ページあたりの件数'),
});

const PaginationResponseSchema = z.object({
  total: z.number().int().describe('総件数'),
  page: z.number().int().describe('現在のページ'),
  limit: z.number().int().describe('1ページあたりの件数'),
  totalPages: z.number().int().describe('総ページ数'),
});
```

### レスポンス形式

```typescript
// GET /api/tasks?page=2&limit=10
{
  "tasks": [...],  // 最大10件
  "pagination": {
    "total": 45,
    "page": 2,
    "limit": 10,
    "totalPages": 5
  }
}
```

**注意**: v1ではoffset/cursor方式のページネーションは実装しない。limit方式のみ。

---

## 7. フィルタリング

### Memo一覧フィルタ

```typescript
const ListMemosQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(30),
  labelId: z.coerce.number().int().positive().optional().describe('ラベルIDでフィルタ'),
  search: z.string().optional().describe('本文の全文検索'),
  order: z.enum(['asc', 'desc']).default('desc').describe('updated_atのソート順'),
  bookmarked: z.coerce.boolean().optional().describe('ブックマーク済みのみ'),
});
```

### Task一覧フィルタ

```typescript
const ListTasksQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: TaskStatusSchema.optional().describe('ステータスでフィルタ'),
  labelId: z.coerce.number().int().positive().optional().describe('ラベルIDでフィルタ'),
  search: z.string().optional().describe('タイトル・本文の全文検索'),
  bookmarked: z.coerce.boolean().optional().describe('ブックマーク済みのみ'),
});
```

### SQLiteクエリ例

```sql
-- GET /api/tasks?status=next&labelId=5&bookmarked=true
SELECT DISTINCT i.*
FROM issues i
LEFT JOIN issue_labels il ON i.id = il.issue_id
WHERE i.type = 'task'
  AND i.is_deleted = 0
  AND i.status = 'next'
  AND il.label_id = 5
  AND i.is_bookmarked = 1
ORDER BY i.updated_at DESC
LIMIT 20;
```

---

## 8. データ整合性

### 外部キー制約

すべてのリレーションシップは`ON DELETE CASCADE`を設定：

```sql
-- issueを削除すると、関連するcommentsも自動削除
FOREIGN KEY (issue_id) REFERENCES issues(id) ON DELETE CASCADE

-- labelを削除すると、issue_labelsも自動削除
FOREIGN KEY (label_id) REFERENCES labels(id) ON DELETE CASCADE
```

### 論理削除

物理削除ではなく論理削除（`is_deleted = 1`）を使用：

```typescript
// DELETE /api/memos/:id
// → UPDATE issues SET is_deleted = 1 WHERE id = :id
```

**理由**:
- データの完全性を保つ（リンクや履歴が壊れない）
- 将来的な復元機能の実装が容易
- 監査ログとして利用可能

### トランザクション管理

複数テーブルへの書き込みはトランザクションで保護：

```typescript
// memo promote: 3つの操作をトランザクションで実行
db.transaction(() => {
  const task = createTask(db, {...});           // issues INSERT
  createLink(db, {                             // links INSERT
    sourceId: task.id,
    targetId: memoId,
    linkType: 'derived_from'
  });
  if (labels) attachLabels(db, task.id, labels); // issue_labels INSERT
})();
```

**ロールバック条件**:
- いずれかの操作が失敗した場合、すべてロールバック
- 部分的な状態変更は発生しない

---

## まとめ

### 主要エンティティ

| エンティティ | 役割 | 主キー | 外部キー |
|------------|------|--------|---------|
| `issues` | Memo/Taskの共通テーブル | `id` | - |
| `labels` | タグ管理 | `id` | - |
| `issue_labels` | Issue-Label多対多 | `(issue_id, label_id)` | `issue_id`, `label_id` |
| `links` | Issue間の関係 | `id` | `source_id`, `target_id` |
| `comments` | コメント | `id` | `issue_id` |
| `comment_revisions` | コメント編集履歴 | `id` | `comment_id` |

### バリデーション戦略

1. **スキーマレベル**: Zodスキーマで型・必須・長さ・形式を検証
2. **DBレベル**: UNIQUE制約、CHECK制約、外部キー制約で整合性を保証
3. **アプリケーションレベル**: カスタムエラークラスで業務ルール検証

### 既存CLIとの一貫性

- エラーメッセージ形式を統一
- 同じZodスキーマを再利用
- 同じDB操作関数を再利用（`meme-gtd-db`）

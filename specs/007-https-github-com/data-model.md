# Data Model: Allow Optional Task Body

**Feature**: タスク作成時にbodyを省略可能にする
**Date**: 2025-10-16

## Overview

この機能はデータモデルの変更を伴わない。既存のDBスキーマが既に空文字列を許容しているため、CLIレイヤーのバリデーションのみを変更する。

## Existing Schema (変更なし)

### issues テーブル

```sql
CREATE TABLE issues (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  type TEXT NOT NULL CHECK(type IN ('memo', 'task')),
  title TEXT,
  body_md TEXT NOT NULL DEFAULT '',  -- 既に空文字列を許容
  status TEXT NOT NULL,
  scheduled_on TEXT,
  is_bookmarked INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  derived_from INTEGER,
  FOREIGN KEY (derived_from) REFERENCES issues(id)
);
```

**Key Point**: `body_md TEXT NOT NULL DEFAULT ''`
- NOT NULL制約はあるが、DEFAULT ''で空文字列を許容
- この仕様により、既にDBレベルでは空bodyが可能

## Entity Validation Changes

### Task Entity (TypeScript)

**Before** (create.ts:117-119):
```typescript
if (!body.trim()) {
  this.error('Task body cannot be empty.');
}
```

**After**:
```typescript
// バリデーション削除 - 空文字列を許容
```

### No Schema Migration Required

データベースマイグレーションは不要。理由:
1. DBスキーマは既に要件を満たしている
2. 既存データに影響なし
3. アプリケーション層のバリデーションのみ変更

## Display Logic Changes

### View Command (view.ts:58)

**Before**:
```typescript
this.log(task.bodyMd);  // 空文字列の場合、空行のみ表示
```

**After**:
```typescript
this.log(task.bodyMd || '(no body)');  // プレースホルダー表示
```

**JSON Mode**: 変更不要
```typescript
this.log(JSON.stringify({ task, labels, comments }, null, 2));
// → bodyMd: "" がそのまま出力される（正しい動作）
```

## Data Flow

### Task Creation with Empty Body

```
User Input: mgtd task create --title "タイトル" --body "" --no-editor
         ↓
CLI Layer: create.ts (バリデーション削除後)
         ↓
Service: TaskService.create({ title, bodyMd: "", ... })
         ↓
DB: INSERT INTO issues (type, title, body_md, ...) VALUES ('task', 'タイトル', '', ...)
         ↓
Result: Task created with id=N, bodyMd=""
```

### Task Display with Empty Body

```
User Input: mgtd task view <id>
         ↓
CLI Layer: view.ts
         ↓
Service: TaskService.show(id) → { id, title, bodyMd: "", ... }
         ↓
Display: log(task.bodyMd || '(no body)') → 出力: "(no body)"
```

## Consistency Check

### Memo vs Task

現時点では **Task のみ** 空body許容に変更。

**Memo**: `packages/cli/src/commands/memo/create.ts:102`
```typescript
if (!body.trim()) {
  this.error('Memo body cannot be empty.');  // 引き続きエラー
}
```

**Rationale**:
- spec.md Out of Scopeに明記
- 段階的進歩の原則
- 別PRで対応予定

## Impact Analysis

### 既存データへの影響
- なし（スキーマ変更なし）

### 既存コードへの影響
- TaskService: 変更不要（既に空文字列を受け入れる実装）
- DBレイヤー: 変更不要
- CLIレイヤー: create.ts, view.ts のみ変更

### テストデータ
新規テストで作成するサンプルタスク:
```json
{
  "id": 999,
  "type": "task",
  "title": "Empty body test task",
  "bodyMd": "",
  "status": "open",
  "isBookmarked": false,
  "createdAt": "2025-10-16T...",
  "updatedAt": "2025-10-16T..."
}
```

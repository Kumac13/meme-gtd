# Data Model: Project List View Status Filter

**Date**: 2025-11-29
**Feature**: 001-task-112-project

## Entities

### 1. Filter State (クライアントサイド)

| Field | Type | Description |
|-------|------|-------------|
| statusFilter | `string` | 現在のステータスフィルタ値（'all', 'documents', 'inbox', 'open', 'next', 'waiting', 'scheduled', 'someday', 'done', 'canceled'） |
| bookmarkFilter | `boolean` | ブックマークフィルタの有効/無効 |

**永続化**: URL パラメータ (`?status=next&bookmarked=true`)

### 2. Task (既存エンティティ - 参照のみ)

| Field | Type | Description |
|-------|------|-------------|
| id | `number` | タスクID |
| title | `string \| null` | タスクタイトル |
| status | `string \| null` | ステータス値 |
| isBookmarked | `boolean` | ブックマーク状態 |

### 3. Memo (既存エンティティ - 参照のみ)

| Field | Type | Description |
|-------|------|-------------|
| id | `number` | メモID |
| bodyMd | `string` | メモ本文 |
| isBookmarked | `boolean` | ブックマーク状態 |

## Status Order Definition

ソート順序の優先度（小さいほど先に表示）:

| Status | Order | Category |
|--------|-------|----------|
| next | 0 | Active |
| waiting | 1 | Active |
| scheduled | 2 | Active |
| inbox | 3 | Active |
| open | 4 | Active |
| someday | 5 | Active |
| done | 6 | Completed |
| canceled | 7 | Completed |
| (memo) | 8 | Documents |

## State Transitions

### Filter State Transitions

```
[ページロード]
    ↓
URLパラメータ解析
    ↓
初期フィルタ状態設定
    ↓
┌─────────────────────┐
│   フィルタ表示      │ ←─────────────┐
└─────────────────────┘               │
    ↓                                 │
[フィルタボタンクリック]              │
    ↓                                 │
URLパラメータ更新 ─────────────────────┘
    ↓
リスト再レンダリング
```

## Validation Rules

1. **statusFilter**: 許可値のいずれかでなければ 'all' にフォールバック
2. **bookmarkFilter**: 'true' 文字列のみ true、それ以外は false
3. **フィルタ結果**: 空の場合は EmptyState コンポーネントを表示

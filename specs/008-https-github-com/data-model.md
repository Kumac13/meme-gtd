# Data Model: Link Command

**Date**: 2025-10-18
**Feature**: Link Command for Task Relationship Management

## Overview

linkコマンドのデータモデル定義。既存の`links`テーブル（schema/001_init.sql）を使用し、新規テーブル作成は不要。

## Entities

### Link (既存テーブル使用)

タスク/メモ間の関係性を表現するエンティティ。

**Database Table**: `links` (schema/001_init.sql line 60-68)

```sql
CREATE TABLE IF NOT EXISTS links (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    source_issue_id INTEGER NOT NULL,
    target_issue_id INTEGER NOT NULL,
    link_type TEXT NOT NULL CHECK (link_type IN ('parent', 'child', 'relates', 'derived_from')),
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
    FOREIGN KEY (source_issue_id) REFERENCES issues(id) ON DELETE CASCADE,
    FOREIGN KEY (target_issue_id) REFERENCES issues(id) ON DELETE CASCADE
);
```

**TypeScript Type** (既存 - `meme-gtd-shared/src/index.ts`):

```typescript
export interface Link {
  id: number;
  sourceIssueId: number;
  targetIssueId: number;
  linkType: 'parent' | 'child' | 'relates' | 'derived_from';
  createdAt: string;  // ISO 8601形式
}
```

**Fields**:

| Field | Type | Required | Description | Validation |
|-------|------|----------|-------------|------------|
| `id` | number | Yes (Auto) | リンクの一意識別子。自動採番 | PRIMARY KEY |
| `sourceIssueId` | number | Yes | リンク元のissue ID (task/memo) | FOREIGN KEY → issues.id, NOT NULL |
| `targetIssueId` | number | Yes | リンク先のissue ID (task/memo) | FOREIGN KEY → issues.id, NOT NULL |
| `linkType` | LinkType enum | Yes | リンクの種類 | CHECK constraint |
| `createdAt` | string (ISO 8601) | Yes (Auto) | リンク作成日時 | DEFAULT now() |

**Constraints**:

1. **Referential Integrity**: source/target issue IDsは`issues`テーブルに存在必須
2. **Cascade Delete**: issue削除時、関連linkも自動削除
3. **Link Type Validation**: 4種類のみ許可（parent, child, relates, derived_from）
4. **No explicit unique constraint**: 重複リンクのチェックはアプリケーション層で実施

---

### LinkType (Enum)

リンクの種類を表す列挙型。

**Values**:

| Value | Direction | Semantic | Example |
|-------|-----------|----------|---------|
| `parent` | target is parent of source | 「sourceの親はtarget」 | source=子タスク, target=親タスク |
| `child` | target is child of source | 「sourceの子はtarget」 | source=親タスク, target=子タスク |
| `relates` | non-hierarchical association | 「sourceとtargetは関連」 | 関連タスク同士 |
| `derived_from` | source was created from target | 「sourceはtargetから派生」 | source=task, target=memo |

**Note**: `parent`と`child`は逆向きの同じ関係を表現（ユーザーの入力しやすい方を選択可能）

---

## Relationships

### Link ↔ Issue (Task/Memo)

**Relationship**: Many-to-Many (through links table)

```
issues (1) ----< (N) links
  ^                     |
  |                     |
  +---------------------+
    (self-join via source/target)
```

**Cardinality**:
- 1つのissueは複数のlink（sourceまたはtarget）を持てる
- 1つのlinkは正確に1つのsource issueと1つのtarget issueを持つ

**Cascade Rules**:
- issue削除 → 関連するlink全て削除（CASCADE）
- link削除 → issueに影響なし

---

## Repository Input/Output Types

### CreateLinkInput

リンク作成時の入力型。

```typescript
export interface CreateLinkInput {
  sourceIssueId: number;
  targetIssueId: number;
  linkType: 'parent' | 'child' | 'relates' | 'derived_from';
}
```

**Validation Rules** (Service層で実施):
- `sourceIssueId` ≠ `targetIssueId` (自己参照禁止)
- 両IDが`issues`テーブルに存在
- 同じ(source, target, type)の組み合わせが未存在（重複禁止）

---

### ListLinksFilters

リンク一覧取得時のフィルタ条件。

```typescript
export interface ListLinksFilters {
  type?: 'parent' | 'child' | 'relates' | 'derived_from';
}
```

**Usage**:
- `type`未指定 → 全タイプのリンクを返す
- `type`指定 → 指定タイプのみフィルタ

---

## Data Flow

### Link Creation Flow

```
User Input
  ↓
CLI Command (link/add.ts)
  ↓ validate flags
LinkService.create(source, target, type)
  ↓ validate business rules
  ├─→ Check: source ≠ target
  ├─→ Check: source/target exist in issues
  └─→ Check: no duplicate link
  ↓ all validations pass
linkRepository.createLink(db, input)
  ↓ INSERT INTO links
Link object
```

### Link Listing Flow

```
User Input (issue ID)
  ↓
CLI Command (link/list.ts)
  ↓
LinkService.list(issueId, filters?)
  ↓
linkRepository.listLinks(db, issueId, filters)
  ↓ SELECT FROM links WHERE source_issue_id = ? OR target_issue_id = ?
  ↓ (optional) AND link_type = ?
Link[]
```

### Link Deletion Flow

```
User Input (link ID)
  ↓
CLI Command (link/remove.ts)
  ↓ confirm (unless --yes)
LinkService.remove(linkId)
  ↓ validate link exists
linkRepository.deleteLink(db, linkId)
  ↓ DELETE FROM links WHERE id = ?
void
```

---

## Database Indexes (Recommendations)

既存のスキーマにはindex定義なし。パフォーマンス最適化のため、以下のindexを推奨（オプション、Phase 2で検討）：

```sql
-- リンク一覧検索の高速化（issue IDからの検索が頻繁）
CREATE INDEX IF NOT EXISTS idx_links_source ON links(source_issue_id);
CREATE INDEX IF NOT EXISTS idx_links_target ON links(target_issue_id);

-- タイプフィルタの高速化
CREATE INDEX IF NOT EXISTS idx_links_type ON links(link_type);

-- 複合index（typeでフィルタしつつissue IDで検索）
CREATE INDEX IF NOT EXISTS idx_links_source_type ON links(source_issue_id, link_type);
CREATE INDEX IF NOT EXISTS idx_links_target_type ON links(target_issue_id, link_type);
```

**Note**: MVP（Phase 1）ではindex不要。データ量が増えた場合のみ追加検討。

---

## Edge Cases & Data Integrity

### 1. 循環参照（Circular Reference）

**Scenario**: A → B (parent), B → A (parent) を作成しようとする

**Handling**:
- MVP: 直接循環のみチェック（source/target逆転チェック）
- Future: 多段階循環（A→B→C→A）のグラフ探索

**Implementation** (Service層):
```typescript
// 直接循環チェック
const existing = linkRepository.findLink(db, {
  sourceIssueId: targetIssueId,
  targetIssueId: sourceIssueId,
  linkType: 'parent' // or 'child'
});
if (existing) throw new Error('Circular parent-child relationship detected');
```

### 2. Orphaned Links (孤立リンク)

**Scenario**: issue削除後、リンクが残る

**Handling**: `ON DELETE CASCADE`により自動削除（DB層で保証）

### 3. Duplicate Links (重複リンク)

**Scenario**: 同じ(source, target, type)のリンクを2回作成

**Handling**: Service層で事前チェック
```typescript
const existing = linkRepository.findLink(db, input);
if (existing) throw new Error('Link already exists');
```

### 4. 削除済みIssueへのリンク

**Scenario**: `is_deleted = 1`のissueにリンク作成

**Handling** (推奨):
- Option A: 削除済みissueへのリンク作成を禁止
- Option B: 削除済みでも許可（論理削除のため）

**Decision**: Option A（削除済みissueは不可視として扱う）

```sql
-- ID存在確認クエリ
SELECT id FROM issues WHERE id = ? AND is_deleted = 0
```

---

## Migration Notes

**No migration required** ✅

`links`テーブルは既に`schema/001_init.sql`で定義済み。新規カラム・テーブル追加なし。

---

## Summary

- **Entities**: Link（既存テーブル）、LinkType（enum）
- **New Types**: CreateLinkInput, ListLinksFilters
- **Validation**: Service層で実施（重複、自己参照、ID存在チェック）
- **Data Integrity**: FK制約とCASCADE削除で保証
- **Indexes**: Phase 1では不要、Phase 2で検討

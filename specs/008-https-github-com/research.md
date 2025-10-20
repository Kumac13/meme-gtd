# Research: Link Command Implementation

**Date**: 2025-10-18
**Feature**: Link Command for Task Relationship Management

## Overview

linkコマンド実装のための技術調査。既存のコマンド実装パターン（label、task、memo）を分析し、同じアーキテクチャパターンを適用する方針を決定。

## Technical Decisions

### Decision 1: Repository Pattern (データアクセス層)

**Chosen**: 関数ベースのRepository（labelRepositoryと同じパターン）

**Rationale**:
- 既存の`labelRepository.ts`が関数ベースで実装されている
- シンプルなCRUD操作には十分
- クラスベースにする必要性なし（状態を保持しない）

**Implementation Pattern** (from `packages/db/src/labelRepository.ts`):
```typescript
// 各操作を独立した関数としてexport
export const createLink = (db: Database, ...): Link => { ... }
export const listLinks = (db: Database, issueId: number, filters?): Link[] => { ... }
export const deleteLink = (db: Database, linkId: number): void => { ... }
export const getLinkById = (db: Database, linkId: number): Link => { ... }
```

**Alternatives Considered**:
- クラスベースRepository → 拒否理由: 既存パターンと異なる、過剰設計
- ORMライブラリ（TypeORM/Prisma） → 拒否理由: プロジェクトはbetter-sqlite3で統一

---

### Decision 2: Service Layer Necessity

**Chosen**: Serviceレイヤーを**実装する**（labelと同じ）

**Rationale**:
- 既存の`LabelService`（packages/core/src）が存在
- ビジネスロジック（バリデーション、エラーハンドリング）の集約場所
- CLIコマンドとDBの間の抽象化層として機能

**Implementation Pattern** (from label implementation):
```typescript
// packages/core/src/linkService.ts (新規作成)
export class LinkService {
  constructor(private options: { config: Config }) {}

  create(sourceId: number, targetId: number, type: LinkType): Link { ... }
  list(issueId: number, filters?: { type?: LinkType }): Link[] { ... }
  remove(linkId: number): void { ... }
}
```

**Why not skip Service**:
- バリデーションロジック（重複チェック、循環参照チェック、ID存在確認）をRepositoryに混ぜたくない
- CLIコマンドが直接DBを叩くと、ビジネスロジックが分散する

---

### Decision 3: CLI Command Structure

**Chosen**: oclifのサブコマンド構造（`commands/link/*.ts`）

**Rationale**:
- 既存のtask、memo、labelコマンドと同じ構造
- oclifのベストプラクティスに従う
- `mgtd link`でヘルプ表示、`mgtd link add`でサブコマンド実行

**Directory Structure**:
```
packages/cli/src/commands/
├── link.ts              # ルートコマンド（ヘルプ表示のみ）
└── link/
    ├── add.ts           # mgtd link add --type <type> --source <id> --target <id>
    ├── list.ts          # mgtd link list <id> [--type <type>] [--json]
    └── remove.ts        # mgtd link remove <link-id> [--yes]
```

**Flag Conventions** (from existing commands):
- `--json` / `-j`: JSON出力（全コマンド共通）
- `--yes` / `-y`: 確認スキップ（削除系コマンド共通）
- `--type` / `-t`: リンクタイプフィルタ（list）またはタイプ指定（add）

---

### Decision 4: Type Definitions

**Chosen**: 既存のLink型を使用（`meme-gtd-shared`パッケージ）

**Rationale**:
- `packages/shared/src/index.ts`に既にLink型が定義済み：
  ```typescript
  export interface Link {
    id: number;
    sourceIssueId: number;
    targetIssueId: number;
    linkType: 'parent' | 'child' | 'relates' | 'derived_from';
    createdAt: string;
  }
  ```
- 新規型定義不要、インポートして使用するだけ

**Additional Types Needed**:
```typescript
// packages/db/src/linkRepository.ts で定義
export interface CreateLinkInput {
  sourceIssueId: number;
  targetIssueId: number;
  linkType: 'parent' | 'child' | 'relates' | 'derived_from';
}

export interface ListLinksFilters {
  type?: 'parent' | 'child' | 'relates' | 'derived_from';
}
```

---

### Decision 5: Validation Logic

**Chosen**: Serviceレイヤーで実装（Repository前にチェック）

**Required Validations** (from spec.md FR-003～FR-005):
1. **ID存在確認**: source/target issueがissuesテーブルに存在するか
2. **重複防止**: 同じ(source, target, type)の組み合わせが既存か
3. **自己参照防止**: source ≠ target

**Implementation Location**: `packages/core/src/linkService.ts`

**SQL Queries Needed**:
```sql
-- ID存在確認
SELECT id FROM issues WHERE id = ? AND is_deleted = 0

-- 重複チェック
SELECT id FROM links
WHERE source_issue_id = ? AND target_issue_id = ? AND link_type = ?

-- 自己参照はTypeScriptで `if (source === target) throw ...`
```

**Circular Reference**: 仕様には記載されているが、実装の複雑さを考慮してPhase 1で再検討（MVP

では不要かも）

---

### Decision 6: Error Handling

**Chosen**: oclifの標準エラーハンドリング + カスタムエラーメッセージ

**Pattern** (from labelCreate.ts):
```typescript
try {
  const link = service.create(...);
  if (flags.json) {
    this.log(JSON.stringify(link, null, 2));
  } else {
    this.log(`Link created: ${link.id}`);
  }
} catch (error) {
  if (error instanceof Error) {
    this.error(error.message, { exit: 1 });
  }
  throw error;
}
```

**Error Messages**:
- `Issue #${id} not found` - ID存在チェック失敗
- `Link already exists` - 重複チェック失敗
- `Cannot link issue to itself` - 自己参照チェック失敗
- `Link #${id} not found` - 削除時にlink ID不在

---

### Decision 7: Testing Strategy

**Chosen**: Repository unit tests + Service unit tests（統合テストはオプション）

**Test Files**:
1. `packages/db/test/linkRepository.test.ts` - Repository関数のテスト
2. `packages/core/test/linkService.test.ts` - Serviceロジックのテスト

**Test Pattern** (from taskRepository.test.ts):
- テスト用の一時SQLiteデータベースを作成
- 各テストケースでセットアップ・クリーンアップ
- Vitestのdescribe/it構造

**Test Coverage**:
- createLink: 正常系、重複エラー、ID不在エラー、自己参照エラー
- listLinks: 空リスト、複数リンク、typeフィルタ
- deleteLink: 正常削除、ID不在エラー

---

## Best Practices Applied

### From Label Implementation
1. **JSON出力の一貫性**: `JSON.stringify(obj, null, 2)`
2. **エラーメッセージの明確性**: どのIDが見つからないか明示
3. **フラグ命名**: 既存コマンドと統一（`--json`, `--yes`）

### From Task Implementation
1. **Repository関数の命名**: `create*`, `list*`, `delete*`, `get*`
2. **SQL prepared statements**: `db.prepare().get()` / `.all()`
3. **型安全なrow変換**: `as`キャストとマッピング関数

### From Test Patterns
1. **一時DB使用**: `Database(':memory:')` + migrate
2. **テストデータのセットアップ**: beforeEach/afterEachでクリーンアップ

---

## Open Questions for Phase 1

### Q1: 循環参照チェックの実装
- **Question**: parent-child間の循環参照をどこまでチェックするか？
  - 直接循環（A→B, B→A）のみ？
  - 多段階循環（A→B→C→A）も？
- **Impact**: パフォーマンスとコード複雑度
- **Proposed**: MVP（P1）では直接循環のみチェック、多段階はPhase 2で検討

### Q2: リンク表示フォーマット
- **Question**: `mgtd link list <id>`の人間可読出力フォーマットは？
  - テーブル形式？
  - ツリー形式（parent/child可視化）？
- **Proposed**: シンプルなリスト形式（labelと同様）、ツリーは将来機能

### Q3: Bidirectional Link Handling
- **Question**: "relates"タイプは双方向表示すべきか？
  - A→B（relates）作成時、B側からも見えるべき？
- **Proposed**: DB上は単方向だが、list時にsource/target両方向でクエリ

---

## Dependencies & Tools Confirmed

| Dependency | Version | Usage |
|-----------|---------|-------|
| @oclif/core | 既存 | CLIフレームワーク |
| better-sqlite3 | 既存 | SQLite操作 |
| meme-gtd-shared | 既存 | Link型定義 |
| meme-gtd-config | 既存 | 設定管理 |
| vitest | 既存 | テストフレームワーク |

**No new external dependencies required** ✅

---

## Implementation Priority

1. **Phase 1 (MVP - User Story P1)**:
   - linkRepository基本CRUD
   - LinkService with basic validation
   - `link add` command (parent/child)
   - `link list` command

2. **Phase 2 (User Story P2-P3)**:
   - `link remove` command
   - relates/derived_from types
   - Advanced validation (circular ref)

3. **Phase 3 (Polish)**:
   - ツリー表示フォーマット
   - 統合テスト

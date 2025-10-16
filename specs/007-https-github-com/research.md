# Research: Allow Optional Task Body

**Feature**: タスク作成時にbodyを省略可能にする
**Date**: 2025-10-16

## Research Questions

### Q1: 空bodyバリデーションの削除は安全か？

**Decision**: 安全

**Rationale**:
- DBスキーマは既に `body_md TEXT NOT NULL DEFAULT ''` として空文字列を許容
- `TaskService.create()` は空文字列を受け入れる実装
- バリデーション削除は create.ts:118 の1行のみ
- 後方互換性: 既存の body 指定ユーザーは影響なし

**Alternatives Considered**:
- オプションフラグで切り替え → 不要な複雑性、YAGNI原則に反する
- 空body時に警告表示 → UX を損ねる、GTDの素早さに反する

**References**:
- packages/cli/src/commands/task/create.ts:100-119
- packages/db/src/schema.sql
- spec.md FR-003

---

### Q2: プレースホルダーメッセージの文言は？

**Decision**: "(no body)" を採用

**Rationale**:
- 簡潔で明確
- 他のCLIツール (gh, git) でも同様のパターン使用
- 括弧で視覚的に区別可能
- 英語のみで問題なし（個人用CLI、国際化は将来対応）

**Alternatives Considered**:
- "(empty)" → bodyの意図が不明
- "(body not provided)" → 冗長
- 空行のまま → ユーザーが混乱する可能性

**References**:
- spec.md FR-007, SC-005
- packages/cli/src/commands/task/view.ts:58

---

### Q3: memo create も同時に修正すべきか？

**Decision**: 別issue/PRで対応

**Rationale**:
- 変更範囲の最小化（段階的進歩の原則）
- task create のみで十分な価値提供
- memo create は別の動機・テストケースが必要
- spec.md Out of Scope に明記済み

**Alternatives Considered**:
- 同時修正 → テスト範囲拡大、PRレビューの負荷増

**References**:
- spec.md Out of Scope
- packages/cli/src/commands/memo/create.ts:102

---

### Q4: テスト戦略

**Decision**: E2Eテストを追加

**Rationale**:
- 既存のtest/cli-e2e.test.jsパターンに従う
- タスク作成→一覧表示→詳細表示の一連の流れを検証
- JSONモードでも空文字列が正しく出力されることを確認

**Test Cases**:
1. `mgtd task create --title "test" --body "" --no-editor --json` → 成功、bodyMd: ""
2. `mgtd task view <id>` → "(no body)" が表示される
3. `mgtd task view <id> --json` → bodyMd: "" が含まれる
4. 既存テスト (非空body) が引き続きパス

**Alternatives Considered**:
- ユニットテストのみ → E2Eテストがより実用的
- 手動テストのみ → 回帰防止に不十分

**References**:
- packages/cli/test/cli-e2e.test.js
- spec.md User Story 1, 3

---

## Implementation Approach

### Phase 1: バリデーション削除
1. packages/cli/src/commands/task/create.ts:117-119 を削除
2. 既存テストが全てパスすることを確認

### Phase 2: プレースホルダー追加
1. packages/cli/src/commands/task/view.ts:58 を修正
   ```typescript
   this.log(task.bodyMd || '(no body)');
   ```
2. JSON出力は変更不要（既に正しく空文字列を出力）

### Phase 3: テスト追加
1. packages/cli/test/commands/task/create-empty-body.test.js を新規作成
2. 上記Test Casesを実装

### Phase 4: ドキュメント更新
1. docs/cli_requirement.md に空body許容を追記

---

## Risk Analysis

### Low Risk
- DBスキーマ変更なし
- 既存API変更なし
- 影響範囲が限定的（2ファイル + テスト）

### Mitigation
- 既存テスト100%パス確認
- E2Eテストで回帰防止
- バージョンバンプ (0.3.0 → 0.4.0) で新機能を明示

---

## Success Metrics

実装完了の判定基準:
1. ✅ 既存テスト全てパス
2. ✅ 新規E2Eテスト全てパス
3. ✅ `pnpm build` 成功
4. ✅ ドキュメント更新完了
5. ✅ マニュアルテスト: 空bodyタスクの作成・表示・JSON出力

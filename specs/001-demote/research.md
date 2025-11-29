# Research: タスクをメモにdemote機能

**Feature**: 001-demote
**Date**: 2025-11-29

## 技術スタック確認

### Decision: 既存スタックを使用
- **TypeScript**: 5.5.4
- **Node.js**: 22.0.0+
- **Database**: SQLite (better-sqlite3 9.0.0)
- **API**: Fastify 5.2.0
- **CLI**: @oclif/core 4.0.0
- **Testing**: Node.js built-in test runner + tsx

### Rationale
既存のモノレポ構造とパッケージ構成に従う。新しい依存関係は不要。

## 既存パターン調査

### Decision: promoteパターンを反転して実装
- `promoteMemo` (memo → task) の逆操作として `demoteTask` (task → memo) を実装
- 同じリンクタイプ `derived_from` を使用（方向は逆）
- Service層・API層・CLI層の構造を踏襲

### Rationale
既存のpromote実装が成熟しており、対称的な設計により一貫性を保てる。

### Alternatives Considered
1. **新規パターン導入**: 却下 - 学習コスト増、保守性低下
2. **copyToMemo という別概念**: 却下 - promote/demoteの対称性が失われる

## データモデル確認

### Decision: 既存スキーマで対応可能
- `issues` テーブル: type='memo' で新規レコード作成
- `links` テーブル: source=memo, target=task, link_type='derived_from'
- `issue_labels` テーブル: ラベル継承
- `issue_projects` テーブル: プロジェクト継承

### Rationale
スキーマ変更不要。既存のリンクタイプと関連テーブルで要件を満たせる。

## メモ本文組み立てロジック

### Decision: タイトル + 本文 + コメント を結合
```
# {task.title}

{task.body_md}

---
## コメント

### {comment.created_at}
{comment.body_md}
```

### Rationale
- タイトルを見出し1として追加（メモにはtitleフィールドがないため）
- コメントは時系列順で本文に結合
- コメントがない場合はセクション省略

## エディタ統合

### Decision: 既存のeditor utilityを使用
- `packages/cli/src/utils/editor.ts` の `openEditor` 関数を使用
- `$EDITOR` 環境変数でエディタ指定
- `--no-editor` フラグで編集スキップ

### Rationale
promote コマンドと同じパターン。ユーザー体験の一貫性を維持。

## API設計

### Decision: RESTful エンドポイント
```
POST /api/tasks/:id/demote
Request Body: { bodyMd?: string, labelIds?: number[] }
Response: { memo: Memo, taskId: number }
```

### Rationale
- promote の `POST /api/memos/:id/promote` と対称
- bodyMd省略時は自動生成
- labelIds省略時はタスクから継承

## 未解決事項

なし。全ての技術的な不明点は解消済み。

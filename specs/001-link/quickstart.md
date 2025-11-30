# Quickstart: link設定時の検索機能

**Date**: 2025-11-30
**Feature**: 001-link

## 前提条件

- Node.js 22+
- pnpm 10.23.0+

## 開発環境セットアップ

```bash
# リポジトリルートで実行
pnpm install
pnpm build

# テストAPIサーバー起動（ポート3001）
pnpm server:dev
```

## 開発ワークフロー

### 1. Webパッケージの開発サーバー起動

```bash
pnpm dev:web
```

ブラウザで http://localhost:5173 にアクセス（Vite開発サーバー）
APIは http://localhost:3001 に接続

### 2. 新規コンポーネント作成

```bash
# IssuePicker コンポーネント
touch packages/web/src/components/IssuePicker.tsx
```

### 3. 型定義追加（必要に応じて）

```bash
# types/links.ts に IssuePickerItem 型を追加
```

## テスト実行

```bash
# ユニットテスト
pnpm --filter meme-gtd-web test

# E2Eテスト
pnpm --filter meme-gtd-web test:e2e
```

## 確認ポイント

### 機能確認

1. **タスク詳細ページ** → Links セクション → "+ Add" ボタン
2. リンクタイプ選択後、検索UIが表示される
3. テキスト入力で検索結果が表示される
4. 候補クリックでリンクが追加される

### キーボード操作確認

- ↓↑: 候補間移動
- Enter: 選択確定
- Esc: キャンセル

## 関連ファイル

| ファイル | 説明 |
|----------|------|
| `packages/web/src/components/IssuePicker.tsx` | 新規: 検索/選択UI |
| `packages/web/src/components/AddLinkInline.tsx` | 修正: IssuePicker統合 |
| `packages/web/src/components/TaskFormLinks.tsx` | 修正: IssuePicker統合 |
| `packages/web/src/api/services/TasksService.ts` | 参照: 検索API |
| `packages/web/src/api/services/MemosService.ts` | 参照: 検索API |

## トラブルシューティング

### APIエラー

```bash
# テストサーバーが起動しているか確認
curl http://localhost:3001/api/tasks
```

### 型エラー

```bash
# TypeScriptコンパイルチェック
pnpm --filter meme-gtd-web exec tsc --noEmit
```

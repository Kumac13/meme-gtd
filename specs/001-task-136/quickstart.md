# Quickstart: 画像添付機能

**Feature**: 001-task-136
**Date**: 2025-12-05

## 概要

メモ/タスクに画像（スクリーンショット等）を添付する機能。Web UIからドラッグ＆ドロップでアップロードし、CLI出力ではClaude Codeが認識できる絶対パス形式で出力される。

## 前提条件

- Node.js 22+
- pnpm
- meme-gtd 開発環境セットアップ済み

## クイックスタート

### 1. 依存パッケージの追加

```bash
# APIパッケージに@fastify/multipartを追加
cd packages/api
pnpm add @fastify/multipart
```

### 2. 開発サーバーの起動

```bash
# テスト環境でサーバー起動
pnpm server:dev
```

### 3. 画像アップロードのテスト

```bash
# 画像をアップロード
curl -X POST http://localhost:3001/api/attachments/1 \
  -F "file=@/path/to/image.png"

# レスポンス例:
# {
#   "id": "a1b2c3d4-...",
#   "filename": "a1b2c3d4-....png",
#   "absolutePath": "/Users/xxx/.mgtd/attachments/1/a1b2c3d4-....png",
#   "markdownRef": "![image](/Users/xxx/.mgtd/attachments/1/a1b2c3d4-....png)",
#   "mimeType": "image/png",
#   "size": 102400
# }
```

### 4. 画像の取得

```bash
# 画像を取得
curl http://localhost:3001/api/attachments/1/a1b2c3d4-....png -o output.png
```

## 主要ファイル

| ファイル | 説明 |
|----------|------|
| `packages/api/src/routes/attachments.ts` | アップロード/配信ルート |
| `packages/api/src/handlers/attachmentHandlers.ts` | ファイル処理ロジック |
| `packages/web/src/components/ImageUploader.tsx` | ドラッグ&ドロップUI |
| `packages/web/src/utils/markdown.tsx` | 画像パス変換 |

## ストレージ

画像は以下のパスに保存される:

```
~/.mgtd/attachments/{issue_id}/{uuid}.{ext}

例:
/Users/kumac13/.mgtd/attachments/42/a1b2c3d4-e5f6-7890-abcd-ef1234567890.png
```

## 制限事項

- ファイルサイズ: 最大10MB
- 対応形式: PNG, JPEG, GIF, WebP
- アップロード方法: Web UIのみ（CLIからのアップロードは未対応）

## トラブルシューティング

### 画像がアップロードできない

1. ファイルサイズが10MB以下か確認
2. ファイル形式がPNG/JPEG/GIF/WebPか確認
3. サーバーログで詳細なエラーを確認

### Web UIで画像が表示されない

1. APIサーバーが起動しているか確認
2. ブラウザの開発者ツールでネットワークエラーを確認
3. 画像ファイルが `~/.mgtd/attachments/` に存在するか確認

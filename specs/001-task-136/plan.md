# Implementation Plan: 画像添付機能

**Branch**: `001-task-136` | **Date**: 2025-12-05 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/001-task-136/spec.md`

## Summary

メモ/タスクに画像（スクリーンショット等）を添付できる機能。Web UIからクリップボードペースト（メイン）またはドラッグ＆ドロップで画像をアップロードし、本文にMarkdown形式の画像参照を挿入。画像は `~/.mgtd/attachments/{uuid}.{ext}` にフラット構造で保存され（issueに紐付けない）、CLI出力ではClaude Codeが認識できる絶対パス形式で出力される。

## Technical Context

**Language/Version**: TypeScript 5.5.4 / Node.js 22+
**Primary Dependencies**:
- Backend: Fastify 5.2.0, @fastify/multipart (新規追加)
- Frontend: React 19.2.0, react-markdown 10.1.0
**Storage**: ファイルシステム (`~/.mgtd/attachments/`)
**Testing**: tsx --test (Node.js test runner), vitest (frontend)
**Target Platform**: macOS/Linux (Node.js server + Web browser)
**Project Type**: Monorepo (packages/api, packages/web, packages/cli)
**Performance Goals**: 10MB以下の画像を10秒以内にアップロード
**Constraints**: ファイルサイズ上限10MB、対応形式 PNG/JPEG/GIF/WebP
**Scale/Scope**: 単一ユーザー向けローカルアプリケーション

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Constitution未設定のため、以下の一般的なガイドラインに従う:
- [x] 既存のパッケージ構造に従う（packages/api, packages/web）
- [x] 新規ライブラリの追加は最小限に抑える（@fastify/multipartのみ）
- [x] DBスキーマ変更なし（ファイルシステムのみ使用）
- [x] 既存のAPI設計パターン（Fastify + Zod）に従う

## Project Structure

### Documentation (this feature)

```text
specs/001-task-136/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   └── attachments.yaml # OpenAPI spec for attachment endpoints
└── tasks.md             # Phase 2 output (/speckit.tasks command)
```

### Source Code (repository root)

```text
packages/
├── api/
│   └── src/
│       ├── routes/
│       │   └── attachments.ts      # 新規: 画像アップロード/配信ルート
│       ├── handlers/
│       │   └── attachmentHandlers.ts # 新規: 画像処理ハンドラ
│       ├── schemas/
│       │   └── attachmentSchemas.ts  # 新規: Zodスキーマ
│       └── server.ts                 # 更新: attachmentsルート登録
├── web/
│   └── src/
│       ├── components/
│       │   ├── EditableContent.tsx   # 更新: textarea上で画像ペースト/D&D対応
│       │   └── CommentSection.tsx    # 更新: コメント用textareaで画像ペースト対応
│       ├── utils/
│       │   └── markdown.tsx          # 更新: 画像パスをAPIエンドポイントに変換
│       └── hooks/
│           └── useImageUpload.ts     # 新規: アップロードフック
└── config/
    └── src/
        └── index.ts                  # 更新: attachmentsPath追加（将来の拡張用）
```

**Structure Decision**: 既存のmonorepo構造に従い、packages/apiに新規ルート、packages/webに新規コンポーネントを追加。画像はファイルシステムに保存し、DBスキーマは変更しない。

## Complexity Tracking

> 本機能はシンプルな設計のため、複雑性の正当化は不要。

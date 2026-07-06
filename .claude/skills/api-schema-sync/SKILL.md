---
name: api-schema-sync
description: Use whenever changing API contracts — anything under packages/api/src/schemas/, routes, or handlers. Propagates the change through openapi.yaml regeneration, the generated web client, hand-written iOS Swift models, CLI commands, and docs. The change is NOT complete until every downstream step is done.
---

# APIスキーマ変更の同期チェーン

API契約は4段階で伝播する。**上流を変えたら下流を全て更新するまで作業は完了していない。**
このスキルが同期手順の唯一の正。iOS Swiftモデル↔スキーマの完全な対応表は `docs/architecture.md` の「API契約の同期チェーン」にある。

```
[1] packages/api/src/schemas/*.ts   (Zodスキーマ = 契約の正)
     │  pnpm --filter meme-gtd-api openapi:generate
     ▼
[2] packages/api/docs/api/openapi.yaml   (自動生成・手編集禁止)
     │  pnpm --filter meme-gtd-web generate:api
     ▼
[3] packages/web/src/api/   (自動生成クライアント・手編集禁止)

[4] ios/MemeGTD/MemeGTD/Models/*.swift + ios/MemeGTD/Shared/ArticleModels.swift
     （手書き。自動生成されない。**手動で同期すること**）
```

## API変更時チェックリスト

- [ ] `packages/api/src/schemas/` のZodスキーマを変更
- [ ] ルート/ハンドラを変更（`src/routes/`, `src/handlers/`）
- [ ] 統合テストを追加・更新（`packages/api/test/integration/` — **テストなしのバックエンド変更は禁止**）
- [ ] `pnpm --filter meme-gtd-api openapi:generate` で openapi.yaml を再生成
- [ ] `pnpm --filter meme-gtd-api openapi:validate` で検証
- [ ] Webが該当APIを使う場合: `pnpm --filter meme-gtd-web generate:api` でクライアント再生成 + UI側の対応
- [ ] iOSが該当APIを使う場合: 対応するSwiftモデルを手動更新（完全な対応表は `docs/architecture.md`）+ `xcodebuild` でビルド確認
- [ ] CLIが該当機能を持つ場合: `packages/cli/src/commands/` の対応コマンドを更新
- [ ] `docs/architecture.md`（エンドポイントマップ）・`docs/er-diagram.md`（データモデル）・`docs/api-filtering.md` / `docs/cli-commands.md` の該当箇所を更新

## iOS同期時の注意

- enumのraw value（例: `LinkType` の `"derived_from"`、`TaskStatus` の各値）は文字列でバックエンドと一致させる
- 日付はISO形式（`yyyy-MM-dd` / `yyyy-MM-dd'T'HH:mm:ss`）
- iOSビルド確認: `xcodebuild -scheme MemeGTD -destination 'platform=iOS Simulator,name=iPhone 17' build`（作業ディレクトリは `ios/MemeGTD/`）

## 設計上の禁止事項

- `openapi.yaml` と `packages/web/src/api/` は自動生成物 — 手編集禁止
- その他の設計境界（Zod/sharedの分離、promote-preview整形ロジックの複製禁止）は `packages/api/CLAUDE.md`「設計上の境界」が正

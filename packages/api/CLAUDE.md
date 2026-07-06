# API開発ガイド

## ルート追加・変更

- ルートは自動探索されない。`src/routes/` に定義したら `src/server.ts` の `buildApp()` 内の登録ブロックと Swagger の `tags` 配列にも追加する（忘れても型エラーは出ず、実行時404になる）
- スキーマ変更の下流同期（openapi.yaml 再生成 → Webクライアント → iOS Swiftモデル → CLI → docs）は api-schema-sync スキルが唯一の正

## sync API の規約

- push は op ごとに独立トランザクションで、部分成功が仕様。バッチ全体を1つのトランザクションで包まない（1件の conflict/skip が他の op を巻き込まない設計）
- create 専用エンティティ（task / article / label / issue_label / link）の制約は `src/schemas/syncSchemas.ts` の superRefine と `packages/core/src/syncService.ts` の applyCreateOnly の2箇所に実装がある。変更時は両方更新する
- 冪等化は opId 台帳 + 自然キー再検出の二段構え。競合ルールとプロトコル全体は `docs/architecture.md`「同期アーキテクチャ」が正

## テスト

- バックエンド変更には必ずテストを書く（ルートCLAUDE.md）。配置は `test/integration/`
- ヘルパーは `createTestServer`（`test/helpers/testServer.ts`）と `test/helpers/fixtures.ts` を使う（書き方は既存テストに倣う）

## 設計上の境界

- Zodスキーマ（HTTP契約）と `packages/shared` の型（ドメイン型）は意図的に別物。統合しない
- memo→task 昇格の本文整形は promote-preview API が正。クライアント側への複製は iOS Standalone の `PromoteEngine.swift` が唯一の例外（整形仕様を変えるときは TS/Swift 両実装とパリティテストを同時更新）

## Push前の検証

```bash
pnpm --filter meme-gtd-api lint && pnpm --filter meme-gtd-api openapi:generate && pnpm --filter meme-gtd-api openapi:validate && pnpm --filter meme-gtd-api test
```

スキーマを変更した場合は openapi:generate で生じた openapi.yaml の差分もコミットに含める。

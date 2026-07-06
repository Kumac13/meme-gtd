# core開発ガイド

## 責務

ドメインサービス層。CLI（直接呼び出し）とAPI（ハンドラ経由）の両方から使われる共通ビジネスロジック。

```
src/
├── index.ts          # MemoService / TaskService / LabelService / ArticleService
├── linkService.ts    # LinkService
├── projectService.ts # ProjectService
├── urlLinkService.ts # UrlLinkService
├── syncService.ts    # SyncService（iOSオフライン同期の push 適用）
├── activity-log/     # ActivityLogger + payload-builder
├── embedding/        # embeddingClient / embeddingService / vectorSearch
└── domain/           # ドメインロジック（article等）
```

## 実装ルール

mutationには必ずActivityLoggerでイベントを記録すること（欠落するとWeb/iOSのタイムライン表示から消える）。

- サービスのパターン: コンストラクタで `{ config?, db?, sourceType? }` を受け取り、db層のリポジトリを呼び、`ActivityLogger`でイベント（`task.created`等）を記録する
- 新しいmutationメソッドを追加する際、イベント記録を忘れるとアクティビティログ（Web/iOSのタイムライン表示）から欠落する
- イベントタイプを追加する場合は `packages/shared/src/types/activity-log.ts` の定数も更新
- `sourceType`（`cli`/`api`/`system`）は呼び出し元が指定する。ロガーを共通化・統合しないこと（操作元の記録が目的）
- リポジトリ（`meme-gtd-db`）をサービスを迂回して直接呼ぶ実装をCLI/APIに書かない。ロジックはここ（core）に置く

## sync経由のmutation

- SyncService（`syncService.ts`）の mutation も必ずドメインサービスの sync 専用メソッド（`createFromSync` / `addCommentFromSync` 等）を経由する（activity log の完全性を保つため。リポジトリ直呼び禁止は通常の mutation と同じ）
- `createFromSync` 系はクライアント指定の uuid / createdAt をそのまま保存する sync 専用API。通常の `create()` と統合しない
- push の op 単位独立トランザクション（部分成功）は仕様。`applyOne` の外側でまとめてトランザクションを張らない（内側のサービスの `db.transaction()` は better-sqlite3 の savepoint 前提の意図的なネスト）

## 注意

- このパッケージの変更は **CLIとAPIの両方に即座に影響する**。両方の観点でテストすること（テストなしのバックエンド変更は禁止）
- embedding機能はオプトイン（`mgtd embedding sync`実行後のみ有効）。embedding設定は`~/.config/mgtd/.env`から読む

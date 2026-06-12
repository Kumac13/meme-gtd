# core開発ガイド

## 責務

ドメインサービス層。CLI（直接呼び出し）とAPI（ハンドラ経由）の両方から使われる共通ビジネスロジック。

```
src/
├── index.ts          # MemoService / TaskService / LabelService / ArticleService
├── linkService.ts    # LinkService
├── projectService.ts # ProjectService
├── urlLinkService.ts # UrlLinkService
├── activity-log/     # ActivityLogger + payload-builder
├── embedding/        # embeddingClient / embeddingService / vectorSearch
└── domain/           # ドメインロジック（article等）
```

## 実装ルール

**IMPORTANT: mutationには必ずActivityLoggerでイベントを記録すること**

- サービスのパターン: コンストラクタで `{ config?, db?, sourceType? }` を受け取り、db層のリポジトリを呼び、`ActivityLogger`でイベント（`task.created`等）を記録する
- 新しいmutationメソッドを追加する際、イベント記録を忘れるとアクティビティログ（Web/iOSのタイムライン表示）から欠落する
- イベントタイプを追加する場合は `packages/shared/src/types/activity-log.ts` の定数も更新
- `sourceType`（`cli`/`api`/`system`）は呼び出し元が指定する。ロガーを共通化・統合しないこと（操作元の記録が目的）
- リポジトリ（`meme-gtd-db`）をサービスを迂回して直接呼ぶ実装をCLI/APIに書かない。ロジックはここ（core）に置く

## 注意

- このパッケージの変更は **CLIとAPIの両方に即座に影響する**。両方の観点でテストすること（テストなしのバックエンド変更は禁止）
- embedding機能はオプトイン（`mgtd embedding sync`実行後のみ有効）。embedding設定は`~/.config/mgtd/.env`から読む

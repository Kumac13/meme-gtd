# CLI開発ガイド

## コマンド追加・変更チェックリスト

1. `src/commands/<topic>/<sub>.ts` に実装する（トピック直下コマンドは `src/commands/<topic>.ts`）
2. `src/index.ts` の `MULTIWORD_COMMANDS` に登録する。漏れるとスペース区切り構文（`mgtd task comment add`）がヘルプ表示に落ちる
   - 各エントリはセグメント配列。長い（具体的な）ものを先に並べる: `['memo', 'comment', 'add']` → `['memo', 'comment']` → `['memo']`
   - サブコマンドを持つ親コマンド自体も登録する
3. テストを追加する。`pnpm test` は明示グロブ（`test/*.test.js` と `test/commands/{task,memo,project,db}/*.test.js`）なので、それ以外の場所に置いたテストは package.json のグロブに追加しないと実行されない
4. `docs/cli-commands.md` を更新する（オプションは `[options]` 等で省略せず全文記載、使用例は実際に動く完全なコマンド）
5. `scripts/completions/`（bash/zsh/fish）に影響する場合は更新する（手書きで自動同期されない）
6. 動作確認は `pnpm build && pnpm mgtd:test <コマンド>`。`mgtd` の直接実行は禁止（test-env スキル）

## 実装ルール

- 一覧・取得系コマンドには `--json` フラグを実装し、出力形状を既存コマンドに合わせる
- コマンド体系・オプション設計は GitHub CLI（`gh`）を参考にし、実装前に公式ドキュメントで確認する
- ヘルプテキスト・出力メッセージは英語
- バージョン表示は `src/index.ts` の自前処理（oclifルーティング前段）と `src/commands/version.ts` の2箇所にある。直すときは両方

---
name: cli-command-add
description: Use when adding, renaming, or removing an mgtd CLI command or subcommand in packages/cli. Registers the command in MULTIWORD_COMMANDS (forgetting this breaks space-separated syntax) and updates docs/cli-commands.md, tests, and shell completions.
---

# CLIコマンド追加・変更手順

## チェックリスト

- [ ] `packages/cli/src/commands/` にコマンド実装を追加
- [ ] `packages/cli/src/index.ts` の `MULTIWORD_COMMANDS` に登録（**忘れるとスペース区切り構文が動かない**）
- [ ] テストを追加（`packages/cli/test/` — テストなしのバックエンド変更は禁止）
- [ ] `docs/cli-commands.md` を更新（コマンド構文・オプション・使用例を省略せず全文記載）
- [ ] シェル補完（`scripts/completions/`）に影響する場合は更新

## MULTIWORD_COMMANDS の登録ルール

場所: `packages/cli/src/index.ts`（ファイル冒頭付近）

- 各エントリはセグメントの配列（例: `['task', 'comment', 'add']`）
- **より長い（具体的な）エントリを先に並べる**（例: `['memo', 'comment', 'add']` → `['memo', 'comment']` → `['memo']` の順）
- サブコマンドを持つ親コマンド自体もエントリとして登録する

```typescript
const MULTIWORD_COMMANDS = [
  ['memo', 'comment', 'add'],
  ['memo', 'comment'],
  ['memo', 'create'],
  ['memo'],
  // ...
];
```

## 動作確認（必ずテスト環境で）

**❌ `mgtd` の直接実行は禁止**（test-env スキル参照）。

```bash
pnpm build
pnpm mgtd:test <新コマンド> --help
pnpm mgtd:test <新コマンド> <引数> --json
```

## ドキュメント記載ルール

- CLIコマンドのオプションは `[options]` などで省略せず全文を記載する
- 使用例は実際に動く完全なコマンドを記載する

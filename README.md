# meme-gtd CLI

## 動作前提
- Node.js 22.18.0 以上
- corepack / pnpm 9 系

```bash
corepack enable
corepack prepare pnpm@9.0.0 --activate
```

## セットアップ手順
1. 依存インストールとビルド
   ```bash
   pnpm install
   pnpm build
   ```
2. CLI のインストール／利用
   - pnpm 経由で直接実行する場合
     ```bash
     pnpm --filter meme-gtd-cli exec node dist/index.js --help
     pnpm --filter meme-gtd-cli exec node dist/index.js init --db ~/.local/share/mgtd/issues.db --force
     ```
   - グローバルコマンドとしてインストールする場合（推奨）
     ```bash
     pnpm run mgtd:install
     # ~/.local/bin を PATH に追加していない場合は追加
     export PATH="$HOME/.local/bin:$PATH"

     mgtd --help
     mgtd init --db ~/.local/share/mgtd/issues.db --force
     mgtd memo create --body "first memo"
     mgtd memo list --json
     mgtd memo comment add 1 --body "first comment"
     mgtd memo --help
     ```

## テスト実行
```bash
pnpm test
```

## 主なサブコマンド一覧
| コマンド | 説明 |
| --- | --- |
| `mgtd init` | SQLite DB と context.json を初期化（`--db`, `--force`, `--dry-run`, `--json`） |
| `mgtd memo create` | 新規メモ作成（`--body`, `--body-file`, `--label`, `--project`, `--json`） |
| `mgtd memo list` | メモ一覧取得（`--label`, `--search`, `--limit`, `--order`, `--json`） |
| `mgtd memo promote` | メモをタスクに昇格（`--title`, `--body`, `--label`, `--status`, `--json`） |
| `mgtd memo comment` | コメント追加/編集/削除 |
| `mgtd memo label` | ラベル追加/削除/置換 |

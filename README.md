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
     pnpm --filter meme-gtd-cli exec node dist/index.js memo comment --help
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
     mgtd memo view 1 -c
     mgtd memo --help
     mgtd memo comment --help
     ```

## Web UI

### 起動方法
1. 全パッケージをビルド
   ```bash
   pnpm install
   pnpm -r build
   ```

2. APIサーバーを起動
   ```bash
   pnpm run server:start
   ```

3. ブラウザで `http://localhost:3000` にアクセス

### 機能
- Memo/Task一覧表示（フィルター機能付き）
- Memo/Task詳細表示（Markdown表示）
- Memo/Task作成・編集・削除
- コメント投稿・編集・削除
- Bookmark機能
- Task Status変更
- **Kanbanボード表示** (`/kanban`) - GitHub Projects風のカンバンビューでタスクをステータス別（Open/Next/Waiting/Scheduled/Done/Canceled）に表示し、各カードから直接ステータスを変更可能

## テスト実行
```bash
pnpm test
```

## ヘルプの参照
- すべてのコマンドで `--help` / `-h` を利用可能。サブコマンドは GitHub CLI と同様にスペース区切りで指定できる。
- 例:
  ```bash
  mgtd memo comment --help
  mgtd memo view --help
  mgtd label list --help
```
- 出力には `USAGE`, `ARGUMENTS`, `FLAGS`, `EXAMPLES` などが含まれ、`--json` などのオプション説明も確認できる。

## 補完スクリプト
- `mgtd completion --shell <bash|zsh|fish>` で組み込みスクリプトを出力できます。
- インストール例:
  ```bash
  # bash
  mgtd completion --shell bash --target ~/.local/share/mgtd/completions/mgtd.bash
  echo 'source ~/.local/share/mgtd/completions/mgtd.bash' >> ~/.bashrc

  # zsh
  target="$HOME/.local/share/mgtd/completions/mgtd.zsh"
  mgtd completion --shell zsh --target "$target"
  echo 'fpath=("$HOME/.local/share/mgtd/completions" $fpath)' >> ~/.zshrc
  echo 'autoload -Uz compinit && compinit' >> ~/.zshrc

  # fish
  mgtd completion --shell fish --target ~/.config/fish/completions/mgtd.fish
  ```
- `--print-path` を付けると、バンドル済みスクリプトの格納場所を確認できます。
  ```bash
  mgtd completion --shell zsh --print-path
  ```
- シェルを再起動するか設定ファイルを再読み込みすると、`mgtd` のサブコマンドやフラグを補完できます。

## 開発

### バージョン管理

バージョン管理戦略とリリースプロセスについては [docs/versioning.md](./docs/versioning.md) を参照してください。

## リリースパッケージ
- `pnpm mgtd:pack` で `pnpm pack` を実行し、`meme-gtd-cli-<version>.tgz` を生成できます。
- 事前に `pnpm build` が走るため、最新ビルド成果物が含まれます。

## 主なサブコマンド一覧
| コマンド | 説明 |
| --- | --- |
| `mgtd init` | SQLite DB と context.json を初期化（`--help` で USAGE/FLAGS を確認） |
| `mgtd memo create` | 新規メモ作成（`--body`, `--body-file`, `--label`, `--project`, `--json` 等） |
| `mgtd memo list` | メモ一覧取得（`--label`, `--search`, `--limit`, `--order`, `--json` 等） |
| `mgtd memo promote` | メモをタスクに昇格（`--title`, `--body`, `--label`, `--status`, `--json` 等） |
| `mgtd memo comment` | コメント閲覧/操作（`add`/`edit`/`delete` サブコマンドと `--json` など） |
| `mgtd label list` | 統合ラベル一覧表示（memo/task共通、`--json` など） |
| `mgtd label create` | 新規ラベル作成（`--description`, `--json` など） |
| `mgtd label set` | issueにラベル割り当て（memo/task共通、`<issue-id> <label-id>`） |
| `mgtd label delete` | ラベル削除（CASCADE、`--json` など） |
| `mgtd link add` | issue間のリンク作成（`--type`, `--source`, `--target`, `--json` など） |
| `mgtd link list` | 指定issueのリンク一覧表示（`--type`, `--json` など） |
| `mgtd link remove` | リンク削除（確認プロンプト、`--yes`, `--json` など） |

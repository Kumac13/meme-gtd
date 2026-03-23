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

## ブラウザ拡張機能（Webクリッパー）

Web閲覧中の記事を保存するためのChrome拡張機能が利用可能です。
インストール方法の詳細は [docs/extension-setup.md](./docs/extension-setup.md) を参照してください。

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
- Link管理（親子関係・関連付け）
- Project管理（Board/Tableビュー対応）
- GitHub風検索構文によるLabel/Status検索

## セマンティック検索（ベクトル検索）

テキストの意味的な近さでissueを検索できます。SQLite FTS5のキーワード検索に加え、「料理」で検索すると「晩ごはんの献立を考える」がヒットするような意味ベースの検索が可能です。

### 前提条件

1. **Ollamaのインストール**
   ```bash
   # macOS
   brew install ollama
   ```

2. **Ollamaサーバーの起動**
   ```bash
   ollama serve
   ```

3. **embeddingモデルのダウンロード**
   ```bash
   ollama pull qwen3-embedding:4b
   ```

### embeddingの対象

各issueのテキスト（コメント含む）からベクトルを生成します。

| タイプ | embedding対象 |
|--------|--------------|
| memo | `body_md + コメント` |
| task | `title + body_md + コメント` |
| article | `title + body_md + コメント` |

### 本番DBのembedding生成

```bash
# 全issueのembeddingを一括生成（初回）
mgtd embedding sync

# モデルを指定する場合
mgtd embedding sync --model qwen3-embedding:4b

# Ollama URLを指定する場合（デフォルト: http://localhost:11434）
mgtd embedding sync --ollama-url http://localhost:11434

# JSON出力
mgtd embedding sync --json
```

- 初回は全issueを処理（50件ずつバッチ処理）
- 2回目以降は新規issueとコンテンツ変更のあったissueのみ処理（SHA-256ハッシュで変更検知）
- モデルを変更した場合は全issueを再生成

### セマンティック検索の利用

```bash
# 基本（英語）
curl 'http://localhost:3000/api/search/semantic?q=test&limit=10'

# 日本語検索（curlでは --data-urlencode で q を、-d で他のパラメータを別々に指定）
curl --get 'http://localhost:3000/api/search/semantic' \
  --data-urlencode 'q=料理' \
  -d 'limit=10'

# タイプを絞る
curl --get 'http://localhost:3000/api/search/semantic' \
  --data-urlencode 'q=料理' \
  -d 'limit=10' \
  -d 'types=memo,task'
```

> **注意:** `--data-urlencode` は1パラメータずつ指定してください。
> `--data-urlencode 'q=料理&limit=10'` とまとめると `q` の値が `料理&limit=10` になり、limitが効きません。

**注意:** Ollamaが起動していない場合、セマンティック検索は503を返します。他の機能は全て正常に動作します。

## 検索とフィルタリング

meme-gtdは、Web UI、CLI、APIの全インターフェースで統一された検索構文をサポートしています。

### 検索構文

```
label:<label-name>           # 単一ラベルでフィルタ
label:<label1>,<label2>      # 複数ラベル（OR条件）
status:<status-value>        # ステータスでフィルタ（Taskのみ）
label:bug status:open        # 複数条件（AND条件）
フリーテキスト                # タイトルや本文で検索（SQLite FTS5）
label:bug authentication     # ラベルフィルタ + フリーテキスト検索
```

### フリーテキスト検索

SQLite FTS5を使用した高速な全文検索をサポートしています：

- **タスク**: タイトルと本文の両方を検索
- **メモ**: 本文を検索
- **複数語AND検索**: `login OAuth` で両方の単語を含むアイテムを検索
- **ハイライト**: 検索結果に`<mark>`タグ付きプレビューを表示
- **大小文字区別なし**: 自動的に大小文字を区別しない検索
- **前方一致検索**: `MS*` のように末尾に `*` を付けると前方一致検索（日本語検索では推奨）

### Web UI での検索

検索ボックスに検索構文を入力してEnterキーを押すと検索が実行されます。

**例:**
- `label:bug` - bugラベルのついたアイテムを検索
- `label:bug,enhancement` - bugまたはenhancementラベルのアイテムを検索
- `status:open` - ステータスがopenのタスクを検索
- `label:urgent status:next` - urgentラベルでステータスがnextのタスクを検索
- `authentication` - "authentication"を含むアイテムを検索
- `login OAuth` - "login"と"OAuth"の両方を含むアイテムを検索
- `label:bug authentication` - bugラベルで"authentication"を含むアイテムを検索

### CLI での検索

`--label`、`--status`、`--search` フラグを使用してフィルタリング・検索できます。

**Task例:**
```bash
# 単一ラベルでフィルタ
mgtd task list --label bug

# 複数ラベル（OR条件）
mgtd task list --label bug,enhancement

# ステータスでフィルタ
mgtd task list --status open

# 組み合わせ（AND条件）
mgtd task list --label bug --status open

# フリーテキスト検索（タイトルと本文）
mgtd task list --search "authentication"

# タイトルのみ検索
mgtd task list --search-title "Implement OAuth"

# 本文のみ検索
mgtd task list --search-body "OAuth integration"

# フィルタと検索の組み合わせ
mgtd task list --label bug --search "authentication"
```

**Memo例:**
```bash
# 単一ラベルでフィルタ
mgtd memo list --label idea

# 複数ラベル（OR条件）
mgtd memo list --label idea,meeting-notes

# フリーテキスト検索
mgtd memo list --search "meeting notes"

# フィルタと検索の組み合わせ
mgtd memo list --label meeting-notes --search "action items"
```

**横断検索（keyword / semantic）:**
```bash
# キーワード検索（memo/task/article横断、title/body/commentsを検索）
mgtd search keyword "郡司ペギオ"
mgtd search keyword "TODO" --types memo,task --limit 5 --json

# セマンティック検索（ベクトル類似度、Ollama必須）
mgtd search semantic "郡司ペギオ"
mgtd search semantic "読書メモ" --types memo --limit 10 --json
```

詳細は [docs/cli-commands.md](./docs/cli-commands.md) を参照してください。

### API での検索

クエリパラメータを使用してフィルタリング・検索できます。

**Task例:**
```bash
# 単一ラベルでフィルタ
curl http://localhost:3000/api/tasks?label=bug

# 複数ラベル（OR条件）
curl http://localhost:3000/api/tasks?label=bug,enhancement

# ステータスでフィルタ
curl http://localhost:3000/api/tasks?status=open

# 組み合わせ（AND条件）
curl http://localhost:3000/api/tasks?label=bug&status=open

# フリーテキスト検索
curl http://localhost:3000/api/tasks?search=authentication

# 検索とフィルタの組み合わせ
curl "http://localhost:3000/api/tasks?search=OAuth&label=bug&status=open"
```

**Memo例:**
```bash
# 単一ラベルでフィルタ
curl http://localhost:3000/api/memos?label=idea

# 複数ラベル（OR条件）
curl http://localhost:3000/api/memos?label=idea,meeting-notes

# フリーテキスト検索
curl http://localhost:3000/api/memos?search=meeting

# 検索とフィルタの組み合わせ
curl "http://localhost:3000/api/memos?search=action+items&label=meeting-notes"
```

詳細は [docs/api-filtering.md](./docs/api-filtering.md) を参照してください。

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
| `mgtd project create` | 新規プロジェクト作成（`--description`, `--view`, `--status`, `--start-date`, `--end-date`, `--json` など） |
| `mgtd project list` | プロジェクト一覧表示（`--status`, `--json` など） |
| `mgtd project view` | プロジェクト詳細とアイテム一覧表示（`--json` など） |
| `mgtd project update` | プロジェクト更新（`--name`, `--description`, `--status`, `--start-date`, `--end-date`, `--json` など） |
| `mgtd project add` | プロジェクトにissueを追加（`--column`, `--json` など） |
| `mgtd project remove` | プロジェクトからissueを削除（`--yes`, `--json` など） |
| `mgtd project move` | アイテムの位置や列を変更（`--after`, `--column`, `--json` など） |
| `mgtd project delete` | プロジェクト削除（確認プロンプト、`--yes`, `--json` など） |
| `mgtd embedding sync` | 全issueのベクトル埋め込み生成/更新（`--model`, `--ollama-url`, `--json` など） |

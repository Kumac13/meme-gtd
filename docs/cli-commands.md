# CLI コマンド仕様

## 設計思想

### GitHub CLI との対応関係
GitHub CLI (`gh`) を参考にしたコマンド体系：
- `gh issue` → `gtd memo` / `gtd task`
- `gh project` → `gtd project`

### データモデルの関係

**Task/Memo（独立エンティティ）**:
- **Task**: 独自のステータス（OPEN, DONE, CANCELED）を持つ
- **Memo**: ステータスを持たない（削除フラグのみ）
- 複数のProjectに所属可能
- Projectの複数のステータスに配置可能

**Project（ビュー/グルーピング）**:
- Projectは複数のステータス（カラム）を持つ
- 各ステータスにTask/Memoを配置
- Taskのステータス変更は、Projectの責務として各Project側で処理される

---

## グローバルコマンド

### gtd init
```bash
gtd init
```
**説明**: データベースを初期化し、デフォルトのGTDプロジェクトと7つのステータスを作成します。

**処理内容**:
1. SQLiteデータベースファイル作成
2. テーブル作成（memos, tasks, projects, project_statuses, project_items等）
3. デフォルトプロジェクト "GTD" (ID: 1) 作成
4. GTDプロジェクトに7つのステータス作成:
   - INBOX (order: 1)
   - NEXT (order: 2)
   - WAITING (order: 3)
   - SCHEDULED (order: 4)
   - SOMEDAY (order: 5)
   - DONE (order: 6)
   - TRASH (order: 7)

**使用例**:
```bash
gtd init
```

### gtd help
```bash
gtd help [command]
```
**説明**: ヘルプを表示します。

**引数**:
- `[command]`: 特定のコマンドのヘルプ（省略時は全体のヘルプ）

**使用例**:
```bash
gtd help
gtd help memo
gtd help project
```

---

## メモ管理

### gtd memo create
```bash
gtd memo create [flags]
```
**説明**: 新しいメモを作成します。

**オプション**:
- `-t, --title <string>`: メモタイトル
- `-b, --body <string>`: メモ本文（Markdown）
- `--parent <number>`: 親メモID（子メモ作成時）
- `-p, --project <number>`: 追加先プロジェクトID（省略時: 1 [GTD]）
- `-l, --label <strings>`: ラベル（カンマ区切りで複数指定可）

**使用例**:
```bash
gtd memo create --title "会議メモ"
gtd memo create --title "議事録" --body "内容" --project 1
gtd memo create --parent 5 --body "追加メモ"
gtd memo create --title "タスク" --label work,urgent
```

### gtd memo list
```bash
gtd memo list [flags]
```
**説明**: メモ一覧を取得します。

**オプション**:
- `-p, --project <number>`: プロジェクトIDでフィルタ
- `-s, --status <string>`: プロジェクト内ステータス名でフィルタ
- `-l, --label <string>`: ラベルでフィルタ
- `-S, --search <string>`: キーワード検索（将来実装）
- `-L, --limit <number>`: 取得件数（省略時: 50）
- `--offset <number>`: オフセット（省略時: 0）
- `--json <fields>`: JSON形式で出力（フィールド指定）
- `-q, --jq <expression>`: jq式でJSONをフィルタ

**使用例**:
```bash
gtd memo list
gtd memo list --project 1 --status INBOX
gtd memo list --label work --limit 20
gtd memo list --json id,title,createdAt
```

### gtd memo view
```bash
gtd memo view {<number>} [flags]
```
**説明**: メモの詳細を表示します。デフォルトではタイトルと本文のみ表示します。

**引数**:
- `<number>`: メモID

**オプション**:
- `-c, --comments`: 子メモ（コメント）も表示
- `--json <fields>`: JSON形式で出力
- `-q, --jq <expression>`: jq式でフィルタ

**利用可能なJSONフィールド**:
`id`, `serial`, `title`, `body`, `children`, `projects`, `labels`, `createdAt`, `updatedAt`

**使用例**:
```bash
gtd memo view 10
gtd memo view 10 --comments
gtd memo view 10 --json id,title,children
```

**出力例**:
```
Memo #10: 会議メモ
Created: 2025-01-15 10:30
Labels: work, meeting

本文内容がここに表示されます。

Projects:
  GTD > INBOX
```

**出力例（--comments 付き）**:
```
Memo #10: 会議メモ
Created: 2025-01-15 10:30
Labels: work, meeting

本文内容がここに表示されます。

Comments (2):
  #11: 補足情報1
      Created: 2025-01-15 11:00

      補足内容1

  #12: 補足情報2
      Created: 2025-01-15 11:30

      補足内容2

Projects:
  GTD > INBOX
```

### gtd memo edit
```bash
gtd memo edit {<number>} [flags]
```
**説明**: メモを編集します。

**引数**:
- `<number>`: メモID

**オプション**:
- `-t, --title <string>`: 新しいタイトル
- `-b, --body <string>`: 新しい本文

**使用例**:
```bash
gtd memo edit 10 --title "更新タイトル"
gtd memo edit 10 --body "新しい本文"
gtd memo edit 10 --title "タイトル" --body "本文"
```

### gtd memo delete
```bash
gtd memo delete {<number>}
```
**説明**: メモを削除します（論理削除）。

**引数**:
- `<number>`: メモID

**使用例**:
```bash
gtd memo delete 10
```

### gtd memo comment
```bash
gtd memo comment {<number>} [flags]
```
**説明**: 子メモ（コメント）を作成します。

**引数**:
- `<number>`: 親メモID

**オプション**:
- `-b, --body <string>`: コメント本文

**使用例**:
```bash
gtd memo comment 10 --body "補足情報"
```

---

## タスク管理

### gtd task create
```bash
gtd task create [flags]
```
**説明**: 新しいタスクを作成します。タスクステータスはOPENになります。

**オプション**:
- `-t, --title <string>`: タスクタイトル
- `-b, --body <string>`: タスク説明（Markdown）
- `-p, --project <number>`: 追加先プロジェクトID（省略時: 1 [GTD]）
- `-l, --label <strings>`: ラベル（カンマ区切りで複数指定可）

**使用例**:
```bash
gtd task create --title "ドキュメント作成"
gtd task create --title "タスク" --body "説明" --project 1
gtd task create --title "緊急" --label urgent,work
```

### gtd task list
```bash
gtd task list [flags]
```
**説明**: タスク一覧を取得します。デフォルトではOPEN状態のタスクのみ表示します。

**オプション**:
- `-p, --project <number>`: プロジェクトIDでフィルタ
- `-s, --status <string>`: プロジェクト内ステータス名でフィルタ
- `-l, --label <string>`: ラベルでフィルタ
- `--state <string>`: タスクステータスでフィルタ（open/closed/all、省略時: open）
- `-L, --limit <number>`: 取得件数（省略時: 50）
- `--offset <number>`: オフセット（省略時: 0）
- `--json <fields>`: JSON形式で出力
- `-q, --jq <expression>`: jq式でフィルタ

**使用例**:
```bash
gtd task list
gtd task list --project 1 --status NEXT
gtd task list --state all --label urgent
gtd task list --state closed --limit 100
```

### gtd task view
```bash
gtd task view {<number>} [flags]
```
**説明**: タスクの詳細を表示します。

**引数**:
- `<number>`: タスクID

**オプション**:
- `--json <fields>`: JSON形式で出力
- `-q, --jq <expression>`: jq式でフィルタ

**利用可能なJSONフィールド**:
`id`, `serial`, `title`, `body`, `state`, `projects`, `labels`, `createdAt`, `updatedAt`, `closedAt`

**使用例**:
```bash
gtd task view 20
gtd task view 20 --json id,title,state,projects
```

**出力例**:
```
Task #20: ドキュメント作成
State: OPEN
Created: 2025-01-15 14:00
Labels: work, documentation

タスクの説明がここに表示されます。

Projects:
  GTD > NEXT
  Project Alpha > IN_PROGRESS
```

### gtd task edit
```bash
gtd task edit {<number>} [flags]
```
**説明**: タスクを編集します。

**引数**:
- `<number>`: タスクID

**オプション**:
- `-t, --title <string>`: 新しいタイトル
- `-b, --body <string>`: 新しい説明
- `--add-label <string>`: ラベル追加
- `--remove-label <string>`: ラベル削除

**使用例**:
```bash
gtd task edit 20 --title "更新タスク"
gtd task edit 20 --body "新しい説明"
gtd task edit 20 --add-label urgent --remove-label backlog
```

### gtd task close
```bash
gtd task close {<number>}
```
**説明**: タスクをクローズ（完了）します。タスクのステータスをDONEに変更します。

**引数**:
- `<number>`: タスクID

**使用例**:
```bash
gtd task close 20
```

### gtd task reopen
```bash
gtd task reopen {<number>}
```
**説明**: タスクを再オープンします。タスクのステータスをOPENに戻します。

**引数**:
- `<number>`: タスクID

**使用例**:
```bash
gtd task reopen 20
```

### gtd task delete
```bash
gtd task delete {<number>}
```
**説明**: タスクを削除します（論理削除）。

**引数**:
- `<number>`: タスクID

**使用例**:
```bash
gtd task delete 20
```

---

## プロジェクト管理

### gtd project create
```bash
gtd project create [flags]
```
**説明**: 新しいプロジェクトを作成します。

**オプション**:
- `-t, --title <string>`: プロジェクト名
- `-d, --description <string>`: プロジェクト説明

**使用例**:
```bash
gtd project create --title "Webサイトリニューアル"
gtd project create --title "プロジェクト" --description "説明"
```

### gtd project list
```bash
gtd project list [flags]
```
**説明**: プロジェクト一覧を取得します。

**オプション**:
- `-L, --limit <number>`: 取得件数（省略時: 50）
- `--offset <number>`: オフセット（省略時: 0）
- `--json <fields>`: JSON形式で出力

**使用例**:
```bash
gtd project list
gtd project list --limit 10
gtd project list --json id,title,statusCount
```

### gtd project view
```bash
gtd project view {<number>} [flags]
```
**説明**: プロジェクトの詳細を表示します。プロジェクト情報、ステータス一覧、各ステータスのアイテム数を含みます。

**引数**:
- `<number>`: プロジェクトID

**オプション**:
- `--json <fields>`: JSON形式で出力

**使用例**:
```bash
gtd project view 1
gtd project view 1 --json id,title,statuses
```

**出力例**:
```
Project #1: GTD
Description: Getting Things Done デフォルトプロジェクト

Statuses (7):
  1. INBOX          (5 items)
  2. NEXT           (12 items)
  3. WAITING        (3 items)
  4. SCHEDULED      (2 items)
  5. SOMEDAY        (8 items)
  6. DONE           (45 items)
  7. TRASH          (0 items)

Total items: 75
```

### gtd project edit
```bash
gtd project edit {<number>} [flags]
```
**説明**: プロジェクトを編集します。

**引数**:
- `<number>`: プロジェクトID

**オプション**:
- `-t, --title <string>`: 新しいプロジェクト名
- `-d, --description <string>`: 新しい説明

**使用例**:
```bash
gtd project edit 3 --title "新プロジェクト名"
gtd project edit 3 --description "新しい説明"
```

### gtd project delete
```bash
gtd project delete {<number>}
```
**説明**: プロジェクトを削除します。デフォルトプロジェクト（GTD）は削除できません。

**引数**:
- `<number>`: プロジェクトID

**使用例**:
```bash
gtd project delete 3
```

### gtd project status-create
```bash
gtd project status-create {<project-number>} [flags]
```
**説明**: プロジェクトにステータス（カラム）を追加します。

**引数**:
- `<project-number>`: プロジェクトID

**オプション**:
- `-n, --name <string>`: ステータス名（必須）
- `-d, --description <string>`: ステータス説明
- `--order <number>`: 表示順序（省略時: 末尾）

**使用例**:
```bash
gtd project status-create 3 --name "IN_PROGRESS"
gtd project status-create 3 --name "IN_PROGRESS" --order 2
gtd project status-create 3 --name "REVIEW" --description "レビュー待ち" --order 3
```

### gtd project status-list
```bash
gtd project status-list {<project-number>} [flags]
```
**説明**: プロジェクトのステータス一覧を表示します。

**引数**:
- `<project-number>`: プロジェクトID

**オプション**:
- `--json <fields>`: JSON形式で出力

**使用例**:
```bash
gtd project status-list 1
gtd project status-list 3 --json name,order,itemCount
```

### gtd project status-edit
```bash
gtd project status-edit {<project-number>} {<status-name>} [flags]
```
**説明**: プロジェクトのステータスを編集します。

**引数**:
- `<project-number>`: プロジェクトID
- `<status-name>`: 現在のステータス名

**オプション**:
- `-n, --new-name <string>`: 新しいステータス名
- `-d, --description <string>`: 新しい説明
- `--order <number>`: 新しい表示順序

**使用例**:
```bash
gtd project status-edit 3 IN_PROGRESS --order 1
gtd project status-edit 3 TODO --new-name "BACKLOG"
gtd project status-edit 3 REVIEW --description "レビュー中" --order 4
```

### gtd project status-delete
```bash
gtd project status-delete {<project-number>} {<status-name>}
```
**説明**: プロジェクトのステータスを削除します。ステータスに属するアイテムは削除されず、プロジェクトから解除されます。

**引数**:
- `<project-number>`: プロジェクトID
- `<status-name>`: ステータス名

**使用例**:
```bash
gtd project status-delete 3 IN_PROGRESS
```

### gtd project item-add
```bash
gtd project item-add {<project-number>} [flags]
```
**説明**: プロジェクトにアイテム（Memo/Task）を追加します。

**引数**:
- `<project-number>`: プロジェクトID

**オプション**:
- `--id <number>`: アイテムID（必須）
- `-s, --status <string>`: 追加先ステータス名（省略時: 最初のステータス）

**使用例**:
```bash
gtd project item-add 3 --id 20
gtd project item-add 3 --id 20 --status NEXT
gtd project item-add 1 --id 15 --status INBOX
```

### gtd project item-move
```bash
gtd project item-move {<project-number>} [flags]
```
**説明**: プロジェクト内でアイテムを別ステータスに移動します。

**引数**:
- `<project-number>`: プロジェクトID

**オプション**:
- `--id <number>`: アイテムID（必須）
- `-s, --status <string>`: 移動先ステータス名（必須）

**使用例**:
```bash
gtd project item-move 1 --id 20 --status DONE
gtd project item-move 3 --id 25 --status IN_PROGRESS
```

### gtd project item-delete
```bash
gtd project item-delete {<project-number>} [flags]
```
**説明**: プロジェクトからアイテムを削除します。アイテム本体（Memo/Task）は削除されません。

**引数**:
- `<project-number>`: プロジェクトID

**オプション**:
- `--id <number>`: アイテムID（必須）

**使用例**:
```bash
gtd project item-delete 3 --id 20
```

### gtd project item-list
```bash
gtd project item-list {<project-number>} [flags]
```
**説明**: プロジェクト内のアイテム一覧を表示します。

**引数**:
- `<project-number>`: プロジェクトID

**オプション**:
- `-s, --status <string>`: ステータス名でフィルタ
- `-L, --limit <number>`: 取得件数（省略時: 50）
- `--offset <number>`: オフセット（省略時: 0）
- `--json <fields>`: JSON形式で出力

**使用例**:
```bash
gtd project item-list 3
gtd project item-list 1 --status NEXT
gtd project item-list 1 --status INBOX --limit 20
```

---

## ラベル（タグ）管理

### gtd label list
```bash
gtd label list [flags]
```
**説明**: 全ラベル一覧を表示します。

**オプション**:
- `--sort <string>`: ソート順（usage: 使用頻度順, name: 名前順、省略時: usage）
- `-L, --limit <number>`: 取得件数（省略時: 100）

**使用例**:
```bash
gtd label list
gtd label list --sort name --limit 50
gtd label list --sort usage
```

---

## デフォルトプロジェクト

### GTDプロジェクト

システム初期化（`gtd init`）時に自動生成されるプロジェクト：

| ID | Title | Description |
|----|-------|-------------|
| 1 | GTD | Getting Things Done デフォルトプロジェクト |

**GTDプロジェクトのステータス**:

| Status Name | Description | Order |
|-------------|-------------|-------|
| INBOX | 収集箱 | 1 |
| NEXT | 次にやること | 2 |
| WAITING | 委任・待機中 | 3 |
| SCHEDULED | 日付指定 | 4 |
| SOMEDAY | いつかやる/多分やる | 5 |
| DONE | 完了 | 6 |
| TRASH | ゴミ箱 | 7 |

---

## GTDワークフロー例

### 1. 収集（Capture）
```bash
# Inboxにメモ作成
gtd memo create --title "気になること" --project 1

# または、デフォルトプロジェクトがGTD(1)なので省略可
gtd memo create --title "気になること"
```

### 2. 見極め（Clarify）
```bash
# Inbox確認
gtd project item-list 1 --status INBOX

# メモ詳細表示
gtd memo view 10

# タスク化
gtd task create --title "ドキュメント作成" --project 1
```

### 3. 整理（Organize）
```bash
# タスクをNextへ移動
gtd project item-move 1 --id 20 --status NEXT

# タスクをWaiting Forへ移動
gtd project item-move 1 --id 21 --status WAITING

# タスクをScheduledへ移動
gtd project item-move 1 --id 22 --status SCHEDULED
```

### 4. 更新（Reflect）
```bash
# Someday確認
gtd project item-list 1 --status SOMEDAY

# NextへPromote
gtd project item-move 1 --id 25 --status NEXT

# Waiting確認
gtd project item-list 1 --status WAITING
```

### 5. 実行（Engage）
```bash
# Next Actions確認
gtd project item-list 1 --status NEXT

# タスク完了
gtd task close 20
```

---

## GitHub CLI との対応表

| GitHub CLI | gtd | 説明 |
|-----------|-----|------|
| `gh issue create` | `gtd memo create` / `gtd task create` | 作成 |
| `gh issue list` | `gtd memo list` / `gtd task list` | 一覧 |
| `gh issue view <n>` | `gtd memo view <n>` / `gtd task view <n>` | 詳細 |
| `gh issue view <n> --comments` | `gtd memo view <n> --comments` | コメント含む詳細 |
| `gh issue edit <n>` | `gtd memo edit <n>` / `gtd task edit <n>` | 編集 |
| `gh issue close <n>` | `gtd task close <n>` | クローズ |
| `gh issue reopen <n>` | `gtd task reopen <n>` | 再オープン |
| `gh issue delete <n>` | `gtd memo delete <n>` / `gtd task delete <n>` | 削除 |
| `gh issue comment <n>` | `gtd memo comment <n>` | コメント |
| `gh project create` | `gtd project create` | プロジェクト作成 |
| `gh project list` | `gtd project list` | プロジェクト一覧 |
| `gh project view <n>` | `gtd project view <n>` | プロジェクト詳細 |
| `gh project field-create` | `gtd project status-create` | ステータス作成 |
| `gh project field-list` | `gtd project status-list` | ステータス一覧 |
| `gh project item-add` | `gtd project item-add` | アイテム追加 |
| `gh project item-delete` | `gtd project item-delete` | アイテム削除 |
| `gh project item-list` | `gtd project item-list` | アイテム一覧 |

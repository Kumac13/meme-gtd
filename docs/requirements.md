# 要件定義書

## 1. プロジェクト概要

### 目的
GTD（Getting Things Done）フローに基づいた個人用タスク管理CLIツール及びAPIサーバー

### スコープ
- **対象ユーザー**: 個人利用（開発者本人のみ）
- **実行環境**: ローカル環境
- **データ保存**: ローカルのRDB（SQLite）
- **インターフェース**:
  - CLIコマンド（主要な操作）
  - RESTful API（将来のUI拡張用）

### 非スコープ（初期実装では対象外）
- 認証・認可機能
- マルチユーザー対応
- クラウド同期
- モバイルアプリ
- リアルタイム通知
- データエクスポート機能
- APIサーバー起動機能

---

## 2. UX設計方針

### 2.1 基本思想
- **GitHub Projects/Issues を参考**: 使い慣れたUIパターンを採用
- **メモとタスクは独立したエンティティ**: UIレベルで明確に区別
- **プロジェクトベースの管理**: GitHub Projectsのように、プロジェクト内にステータス（カラム）を持ち、アイテムを配置

### 2.2 メモ（Memo）
**目的**: 思考の記録、情報の一時保管、スレッド形式の議論

#### 機能
- **CRUD**: 作成・読取・更新・削除
- **一覧取得**: プロジェクト・日付・ラベルフィルタリング対応
- **検索**: キーワード検索（将来実装）
- **タスク化**: メモからタスクを生成（メモは保持、何度でも可能）
- **ブックマーク**: 重要なメモをマーク
- **子メモ（コメント）**: GitHubのIssueコメントのようなスレッド形式

#### 特徴
- **ステータスを持たない**: プロジェクトのステータス（カラム）で管理
- 複数のプロジェクトに所属可能
- 階層構造を持つ（親メモ → 子メモ）
- 子メモも独立したメモとして扱える（再利用可能）

### 2.3 タスク（Task）
**目的**: 実行すべきアクション

#### 機能
- **CRUD**: 作成・読取・更新・削除
- **一覧取得**: プロジェクト・日付・ラベル・ステータスフィルタリング対応
- **ステータス管理**: OPEN, DONE, CANCELED
- **日付指定**: `scheduledOn` フィールド
- **優先度管理**: priority フィールド
- **URL管理**: 関連URLの保存

#### 特徴
- **独自のステータス（TaskStatus）を持つ**: OPEN, DONE, CANCELED
- 複数のプロジェクトに所属可能
- プロジェクト内の複数のステータス（カラム）に配置可能

#### TaskStatus
- `OPEN`: オープン（作業可能状態）
- `DONE`: 完了
- `CANCELED`: キャンセル

### 2.4 プロジェクト（Project）
**目的**: メモ・タスクのグルーピング、GTDワークフローの実現（GitHub Projects参考）

#### 概念
- プロジェクトは複数のステータス（カラム）を持つ
- 各ステータスにメモ/タスクを配置
- タスクのステータス変更（OPEN → DONE）は、各プロジェクトの責務として処理される

#### GTDプロジェクト（デフォルト）
システム初期化時に自動生成される**1つ**のプロジェクト：

| ID | Title | Description |
|----|-------|-------------|
| 1 | GTD | Getting Things Done デフォルトプロジェクト |

**GTDプロジェクトのステータス（7つ）**:

| Status Name | Description | Order |
|-------------|-------------|-------|
| INBOX | 収集箱 | 1 |
| NEXT | 次にやること | 2 |
| WAITING | 委任・待機中 | 3 |
| SCHEDULED | 日付指定 | 4 |
| SOMEDAY | いつかやる/多分やる | 5 |
| DONE | 完了 | 6 |
| TRASH | ゴミ箱 | 7 |

#### カスタムプロジェクト
- ユーザーが追加作成可能
- 各プロジェクトは独自のステータス（カラム）を定義できる
- 例: `TODO`, `IN_PROGRESS`, `REVIEW`, `DONE` など

### 2.5 GTDワークフロー
プロジェクト内のステータス間でメモ・タスクを移動することでGTDを実現：

1. **収集（Capture）**: GTDプロジェクトのINBOXステータスにメモ作成
2. **見極め（Clarify）**:
   - 行動不要 → TRASH / SOMEDAY ステータスへ移動
   - 行動必要 → メモからタスク化
3. **整理（Organize）**: タスクを適切なステータスへ移動
   - NEXT (次にやること)
   - WAITING (委任・待機中)
   - SCHEDULED (日付指定)
4. **更新（Reflect）**: 週次レビューでステータス間を再配置
5. **実行（Engage）**: タスク完了（`task close`）

---

## 3. データ構造要件

### 3.1 設計思想

**重要**: `memo` と `task` は以下の特性を持つ：
- **同一の構造（interface）** を共有
- **データベース上は別テーブル** として管理
- 両者を統一的に扱うための抽象型 `Item` をアプリケーション層で定義

**理由**:
- メモとタスクでライフサイクルが異なる（メモは一時的、タスクは継続的）
- テーブル分離により、インデックス最適化やクエリパフォーマンスが向上
- 将来的な拡張（メモ専用機能、タスク専用機能）に柔軟

**メモ→タスク変換の仕組み**:
- メモ内容をコピーして新規タスクを作成（スナップショット）
- メモ自体は**変更されない**
- **同じメモから何度でもタスク作成可能**
- タスク側に `sourceMemoId` で元メモを参照（オプション）

### 3.2 Memo（メモテーブル）

| フィールド | 型 | 必須 | 説明 |
|-----------|-----|------|------|
| id | integer | ✓ | 一意識別子（自動採番） |
| title | string | ✓ | タイトル |
| bodyMd | text | ✓ | Markdown本文 |
| parentMemoId | integer | - | 親メモID（子メモの場合） |
| labels | string[] | - | ラベル配列 |
| metaJson | json | - | 拡張用メタ情報 |
| isBookmarked | boolean | - | ブックマーク（デフォルト: false） |
| isDeleted | boolean | - | 論理削除フラグ（デフォルト: false） |
| createdAt | datetime | ✓ | 作成日時 |
| updatedAt | datetime | ✓ | 更新日時 |

**特徴**:
- ステータスを持たない（プロジェクトのステータス（カラム）で管理）
- `parentMemoId` で階層構造を実現（GitHubコメント的）
- 子メモも独立したメモとして扱える（再利用可能）
- IDは単純な整数型（連番）

### 3.3 Task（タスクテーブル）

| フィールド | 型 | 必須 | 説明 |
|-----------|-----|------|------|
| id | integer | ✓ | 一意識別子（自動採番） |
| title | string | ✓ | タイトル |
| bodyMd | text | - | 説明（Markdown） |
| url | string | - | 関連URL |
| state | enum(TaskStatus) | ✓ | タスクステータス（デフォルト: OPEN） |
| scheduledOn | date | - | 日付指定 |
| estimatedMinutes | integer | - | 推定所要時間 |
| priority | integer | - | 優先度（0-9） |
| labels | string[] | - | ラベル配列 |
| metaJson | json | - | 拡張用メタ情報 |
| sourceMemoId | integer | - | 元メモのID（参照用） |
| isDeleted | boolean | - | 論理削除フラグ（デフォルト: false） |
| createdAt | datetime | ✓ | 作成日時 |
| updatedAt | datetime | ✓ | 更新日時 |
| closedAt | datetime | - | 完了日時 |

**特徴**:
- 独自のステータス（TaskStatus）を持つ: OPEN, DONE, CANCELED
- `sourceMemoId` でメモとの関連を記録
- `url` で外部リソースへの参照を保持
- IDは単純な整数型（連番）

#### TaskStatus（列挙型）
- `OPEN`: オープン（作業可能状態）
- `DONE`: 完了
- `CANCELED`: キャンセル

### 3.4 Project（プロジェクトテーブル）

**目的**: メモ・タスクのグルーピング、GTDワークフローの実現

| フィールド | 型 | 必須 | 説明 |
|-----------|-----|------|------|
| id | integer | ✓ | 一意識別子（自動採番） |
| title | string | ✓ | プロジェクト名 |
| description | text | - | 説明 |
| isDefault | boolean | ✓ | デフォルトプロジェクトフラグ（デフォルト: false） |
| isDeleted | boolean | - | 論理削除フラグ（デフォルト: false） |
| createdAt | datetime | ✓ | 作成日時 |
| updatedAt | datetime | ✓ | 更新日時 |

**特徴**:
- プロジェクト自体はステータスを持たない
- 複数のステータス（カラム）を子テーブル（ProjectStatus）で管理
- デフォルトプロジェクト（GTD）は `isDefault = true`、削除不可

### 3.5 ProjectStatus（プロジェクトステータステーブル）

**目的**: プロジェクト内のステータス（カラム）を管理

| フィールド | 型 | 必須 | 説明 |
|-----------|-----|------|------|
| id | integer | ✓ | 一意識別子（自動採番） |
| projectId | integer | ✓ | プロジェクトID |
| name | string | ✓ | ステータス名（例: INBOX, TODO, IN_PROGRESS） |
| description | text | - | ステータス説明 |
| order | integer | ✓ | 表示順序 |
| createdAt | datetime | ✓ | 作成日時 |
| updatedAt | datetime | ✓ | 更新日時 |

**制約**:
- `(projectId, name)` でユニーク（同一プロジェクト内でステータス名は一意）

### 3.6 ProjectItem（プロジェクト-アイテム関連テーブル）

**目的**: Project と Memo/Task の多対多関連、ステータス配置の管理

| フィールド | 型 | 必須 | 説明 |
|-----------|-----|------|------|
| id | integer | ✓ | 一意識別子（自動採番） |
| projectId | integer | ✓ | プロジェクトID |
| projectStatusId | integer | ✓ | プロジェクトステータスID（配置先カラム） |
| itemKind | enum(MEMO\|TASK) | ✓ | アイテム種別 |
| itemId | integer | ✓ | メモIDまたはタスクID |
| position | integer | - | ステータス内での並び順 |
| createdAt | datetime | ✓ | 追加日時 |
| updatedAt | datetime | ✓ | 更新日時 |

**制約**:
- `(projectId, itemKind, itemId)` でユニーク（同じアイテムを同じプロジェクトに重複追加不可）

**特徴**:
- `projectStatusId` でどのステータス（カラム）に配置されているかを管理
- タスクの `state` 変更時、各プロジェクトの責務としてこのレコードを更新

---

## 4. 機能要件

### 4.1 CLI コマンド要件

詳細は `docs/cli-commands.md` を参照。

#### 主要コマンド

**グローバル**:
- `gtd init` - 初期化（DB作成、GTDプロジェクト・ステータス生成）
- `gtd help [command]` - ヘルプ表示

**メモ管理**:
- `gtd memo create` - メモ作成
- `gtd memo list` - メモ一覧
- `gtd memo view <number>` - メモ詳細表示
- `gtd memo view <number> --comments` - メモ詳細表示（子メモ含む）
- `gtd memo edit <number>` - メモ編集
- `gtd memo delete <number>` - メモ削除
- `gtd memo comment <number>` - 子メモ作成

**タスク管理**:
- `gtd task create` - タスク作成（state=OPEN）
- `gtd task list` - タスク一覧
- `gtd task view <number>` - タスク詳細表示
- `gtd task edit <number>` - タスク編集
- `gtd task close <number>` - タスクをクローズ（state=DONE）
- `gtd task reopen <number>` - タスクを再オープン（state=OPEN）
- `gtd task delete <number>` - タスク削除

**プロジェクト管理**:
- `gtd project create` - プロジェクト作成
- `gtd project list` - プロジェクト一覧
- `gtd project view <number>` - プロジェクト詳細
- `gtd project edit <number>` - プロジェクト編集
- `gtd project delete <number>` - プロジェクト削除
- `gtd project status-create <project-number>` - ステータス作成
- `gtd project status-list <project-number>` - ステータス一覧
- `gtd project status-edit <project-number> <status-name>` - ステータス編集
- `gtd project status-delete <project-number> <status-name>` - ステータス削除
- `gtd project item-add <project-number>` - アイテム追加
- `gtd project item-move <project-number>` - アイテム移動
- `gtd project item-delete <project-number>` - アイテム削除
- `gtd project item-list <project-number>` - アイテム一覧

**ラベル管理**:
- `gtd label list` - ラベル一覧

### 4.2 API要件

RESTful APIを提供（将来のUI拡張用）。

#### エンドポイント設計
```
# Memos
POST   /api/memos
GET    /api/memos
GET    /api/memos/:id
PATCH  /api/memos/:id
DELETE /api/memos/:id
POST   /api/memos/:id/to-task

# Tasks
POST   /api/tasks
GET    /api/tasks
GET    /api/tasks/:id
PATCH  /api/tasks/:id
DELETE /api/tasks/:id
POST   /api/tasks/:id/close
POST   /api/tasks/:id/reopen

# Projects
POST   /api/projects
GET    /api/projects
GET    /api/projects/:id
PATCH  /api/projects/:id
DELETE /api/projects/:id

# Project Statuses
POST   /api/projects/:id/statuses
GET    /api/projects/:id/statuses
PATCH  /api/projects/:id/statuses/:statusId
DELETE /api/projects/:id/statuses/:statusId

# Project Items
POST   /api/projects/:id/items
GET    /api/projects/:id/items
PATCH  /api/projects/:id/items/:itemId
DELETE /api/projects/:id/items/:itemId

# Labels
GET    /api/labels
```

#### レスポンス形式
```json
{
  "data": { ... },
  "meta": {
    "total": 100,
    "page": 1,
    "perPage": 20
  }
}
```

---

## 5. 非機能要件

### 5.1 パフォーマンス
- CLI応答速度: 100ms以内（一覧表示）
- API応答速度: 200ms以内
- データ量想定: 合計 10,000アイテムまで

### 5.2 データ永続化
- **DB**: SQLite（ローカルファイル）
- **トランザクション保証**: すべての変更操作
- **論理削除のみ**: 物理削除禁止（`isDeleted` フラグ）
- **バックアップ**: SQLiteファイルの定期コピー推奨

### 5.3 開発・運用
- **言語**: TypeScript
- **ORM**: Prisma
- **テスト**: Vitest（単体テスト必須）
- **ログ**: 標準出力
- **CLI Framework**: Commander.js

---

## 6. 実装優先順位

### Phase 1: 基本GTDフロー（MVP）
**目標**: メモ作成 → タスク化 → 完了のフローを実現

1. データベース構築（Prisma + SQLite）
2. GTDプロジェクト・ステータス初期化
3. メモ CRUD（create, list, view, edit, delete）
4. タスク CRUD（create, list, view, edit, delete, close, reopen）
5. プロジェクトアイテム管理（item-add, item-move, item-list）

**成功基準**:
- `gtd init` でGTDプロジェクトが作成される
- メモを作成し、タスクに変換できる
- タスクをプロジェクトのステータス間で移動できる
- タスクを完了（close）できる

### Phase 2: プロジェクト管理強化
6. カスタムプロジェクト作成
7. プロジェクトステータス管理（status-create, status-edit, status-delete）
8. 子メモ（コメント）機能

### Phase 3: UX改善
9. ラベル管理
10. 検索機能（キーワード検索）
11. バルク操作
12. JSON出力オプション

### Phase 4: API実装
13. RESTful API実装
14. API認証（将来的にマルチユーザー対応時）

---

## 7. 技術スタック

### 確定事項
- **言語**: TypeScript
- **ORM**: Prisma
- **DB**: SQLite
- **CLI Framework**: Commander.js
- **テスト**: Vitest
- **パッケージマネージャー**: npm

### ディレクトリ構成（想定）
```
meme-gtd/
├── src/
│   ├── cli/           # CLIコマンド
│   ├── api/           # APIサーバー（将来）
│   ├── domain/        # ドメインロジック
│   ├── infra/         # Prisma等のインフラ層
│   └── index.ts       # エントリーポイント
├── prisma/
│   └── schema.prisma  # Prismaスキーマ
├── tests/
├── docs/
└── package.json
```

---

## 8. 決定事項まとめ

| 項目 | 決定内容 |
|------|----------|
| プロジェクトの概念 | GitHub Projects的。1プロジェクト内に複数のステータス（カラム）を持つ |
| デフォルトプロジェクト | GTD（1つ）、7つのステータス（INBOX, NEXT, WAITING, SCHEDULED, SOMEDAY, DONE, TRASH） |
| メモのステータス | 持たない（プロジェクトのステータス（カラム）で管理） |
| タスクのステータス | 持つ（OPEN, DONE, CANCELED） |
| ID形式 | 整数型（自動採番） |
| 連番表示 | なし（IDをそのまま使用） |
| ユースケース | 個人用のみ |
| 認証認可 | 不要 |
| データ保存先 | ローカルSQLite |
| インターフェース | CLI（+ API将来実装） |

---

## 9. GitHub参考情報

本プロジェクトは以下のGitHub機能を参考にしています：

- **GitHub Issues**: メモ・タスクの構造
  - タイトル、本文、ラベル、コメント
  - `gh issue create/list/view/edit/close/reopen`
- **GitHub Projects**: プロジェクト・ステータス管理
  - プロジェクト内に複数のステータス（カラム）
  - アイテムをステータス間で移動
  - `gh project create/view/item-add/item-list`

詳細は `docs/cli-commands.md` のGitHub CLI対応表を参照。

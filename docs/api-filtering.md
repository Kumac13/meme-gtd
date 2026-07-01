# APIフィルタリング・検索リファレンス

> 目的: REST API（/api/tasks, /api/memos 等）のクエリパラメータ・検索仕様のリファレンス
> 読むタイミング: APIのフィルタ・検索パラメータを使う・変更する前
> 更新タイミング: APIのクエリパラメータ変更時（api-schema-sync スキルのチェックリストに含まれる）

REST APIでタスク・メモをフィルタリング・検索する方法を説明する。

**注意**: 例は全てテスト環境（ポート3001、`pnpm server:dev` で起動）を使用。本番ポート3000へ検証アクセスしないこと（test-env スキル参照）。

## ベースURL

```
http://localhost:3001/api
```

## Tasks エンドポイント

### GET /api/tasks

タスク一覧を取得する。フィルタと検索をクエリパラメータで指定できる。

#### クエリパラメータ

| パラメータ | 型 | 説明 | 例 |
|-----------|------|-------------|---------|
| `status` | string | ステータスでフィルタ。有効値は `inbox`, `open`, `next`, `waiting`, `scheduled`, `someday`, `done`, `canceled` の8種 | `open`, `next` |
| `bookmarked` | string | ブックマーク状態でフィルタ | `true`, `false` |
| `label` | string | ラベル名でフィルタ。カンマ区切りでOR条件 | `bug`, `bug,enhancement` |
| `search` | string | title・bodyを全文検索（FTS5）。複数語はAND条件 | `authentication`, `login OAuth` |
| `projectId` | string | プロジェクトIDでフィルタ。カンマ区切りでOR条件。`none` で未所属を指定（`none,1` の併用可） | `1`, `1,2,3`, `none` |
| `scheduledFrom` | string | 予定日がこの日付以降のタスク（YYYY-MM-DD） | `2025-11-01` |
| `scheduledTo` | string | 予定日がこの日付以前のタスク（YYYY-MM-DD） | `2025-11-30` |
| `limit` | number | 返却件数の上限（デフォルト: 100、最大: 1000） | `50` |
| `offset` | number | スキップする件数（デフォルト: 0） | `100` |

#### 単一ラベルでフィルタ

```bash
curl http://localhost:3001/api/tasks?label=bug
```

**レスポンス:**
```json
{
  "data": [
    {
      "id": 1,
      "type": "task",
      "title": "Fix login bug",
      "bodyMd": "Description...",
      "status": "open",
      "labels": ["bug"],
      ...
    }
  ],
  "total": 1,
  "limit": 100,
  "offset": 0
}
```

#### 複数ラベルでフィルタ（OR条件）

カンマ区切りで複数ラベルを指定する。指定したラベルの**いずれか**に一致するタスクが返る。

```bash
curl http://localhost:3001/api/tasks?label=bug,enhancement
```

#### ステータスでフィルタ

```bash
curl http://localhost:3001/api/tasks?status=inbox
curl http://localhost:3001/api/tasks?status=open
curl http://localhost:3001/api/tasks?status=next
curl http://localhost:3001/api/tasks?status=someday
curl http://localhost:3001/api/tasks?status=done
```

#### フィルタの組み合わせ（AND条件）

複数のフィルタパラメータを組み合わせると、**全ての**条件に一致するタスクが返る。

```bash
# オープンなbugのみ
curl "http://localhost:3001/api/tasks?label=bug&status=open"

# ブックマーク済みのbug・enhancement
curl "http://localhost:3001/api/tasks?label=bug,enhancement&bookmarked=true"

# nextステータスかつurgentラベル
curl "http://localhost:3001/api/tasks?status=next&label=urgent"
```

#### 全文検索

`search` パラメータによる一覧内検索はSQLite FTS5（`issues_fts`）を使用し、複数語は自動的にAND条件になる。

なお、タイプ横断のキーワード検索エンドポイント `GET /api/search/keyword` はFTS5ではなく**LIKE部分一致**を使用する（FTS5のトークナイザーが日本語の単語境界を認識しないための意図的な設計）。詳細は `docs/architecture.md` の「検索アーキテクチャ」を参照。

```bash
# "authentication" を含むタスクを検索
curl http://localhost:3001/api/tasks?search=authentication

# 複数語検索（両方の語を含むタスクが返る）
curl "http://localhost:3001/api/tasks?search=login+OAuth"

# ラベルフィルタとの組み合わせ
curl "http://localhost:3001/api/tasks?search=authentication&label=bug"

# ステータスフィルタとの組み合わせ
curl "http://localhost:3001/api/tasks?search=OAuth&status=open"

# 複数フィルタとの組み合わせ
curl "http://localhost:3001/api/tasks?search=login&label=bug,enhancement&status=open"
```

**検索時のレスポンス（プレビュー付き）:**
```json
{
  "data": [
    {
      "id": 2,
      "title": "Implement login feature",
      "bodyMd": "OAuth integration",
      "preview": "Implement <mark>login</mark> feature",
      "status": "open",
      "labels": ["feature"],
      ...
    }
  ],
  "total": 1,
  "limit": 100,
  "offset": 0
}
```

**検索の特徴:**
- **複数語AND**: `search=login OAuth` は両方の語を含むタスクを返す
- **部分一致**: FTS5による前方一致・部分語マッチをサポート
- **大文字小文字を区別しない**
- **プレビュー**: 検索時のみ `preview` フィールドが付与され、マッチ箇所が `<mark>` タグでハイライトされる

#### エラーハンドリング

**不正なステータス:**
```bash
curl http://localhost:3001/api/tasks?status=invalid
```

**レスポンス（400 Bad Request）:**
```json
{
  "error": "Invalid status value",
  "details": "status must be one of: inbox, open, next, waiting, scheduled, someday, done, canceled"
}
```

## Memos エンドポイント

### GET /api/memos

メモ一覧を取得する。フィルタと検索をクエリパラメータで指定できる。

#### クエリパラメータ

| パラメータ | 型 | 説明 | 例 |
|-----------|------|-------------|---------|
| `bookmarked` | string | ブックマーク状態でフィルタ | `true`, `false` |
| `label` | string | ラベル名でフィルタ。カンマ区切りでOR条件 | `idea`, `idea,meeting-notes` |
| `search` | string | メモ本文を全文検索（FTS5）。複数語はAND条件 | `meeting`, `action items` |
| `projectId` | string | プロジェクトIDでフィルタ。カンマ区切りでOR条件。`none` で未所属を指定 | `1`, `none` |
| `createdFrom` | string | 作成日がこの日付以降のメモ（YYYY-MM-DD） | `2025-11-01` |
| `createdTo` | string | 作成日がこの日付以前のメモ（YYYY-MM-DD） | `2025-11-30` |
| `limit` | number | 返却件数の上限（デフォルト: 100、最大: 1000） | `50` |
| `offset` | number | スキップする件数（デフォルト: 0） | `100` |
| `order` | string | created_atのソート順（デフォルト: `desc` — 新しい順） | `asc`, `desc` |

**注意**: メモにはステータスがない。`status` パラメータを指定しても無視される。

#### 単一ラベルでフィルタ

```bash
curl http://localhost:3001/api/memos?label=idea
```

#### 複数ラベルでフィルタ（OR条件）

```bash
curl http://localhost:3001/api/memos?label=idea,meeting-notes
```

#### フィルタの組み合わせ

```bash
# ブックマーク済みのidea
curl "http://localhost:3001/api/memos?label=idea&bookmarked=true"

# 複数ラベル + ブックマークフィルタ
curl "http://localhost:3001/api/memos?label=inbox,todo&bookmarked=true"
```

#### 全文検索

タスクと同様、`search` パラメータによる一覧内検索はSQLite FTS5を使用し、複数語は自動的にAND条件になる（横断検索 `GET /api/search/keyword` はLIKE部分一致。詳細は `docs/architecture.md` の「検索アーキテクチャ」を参照）。

```bash
# "meeting" を含むメモを検索
curl http://localhost:3001/api/memos?search=meeting

# 複数語検索（両方の語を含むメモが返る）
curl "http://localhost:3001/api/memos?search=action+items"

# ラベルフィルタとの組み合わせ
curl "http://localhost:3001/api/memos?search=requirements&label=meeting-notes"

# ブックマークフィルタとの組み合わせ
curl "http://localhost:3001/api/memos?search=important&bookmarked=true"
```

**検索時のレスポンス（プレビュー付き）:**
```json
{
  "data": [
    {
      "id": 4,
      "bodyMd": "Attended project meeting and discussed requirements",
      "preview": "Attended project <mark>meeting</mark> and discussed requirements",
      "labels": ["meeting-notes"],
      ...
    }
  ],
  "total": 1,
  "limit": 100,
  "offset": 0
}
```

## 応用例

APIは通常のREST APIなので、curl以外の任意のHTTPクライアント（Python requests、fetch等）からも同じパラメータで利用できる。以下ではcurl + jqを標準の例として示す。

### jq（JSONプロセッサ）との組み合わせ

```bash
# タスクのタイトルのみ抽出
curl -s "http://localhost:3001/api/tasks?label=bug" | jq '.data[].title'

# オープンなbugの件数（フィルタ全体の総数はtotalフィールド）
curl -s "http://localhost:3001/api/tasks?label=bug&status=open" | jq '.total'

# フィルタと整形
curl -s "http://localhost:3001/api/tasks?status=open" | jq '.data[] | {id, title, labels}'

# 特定フィールドの抽出
curl -s "http://localhost:3001/api/memos?label=idea" | jq '.data[] | {id, bodyMd}'

# ID・タイトルの一覧表示
curl -s "http://localhost:3001/api/tasks?label=urgent" | jq -r '.data[] | "\(.id): \(.title)"'
```

## レスポンス形式

一覧エンドポイントはページネーション付きオブジェクト（`data`, `total`, `limit`, `offset`）を返す。`data` 配列の各要素は以下の形式。

**Task:**
```json
{
  "id": 1,
  "type": "task",
  "title": "Task title",
  "bodyMd": "Description in Markdown",
  "status": "open",
  "taskKind": "action",
  "scheduledStart": "2025-11-05T10:00:00",
  "scheduledEnd": "2025-11-05T11:00:00",
  "isAllDay": false,
  "actualStart": null,
  "actualEnd": null,
  "scheduledOn": "2025-11-05",
  "startTime": "10:00",
  "endDate": null,
  "endTime": "11:00",
  "duration": null,
  "meta": {},
  "isBookmarked": false,
  "isDeleted": false,
  "createdAt": "2025-11-04T00:00:00.000Z",
  "updatedAt": "2025-11-04T00:00:00.000Z",
  "labels": ["bug", "urgent"],
  "commentCount": 2,
  "projectIds": [1],
  "linkIds": [],
  "preview": "Context <mark>preview</mark> with highlighted terms (only present when searching)"
}
```

**注意（非推奨フィールド）**: `scheduledOn`, `startTime`, `endTime`, `endDate`, `duration` は旧形式（非推奨）であり、後方互換のためレスポンスに残っている。現行のスケジュールフィールドは `scheduledStart` / `scheduledEnd` / `isAllDay` / `actualStart` / `actualEnd`。新規コードで旧形式を使わないこと。

**Memo:**
```json
{
  "id": 1,
  "type": "memo",
  "title": null,
  "bodyMd": "Memo content in Markdown",
  "status": null,
  "meta": {},
  "isBookmarked": false,
  "isDeleted": false,
  "createdAt": "2025-11-04T00:00:00.000Z",
  "updatedAt": "2025-11-04T00:00:00.000Z",
  "labels": ["idea", "inbox"],
  "commentCount": 0,
  "preview": "Context <mark>preview</mark> with highlighted terms (only present when searching)"
}
```

## 補足

- **大文字小文字**: ラベルのマッチングは大文字小文字を区別しない
- **空白**: ラベル値の前後の空白は自動的にトリムされる
- **空の結果**: フィルタ条件に一致する項目がない場合、`data` は空配列 `[]` になる
- **URLエンコード**: ラベル名に含まれる特殊文字はURLエンコードが必要（例: スペースは `%20`）

## OpenAPIドキュメント

全エンドポイントを含む完全なAPIドキュメントは以下で確認できる（テストサーバー起動時）。

```
http://localhost:3001/api-docs
```

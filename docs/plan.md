# Issueインターフェイスおよび関連構造の要件整理

## 1. 概要
- `memo` と `task` は**同一の構造（interface）**を持つが、**データベース上は別テーブル**。
- 両者を統一的に扱うための抽象型 `Issue` を定義する。
- GitHub Issues に類似した構造を採用し、コメント、リンク、プロジェクトの概念を持つ。

---

## 2. データ構造
### Issue（共通構造体）
| フィールド | 型 | 説明 |
|-------------|----|------|
| kind | enum(`memo`\|`task`) | データ種別 |
| id | UUID | 一意識別子 |
| serial | int | 連番（#M123, #T456）|
| title | string | タイトル（1行目または手動設定）|
| body_md | string | Markdown本文 |
| status | enum | ステータス（後述）|
| scheduled_on | date? | 日付指定（taskで主に利用）|
| meta | json | タグ、優先度、推定時間などのメタ情報 |
| created_at | datetime | 作成日時 |
| updated_at | datetime | 更新日時 |
| source_issue_id | UUID? | 昇格元（memo→task）|
| promoted_issue_id | UUID? | 昇格先（task）|
| is_bookmarked | boolean | ブックマーク状態 |
| is_deleted | boolean | 論理削除フラグ |

### IssueComment
- 任意のIssue（memo/task）に紐づくコメント。
- 履歴管理・編集追跡を想定。

| フィールド | 型 | 説明 |
|-------------|----|------|
| id | UUID | 一意識別子 |
| issue_kind | enum(`memo`\|`task`) | 紐づく種別 |
| issue_id | UUID | 紐づくIssue ID |
| body_md | string | コメント本文 |
| created_at / updated_at | datetime | 作成・更新時刻 |

### IssueLink
- Issue間の関連（親子・参照・関連）を表現。

| フィールド | 型 | 説明 |
|-------------|----|------|
| id | UUID | 一意識別子 |
| from_kind / from_id | enum, UUID | リンク元 |
| to_kind / to_id | enum, UUID | リンク先 |
| link_type | enum(`parent`, `child`, `relates`) | 関係種別 |

### Project / ProjectItem
- `Project` はIssueの集合。`ProjectItem` はその並び順とビュー情報を保持。

| フィールド | 型 | 説明 |
|-------------|----|------|
| Project.id | UUID | 一意識別子 |
| Project.key | string | ショートコード |
| Project.name | string | 名称 |
| ProjectItem.issue_kind | enum | 種別（memo/task）|
| ProjectItem.issue_id | UUID | 対応するIssue |
| ProjectItem.position | int | 並び順 |
| ProjectItem.view_meta | json | カンバン列などのビュー設定 |

---

## 3. ステータス定義

### MemoStatus（メモの状態）
| 値 | 意味 |
|----|------|
| captured | 収集済み（Inboxにある）|
| triaging | 見極め中（行動要否を判断中）|
| archived | 処理済みまたは不要 |
| promoted | タスクへ昇格済み |

### TaskStatus（タスクの状態）
| 値 | 意味 |
|----|------|
| open | 登録直後の初期状態 |
| next | 次に取るべき行動として明示化 |
| waiting | 他者に委任または依存状態 |
| scheduled | 日付指定された予定タスク |
| done | 完了 |
| canceled | 中止／削除 |

---

## 4. 挙動と仕様

### メモ→タスク昇格
- メモ内容をスナップショットとして新規タスクを作成。
- 双方向参照：`memo.promoted_issue_id` ⇔ `task.source_issue_id`。
- 昇格後もメモは保持し、`status=promoted` に変更。

### 削除・ブックマーク
- `is_deleted` = true で論理削除（物理削除禁止）。
- `is_bookmarked` は単一フラグ。ユーザー単位管理を行う場合は `issue_bookmarks(user_id, issue_kind, issue_id)` 中間テーブルを導入。

### API想定
| メソッド | エンドポイント | 内容 |
|-----------|----------------|------|
| POST | /issues | memo/task作成 |
| GET | /issues | 種別・状態フィルタで一覧取得（is_deleted=falseのみ）|
| PATCH | /issues/:id | 更新（ステータス・タイトル等）|
| DELETE | /issues/:id | 論理削除（is_deleted=true）|
| POST | /issues/:id/promote | メモ昇格 → タスク生成 |
| POST | /issues/:kind/:id/comments | コメント追加 |
| POST | /issue-links | リンク作成 |

---

## 5. DB設計方針
- `memos` と `tasks` は **同一DDLテンプレート**から生成。
- 共通ビュー `issues` を定義し、APIレイヤーでは統一的にアクセス。
- `is_deleted = false` 条件を必ず明示。

---

## 6. 状態遷移概要
- Memo: `captured → triaging → archived/promoted`
- Task: `open → next/waiting/scheduled → done/canceled`
- 昇格・完了・中止時は履歴を `issue_events` に記録。

---

## 7. 拡張要件（オプション）
- コメント編集履歴管理 (`issue_comment_revisions`)
- タグ・優先度のインデックス化（検索最適化）
- 定期削除ジョブ（`is_deleted=true` の古いデータ）
- プロジェクト単位でのWIP制限・カンバン表示制御

---

この構造により、メモとタスクを統一的に扱いつつ、GTD（Getting Things Done）の収集～実行～完了までをシステム的に整合的に管理できます。

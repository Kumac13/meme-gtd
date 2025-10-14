# Data Model: Memo Command CLI Requirements Alignment

**Feature**: Memo Command CLI Requirements Alignment
**Date**: 2025-10-14
**Status**: Complete

## Overview

この機能は既存のCLIコマンドのフラグ定義の修正であり、データモデルへの変更は発生しません。しかし、CLIレイヤーとサービス層の境界を明確にするため、関連するエンティティとインターフェースを文書化します。

---

## Entities

### Memo

**説明**: ユーザーがキャプチャしたアイデアやメモを表現するエンティティ。データベースの`issues`テーブルに`type='memo'`として格納される。

**属性**:

| Attribute | Type | Required | Description |
|-----------|------|----------|-------------|
| id | number | Yes | 全レコード共通の連番ID |
| type | 'memo' | Yes | レコード種別（固定値） |
| bodyMd | string | Yes | メモ本文（Markdown形式） |
| labels | string[] | No | 関連付けられたラベル名の配列 |
| projectIds | number[] | No | 関連付けられたプロジェクトIDの配列 |
| createdAt | Date | Yes | 作成日時 |
| updatedAt | Date | Yes | 更新日時 |
| isBookmarked | boolean | Yes | ブックマークフラグ（デフォルト: false） |
| isDeleted | boolean | Yes | 論理削除フラグ（デフォルト: false） |

**バリデーション**:
- `bodyMd`は空文字列不可
- `labels`に存在しないラベル名を指定した場合はエラー
- `projectIds`に存在しないプロジェクトIDを指定した場合はエラー

**状態遷移**:
- 作成時: `type='memo'`, `isDeleted=false`
- 編集時: `updatedAt`を現在時刻に更新
- 削除時: `isDeleted=true`, `updatedAt`を更新
- 昇格時: 新しい`task`レコードを作成し、`links`テーブルに`derived_from`リンクを追加

---

### Label

**説明**: メモやタスクに付与されるタグ。メモのカテゴリ分けやフィルタリングに使用される。

**属性**:

| Attribute | Type | Required | Description |
|-----------|------|----------|-------------|
| id | number | Yes | ラベルID |
| name | string | Yes | ラベル名（一意） |
| description | string | No | ラベルの説明 |

**関連**:
- `issue_labels`テーブルを通じて、多対多で`issues`（memoまたはtask）に関連付けられる

---

### EditorSession (Transient)

**説明**: ユーザーがエディタで編集する際の一時的なセッション。永続化されないが、CLIコマンドの実行中にエディタ起動の状態を管理する。

**属性**:

| Attribute | Type | Required | Description |
|-----------|------|----------|-------------|
| initialContent | string | No | エディタに事前入力される内容 |
| editorCommand | string | Yes | 使用するエディタのコマンド（例: `vim`, `code --wait`） |
| tempFilePath | string | Yes | 一時ファイルのパス |
| editedContent | string | No | エディタで編集された内容（保存時） |
| cancelled | boolean | Yes | ユーザーが編集をキャンセルしたかどうか |

**ライフサイクル**:
1. コマンド実行時に`maybePromptEditor()`が呼ばれ、EditorSessionが作成される
2. 一時ファイルが作成され、`initialContent`が書き込まれる
3. エディタプロセスが起動し、ユーザーが編集
4. エディタが終了すると、一時ファイルから`editedContent`を読み込む
5. 一時ファイルが削除され、EditorSessionは破棄される

---

## Interfaces (CLI Layer)

### CreateMemoOptions

```typescript
interface CreateMemoOptions {
  body?: string;              // --body フラグ
  bodyFile?: string;          // --body-file フラグ (kebab-case)
  label?: string[];           // --label フラグ
  project?: number[];         // --project フラグ
  editor?: boolean;           // --editor フラグ (新規)
  noEditor?: boolean;         // --no-editor フラグ (新規)
  json?: boolean;             // --json フラグ
}
```

**変更点**:
- `bodyFile`を`body-file`プロパティ名に変更（CLIではkebab-case）
- `editor`と`noEditor`フラグを追加

### EditMemoOptions

```typescript
interface EditMemoOptions {
  id: number;                 // 位置引数
  body?: string;              // --body フラグ
  bodyFile?: string;          // --body-file フラグ (kebab-case)
  addLabel?: string[];        // --add-label フラグ (kebab-case)
  removeLabel?: string[];     // --remove-label フラグ (kebab-case)
  // setLabel?: string[];     // 削除: --set-label フラグ
  project?: number[];         // --project フラグ
  editor?: boolean;           // --editor フラグ (新規)
  noEditor?: boolean;         // --no-editor フラグ (新規)
  json?: boolean;             // --json フラグ
}
```

**変更点**:
- `bodyFile`を`body-file`プロパティ名に変更
- `addLabel`を`add-label`プロパティ名に変更
- `removeLabel`を`remove-label`プロパティ名に変更
- `setLabel`を削除
- `editor`と`noEditor`フラグを追加

### CommentAddOptions

```typescript
interface CommentAddOptions {
  memoId: number;             // 位置引数
  body?: string;              // --body フラグ
  bodyFile?: string;          // --body-file フラグ (kebab-case)
  editor?: boolean;           // --editor フラグ (新規)
  noEditor?: boolean;         // --no-editor フラグ (新規)
  json?: boolean;             // --json フラグ
}
```

**変更点**:
- `bodyFile`を`body-file`プロパティ名に変更
- `editor`と`noEditor`フラグを追加

---

## Service Layer Interfaces (No Changes)

サービス層（`packages/core/src/services/MemoService.ts`）のインターフェースは変更なし。CLIレイヤーがフラグをパースし、サービス層の既存メソッドに渡す。

### MemoService.create()

```typescript
create(params: {
  bodyMd: string;
  labels?: string[];
  projectIds?: number[];
}): Memo
```

### MemoService.edit()

```typescript
edit(params: {
  id: number;
  bodyMd?: string;
  addLabels?: string[];
  removeLabels?: string[];
  projectIds?: number[];
}): Memo
```

**注意**: `setLabels`メソッドは既存だが、`memo edit`からは呼ばれなくなる。`memo label set`コマンドからのみ使用される。

---

## Repository Layer (No Changes)

データベースリポジトリ層（`packages/db/src/repositories/memoRepository.ts`）は変更なし。

**保持される関数**:
- `createMemo()`
- `updateMemo()`
- `setMemoLabels()` ← `memo label set`コマンドで使用（`memo edit`からは呼ばれなくなる）
- `addMemoLabels()`
- `removeMemoLabels()`

---

## Data Flow

### Before (v0.1.0)

```
User: mgtd memo create --bodyFile notes.md --label inbox
  ↓
CLI: parse flags (bodyFile, label)
  ↓
MemoService.create({ bodyMd, labels })
  ↓
memoRepository.createMemo() + attachLabels()
  ↓
SQLite: INSERT INTO issues
```

### After (v0.1.1)

```
User: mgtd memo create --body-file notes.md --label inbox
  ↓
CLI: parse flags (body-file → bodyFile property, label)
  ↓
CLI: maybePromptEditor({ noEditor: true, initialContent: fileContent })
  ↓
MemoService.create({ bodyMd, labels })
  ↓
memoRepository.createMemo() + attachLabels()
  ↓
SQLite: INSERT INTO issues
```

**主要な変更点**:
1. CLIフラグ名が`--body-file`（kebab-case）に変更
2. `maybePromptEditor()`ヘルパーを経由してエディタ起動を制御
3. サービス層以降は既存の実装をそのまま使用

---

## Validation Rules

### CLI Layer

- `--editor`と`--no-editor`が同時に指定された場合、エラーを返す（oclif `exclusive`オプション）
- `--body-file`で指定されたファイルが存在しない場合、エラーを返す
- 本文が空（`bodyMd.trim() === ''`）の場合、エラーを返す
- 旧オプション（`--bodyFile`, `--addLabel`, `--removeLabel`, `--setLabel`）が検出された場合、エラーを返し、正しいkebab-case形式を提示

### Service Layer (Unchanged)

- `labels`に存在しないラベル名が含まれている場合、エラーを返す
- `projectIds`に存在しないプロジェクトIDが含まれている場合、エラーを返す

---

## Impact on Existing Data

**データベーススキーマへの影響**: なし

この機能はCLIインターフェースの変更のみであり、データベーススキーマ、既存データ、または永続化ロジックには影響を与えません。

---

## Summary

| Component | Change | Impact |
|-----------|--------|--------|
| **Entities** | なし | Memo, Label エンティティは変更なし |
| **CLI Interfaces** | フラグ名変更、新規フラグ追加 | kebab-case、`--editor` / `--no-editor`、`--set-label`削除 |
| **Service Layer** | なし | 既存メソッドシグネチャは保持 |
| **Repository Layer** | なし | `setMemoLabels`は保持（`memo label set`で使用） |
| **Database** | なし | スキーマ、データ、マイグレーション不要 |

---

**Data Model Documentation completed**: 2025-10-14

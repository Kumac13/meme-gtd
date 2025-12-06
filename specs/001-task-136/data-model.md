# Data Model: 画像添付機能

**Date**: 2025-12-05
**Feature**: 001-task-136

## Overview

本機能では新規DBテーブルは追加しない。画像はファイルシステムに保存され、Markdown本文内の画像参照（`![alt](path)`）を通じてissueと関連付けられる。

## Entities

### Attachment (ファイルシステム)

画像ファイルはDBではなくファイルシステムに保存される。フラットなディレクトリ構造でissueに紐付けない設計（GitHub方式）。これによりissue作成前でも画像をアップロードできる。

**Storage Path**: `~/.mgtd/attachments/{uuid}.{ext}`

| 属性 | 型 | 説明 |
|------|------|------|
| uuid | string | ユニークなファイル識別子（UUID v4） |
| ext | string | ファイル拡張子（png, jpg, jpeg, gif, webp） |

**Example Path**:
```
/Users/kumac13/.mgtd/attachments/a1b2c3d4-e5f6-7890-abcd-ef1234567890.png
```

### Issue (既存・変更なし)

既存のissuesテーブルは変更しない。画像参照はbodyMdフィールドにMarkdown形式で保存される。

**Image Reference in bodyMd**:
```markdown
このUIのバグを直したい

![スクショ](/Users/kumac13/.mgtd/attachments/a1b2c3d4-e5f6-7890-abcd-ef1234567890.png)
```

## Relationships

```
Issue (issues table)
  └── bodyMd contains Markdown image references
        └── References Attachment files on filesystem
              └── ~/.mgtd/attachments/{uuid}.{ext}
```

## Validation Rules

### Attachment

| ルール | 詳細 |
|--------|------|
| ファイルサイズ | 最大10MB |
| ファイル形式 | PNG, JPEG, GIF, WebP のみ |
| MIMEタイプ | image/png, image/jpeg, image/gif, image/webp |
| ファイル名 | UUID v4 + 元の拡張子 |
| ディレクトリ | 存在しない場合は自動作成 |

## State Transitions

本機能では状態遷移は発生しない。画像は以下のライフサイクルを持つ:

1. **アップロード**: ユーザーが画像をアップロード → ファイルシステムに保存
2. **参照**: issue本文にMarkdown画像参照を挿入
3. **表示**: Web UIでAPIエンドポイント経由で表示 / CLIで絶対パスを出力

## Notes

- 画像メタデータ（サイズ、作成日時等）はDBに保存しない
- issue削除時の画像ファイル連動削除は将来の課題（Out of Scope）
- 保存先カスタマイズ機能は将来の課題（Out of Scope）

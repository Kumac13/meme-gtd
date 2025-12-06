# Research: 画像添付機能

**Date**: 2025-12-05
**Feature**: 001-task-136

## 1. Fastify Multipart ファイルアップロード

### Decision
`@fastify/multipart` を使用してmultipart/form-dataでファイルアップロードを処理

### Rationale
- Fastify公式プラグインで、既存のFastify 5.2.0と互換性がある
- ストリーミング処理でメモリ効率が良い
- ファイルサイズ制限を設定可能

### Alternatives Considered
- **busboy直接使用**: 低レベルすぎ、Fastify統合の手間
- **formidable**: Fastifyとの統合が標準的でない
- **@fastify/multipart**: 公式プラグイン、最も適切 ✓

### Implementation Notes
```typescript
// @fastify/multipart 設定例
await app.register(fastifyMultipart, {
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
    files: 1, // 1ファイルずつ
  },
  attachFieldsToBody: false, // ストリーミングモード
});
```

## 2. 画像保存先ディレクトリ構造

### Decision
`~/.mgtd/attachments/{issue_id}/{uuid}.{ext}` 形式で保存

### Rationale
- issue_idでグルーピングすることで、将来的なissue削除時の連動削除が容易
- UUIDでファイル名の衝突を回避
- 元の拡張子を保持してMIMEタイプを推測可能

### Alternatives Considered
- **フラットディレクトリ**: `~/.mgtd/attachments/{uuid}.{ext}` - issue単位の管理が困難
- **日付ベース**: `~/.mgtd/attachments/2025/12/05/{uuid}.{ext}` - issue_idとの関連が失われる
- **issue_idベース**: 選択 ✓ - 論理的なグルーピングが可能

## 3. Markdown画像参照の形式

### Decision
絶対パス形式: `![alt](/Users/xxx/.mgtd/attachments/42/abc123.png)`

### Rationale
- Claude Codeが `@/path/to/file` 形式で画像を認識できる
- CLI出力をそのままコピペ可能
- 相対パスは実行ディレクトリに依存するため不適切

### Alternatives Considered
- **相対パス**: `![alt](./attachments/42/abc.png)` - 実行場所依存、不適切
- **データURI**: `![alt](data:image/png;base64,...)` - ファイルサイズ増大、不適切
- **絶対パス**: 選択 ✓

## 4. Web UI画像表示のパス変換

### Decision
Markdownレンダリング時に絶対パスを `/api/attachments/:issueId/:filename` に変換

### Rationale
- ブラウザから直接ファイルシステムにアクセスできない
- APIエンドポイント経由で画像を配信
- react-markdownのカスタムコンポーネントで変換可能

### Implementation Notes
```typescript
// markdown.tsx での画像変換
const transformImagePath = (src: string): string => {
  const match = src.match(/\/\.mgtd\/attachments\/(\d+)\/([^/]+)$/);
  if (match) {
    const [, issueId, filename] = match;
    return `/api/attachments/${issueId}/${filename}`;
  }
  return src;
};
```

## 5. 画像フォーマット検証

### Decision
MIMEタイプ + 拡張子の両方で検証

### Rationale
- MIMEタイプのみだと偽装が可能
- 拡張子のみだと実際のファイル形式と異なる可能性
- 両方をチェックすることで安全性を確保

### Allowed Formats
| 拡張子 | MIMEタイプ |
|--------|-----------|
| .png | image/png |
| .jpg, .jpeg | image/jpeg |
| .gif | image/gif |
| .webp | image/webp |

## 6. アップロードUIパターン

### Decision
テキストエリアへのドラッグ＆ドロップ + ファイル選択ボタン

### Rationale
- GitHubのissue編集UIに類似した直感的なUX
- 既存のMemoForm/TaskFormに統合可能
- クリップボードからの貼り付けは将来の拡張として保留

### Implementation Notes
- `onDragOver`, `onDrop` イベントでドラッグ＆ドロップ処理
- hidden `<input type="file">` でファイル選択
- アップロード中はローディング表示
- 完了後にMarkdown画像参照をカーソル位置に挿入

## 7. エラーハンドリング

### Decision
ユーザーフレンドリーなエラーメッセージをフロントエンドで表示

### Error Cases
| エラー | メッセージ |
|--------|-----------|
| ファイルサイズ超過 | ファイルサイズが10MBを超えています |
| 非対応フォーマット | PNG, JPEG, GIF, WebP形式のみ対応しています |
| アップロード失敗 | 画像のアップロードに失敗しました。再度お試しください |
| ストレージ書き込み失敗 | サーバーエラー: 画像の保存に失敗しました |

## 8. CLI出力への影響

### Decision
既存の `memo show` / `task show` コマンドは変更不要

### Rationale
- 本文（bodyMd）はそのまま出力されている
- 画像参照は通常のMarkdownテキストとして保存されている
- 絶対パス形式なのでそのまま出力すればClaude Codeが認識可能

### Verification
既存のCLI出力コードを確認し、bodyMdがそのまま出力されることを確認済み。

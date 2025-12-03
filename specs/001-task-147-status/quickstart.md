# Quickstart: コードブロック折りたたみ機能

## 概要

GitHubと同じ`<details>/<summary>`HTMLタグを使用して、Markdownコンテンツ内のコードブロックを折りたたみ可能にする機能。

## 使用方法

### Markdownでの記述例

```markdown
<details>
<summary>SQLクエリを表示</summary>

\`\`\`sql
SELECT u.id, u.name, COUNT(o.id) as order_count
FROM users u
LEFT JOIN orders o ON u.id = o.user_id
WHERE u.created_at > '2024-01-01'
GROUP BY u.id, u.name
HAVING COUNT(o.id) > 5
ORDER BY order_count DESC
LIMIT 100;
\`\`\`

</details>
```

### 初期状態を展開にする場合

```markdown
<details open>
<summary>設定ファイル（展開済み）</summary>

\`\`\`json
{
  "name": "my-app",
  "version": "1.0.0"
}
\`\`\`

</details>
```

## 開発環境セットアップ

### 依存パッケージのインストール

```bash
# packages/webディレクトリで実行
pnpm --filter meme-gtd-web add rehype-raw rehype-sanitize
```

### 開発サーバーの起動

```bash
# テスト環境APIサーバー起動
pnpm server:dev

# Web UI開発サーバー起動（別ターミナル）
pnpm dev:web
```

### テストの実行

```bash
# ユニットテスト
pnpm --filter meme-gtd-web test

# E2Eテスト
pnpm --filter meme-gtd-web test:e2e
```

## 変更対象ファイル

| ファイル | 変更内容 |
|---------|---------|
| `packages/web/package.json` | `rehype-raw`, `rehype-sanitize`を追加 |
| `packages/web/src/utils/markdown.tsx` | rehypeプラグインを追加 |

## 動作確認手順

1. テスト環境APIサーバーを起動: `pnpm server:dev`
2. Web UIを開く: http://localhost:3001
3. タスクまたはメモを作成/編集
4. 本文に`<details>/<summary>`タグを含むコードブロックを入力
5. 保存して表示を確認
6. 折りたたみ/展開が動作することを確認
7. 折りたたみ状態でコピーボタンが機能することを確認

## セキュリティ確認

以下のXSSパターンがサニタイズされることを確認:

```markdown
<!-- これらは全てサニタイズされる -->
<script>alert('XSS')</script>
<img src="x" onerror="alert('XSS')">
<details><summary>Click</summary><script>alert('XSS')</script></details>
```

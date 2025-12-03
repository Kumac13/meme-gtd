# Research: コードブロック折りたたみ機能

**Date**: 2025-12-04
**Feature**: `<details>/<summary>`タグによるコードブロック折りたたみ

## 調査項目

### 1. rehype-rawプラグインの使用方法

**Decision**: `rehype-raw`を使用してMarkdown内のHTMLタグをパースする

**Rationale**:
- react-markdownはデフォルトでHTMLタグを無視する
- `rehype-raw`を追加することで、`<details>/<summary>`などのHTMLタグがパース・レンダリングされる
- react-markdown 10.xでは`rehypePlugins`プロパティでプラグインを指定

**Implementation**:
```tsx
import rehypeRaw from 'rehype-raw';

<ReactMarkdown
  remarkPlugins={[remarkGfm, remarkBreaks]}
  rehypePlugins={[rehypeRaw]}
>
  {content}
</ReactMarkdown>
```

**Alternatives considered**:
- カスタムコンポーネントで`<details>`を実装 → HTMLタグを直接使う方がシンプル
- 別のMarkdownライブラリに切り替え → 既存実装との互換性を維持するため却下

### 2. XSS対策（rehype-sanitize）

**Decision**: `rehype-sanitize`の`defaultSchema`をそのまま使用する

**Rationale**:
- `hast-util-sanitize`の[defaultSchema](https://github.com/syntax-tree/hast-util-sanitize)には`details`と`summary`が**デフォルトで含まれている**
- GitHubスタイルのサニタイズに従い、`<script>`, `<iframe>`, イベントハンドラ属性などは自動的に除去される
- カスタムスキーマの拡張は不要

**Implementation**:
```tsx
import rehypeRaw from 'rehype-raw';
import rehypeSanitize from 'rehype-sanitize';

<ReactMarkdown
  remarkPlugins={[remarkGfm, remarkBreaks]}
  rehypePlugins={[rehypeRaw, rehypeSanitize]}
>
  {content}
</ReactMarkdown>
```

**Plugin Order**: `rehypePlugins`の順序は重要。`rehypeRaw`でHTMLをパースした**後に**`rehypeSanitize`でサニタイズする。

**Alternatives considered**:
- DOMPurifyを使用 → 別途DOMレベルでのサニタイズが必要になり複雑化
- カスタムスキーマの定義 → デフォルトで`details/summary`が許可されているため不要

### 3. CodeBlockWithCopyコンポーネントとの互換性

**Decision**: 既存の`CodeBlockWithCopy`コンポーネントは変更しない

**Rationale**:
- `<details>`内の`<pre>`タグも、react-markdownのコンポーネントマッピング（`pre: CodeBlockWithCopy`）によって処理される
- コピー機能は`extractTextFromChildren`関数でReact childrenからテキストを抽出しており、`<details>`の外側で動作
- 折りたたみ状態でもDOMは存在するため、コピーは正常に動作する

**Verification needed**:
- 折りたたみ状態でのコピーボタン表示位置
- 展開アニメーション時のボタン位置調整（必要に応じてCSSで対応）

### 4. ブラウザネイティブの`<details>`動作

**Decision**: ブラウザネイティブの動作をそのまま利用する

**Rationale**:
- `<details>`はHTML5標準要素であり、全モダンブラウザでサポート
- クリックによる展開/折りたたみはブラウザが自動で処理
- `open`属性で初期状態を制御可能
- アクセシビリティ（キーボード操作、スクリーンリーダー）もブラウザが対応

**Browser Support**: Chrome, Firefox, Safari, Edgeの全メジャーバージョンでサポート

### 5. 必要なパッケージのインストール

**Decision**: `rehype-raw`と`rehype-sanitize`をdevDependenciesではなくdependenciesに追加

**Packages to install**:
```bash
pnpm --filter meme-gtd-web add rehype-raw rehype-sanitize
```

**Version considerations**:
- `rehype-raw`: ESM only、最新バージョンを使用
- `rehype-sanitize`: ESM only、最新バージョンを使用（defaultSchemaに`details/summary`含む）

## Sources

- [rehype-sanitize GitHub](https://github.com/rehypejs/rehype-sanitize)
- [hast-util-sanitize GitHub](https://github.com/syntax-tree/hast-util-sanitize)
- [react-markdown Documentation](https://remarkjs.github.io/react-markdown/)
- [Stack Overflow: rehype-raw with react-markdown](https://stackoverflow.com/questions/68679693/use-rehype-raw-in-react-markdown-to-parse-html-element-the-type-is-not-match)

## 未解決事項

なし - 全ての技術的な不明点は解決済み

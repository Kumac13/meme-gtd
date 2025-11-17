# Research: Markdown Copy Button Implementation

**Date**: 2025-11-18
**Feature**: Markdown Copy Button for Web UI

## Overview

WebUIでのMarkdownコピー機能実装に必要な技術調査と設計決定事項をまとめる。

## Research Areas

### 1. Clipboard API

#### Decision: Navigator Clipboard API（Modern Async API）を使用

**Rationale**:
- 非同期でクリーンなAPI（`navigator.clipboard.writeText()`）
- Promise-based、async/awaitに対応
- セキュリティ要件（HTTPS/localhost必須）がモダンアプリケーションと一致
- 既存の`document.execCommand('copy')`は非推奨（deprecated）
- モバイルブラウザでのサポートが良好（iOS Safari 13.4+、Android Chrome 63+）

**Alternatives Considered**:
- `document.execCommand('copy')`: 非推奨、同期処理、複雑なDOM操作が必要
- サードパーティライブラリ（clipboard.js、react-copy-to-clipboard）: 新規依存関係の追加、機能がシンプルすぎて不要

**Implementation Details**:
```typescript
async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (error) {
    console.error('Failed to copy to clipboard:', error);
    return false;
  }
}
```

**Browser Support**:
- Chrome 63+ ✅
- Firefox 53+ ✅
- Safari 13.4+ ✅
- Edge 79+ ✅
- iOS Safari 13.4+ ✅
- Android Chrome 63+ ✅

**Fallback Strategy** (明確化済み):
- クリップボードAPI非対応時: 無反応（ユーザーにエラーUIは表示しない）
- console.logにエラー情報を出力（開発者向けデバッグ）

### 2. React Icon Library

#### Decision: react-icons（既存依存関係）を使用

**Rationale**:
- プロジェクトに既にインストール済み（`package.json`確認済み）
- 複数のアイコンセットを統一インターフェースで提供
- Tree-shakingに対応（未使用アイコンはバンドルされない）
- SVGベースで高品質、スケーラブル

**Icon Selection**:
- **コピーボタン（初期状態）**: `FiClipboard`（Feather Icons）
  - クリップボードを表現する標準的なアイコン
  - GitHubやVSCodeなどで使用される一般的なデザイン
- **コピー成功状態**: `FiCheck`（Feather Icons）
  - チェックマークアイコン
  - 成功を示す普遍的なシンボル

**Alternatives Considered**:
- カスタムSVG: メンテナンス負荷、既存ライブラリで十分
- Material Icons (MdContentCopy): Featherの方がシンプルで既存UIと調和

### 3. Visual Feedback Pattern

#### Decision: Icon Swap + CSS Transition（1秒間）

**Rationale** (明確化済み):
- ユーザー要求: アイコン変化のみ、1秒間表示
- シンプルで邪魔にならない
- 既存のボタンUIパターン（bookmark、status変更）と一貫性
- モバイルでも画面を占有しない

**Implementation Pattern**:
```typescript
const [copied, setCopied] = useState(false);

const handleCopy = async () => {
  const success = await copyToClipboard(text);
  if (success) {
    setCopied(true);
    setTimeout(() => setCopied(false), 1000); // 1秒後に元に戻る
  }
};

return (
  <button onClick={handleCopy} aria-label="Copy markdown">
    {copied ? <FiCheck /> : <FiClipboard />}
  </button>
);
```

**Accessibility Considerations**:
- `aria-label`: スクリーンリーダー対応
- `aria-live="polite"`: コピー成功時の状態変化を通知（オプション）
- キーボードナビゲーション: `<button>`要素でデフォルト対応

### 4. Component Architecture

#### Decision: Presentational/Container分離 + Custom Hook

**Rationale**:
- **CopyButton.tsx**: プレゼンテーショナルコンポーネント（UI、アイコン、スタイル）
- **useCopyToClipboard.ts**: ロジックフック（Clipboard API呼び出し、状態管理）
- **markdownFormatter.ts**: ピュアユーティリティ（「すべてコピー」のMarkdown構造化）

**Benefits**:
- 関心の分離（Separation of Concerns）
- テスタビリティ: ロジックとUIを独立してテスト可能
- 再利用性: 同じフックを異なるUIで使用可能
- React Best Practices準拠

**Component Hierarchy**:
```
ItemDetail (Page Component)
├── EditableContent
│   └── CopyButton (本文用)
├── CommentSection
│   └── EditableContent (each comment)
│       └── CopyButton (コメント用)
└── Header Actions
    └── CopyButton (すべてコピー用)
```

### 5. Markdown Formatting for "Copy All"

#### Decision: Structured Markdown with H1/H2/H3 Hierarchy

**Rationale** (仕様書で定義済み):
- タイトル: H1 (`# タイトル`)
- 本文: そのまま（元のMarkdown）
- コメントセクション: H2 (`## Comments`)
- 各コメント: H3 (`### Comment N (ISO8601日時)`)

**Implementation**:
```typescript
function formatAllContent(
  title: string,
  bodyMd: string,
  comments: Array<{ bodyMd: string; createdAt: string }>
): string {
  let markdown = `# ${title}\n\n${bodyMd}\n\n`;

  if (comments.length > 0) {
    markdown += `## Comments\n\n`;
    comments.forEach((comment, index) => {
      markdown += `### Comment ${index + 1} (${comment.createdAt})\n${comment.bodyMd}\n\n`;
    });
  }

  return markdown.trim();
}
```

**Edge Cases**:
- タイトルがnullの場合: Memo（タイトルなし）→ デフォルト`# Memo #${id}`
- コメントが0件の場合: コメントセクションを省略
- 特殊文字: そのまま（Markdownエスケープ不要、rawテキスト）

### 6. Button Placement Strategy

#### Decision (明確化済み):
- **本文コピーボタン**: 本文エリアの右上隅（コンテンツ表示エリア内）
- **コメントコピーボタン**: 各コメントの右上隅（コンテンツ表示エリア内）
- **すべてコピーボタン**: ページヘッダーエリア（タイトル・ステータス・ブックマークボタンの横）

**Layout Pattern**:
```
┌─ ItemDetail ─────────────────────────────────┐
│ Header: [Title] [Status] [Bookmark] [CopyAll]│
│                                               │
│ ┌─ Body ─────────────────────────────────┐   │
│ │ Markdown Content              [Copy]   │   │
│ └────────────────────────────────────────┘   │
│                                               │
│ ┌─ Comment 1 ────────────────────────────┐   │
│ │ Comment text                  [Copy]   │   │
│ └────────────────────────────────────────┘   │
│                                               │
│ ┌─ Comment 2 ────────────────────────────┐   │
│ │ Comment text                  [Copy]   │   │
│ └────────────────────────────────────────┘   │
└───────────────────────────────────────────────┘
```

### 7. Testing Strategy

#### Decision: Multi-layer Testing（Unit + Integration + E2E）

**Unit Tests** (Vitest):
- `useCopyToClipboard.test.ts`: フックロジック、状態管理
- `markdownFormatter.test.ts`: Markdown構造化、エッジケース
- `CopyButton.test.tsx`: コンポーネントレンダリング、props

**Integration Tests** (Vitest + Testing Library):
- EditableContent + CopyButton統合
- CommentSection + CopyButton統合
- モック化したClipboard API

**E2E Tests** (Playwright):
- 実際のブラウザでのクリップボード操作
- クロスブラウザテスト（Chrome、Firefox、Safari、Mobile）
- 成功率測定（95%以上の目標検証）

**Clipboard API Mocking**:
```typescript
// Vitest mock
Object.assign(navigator, {
  clipboard: {
    writeText: vi.fn(() => Promise.resolve()),
  },
});
```

**Playwright Clipboard Access**:
```typescript
// E2E test
await page.click('[aria-label="Copy markdown"]');
const clipboardText = await page.evaluate(() => navigator.clipboard.readText());
expect(clipboardText).toBe(expectedMarkdown);
```

## Technology Stack Summary

| Component | Technology | Version | Notes |
|-----------|-----------|---------|-------|
| Clipboard API | Navigator Clipboard API | Browser Standard | HTTPS required |
| Icons | react-icons (Feather) | 5.5.0 (existing) | FiClipboard, FiCheck |
| State Management | React useState | 19.2.0 | Local component state |
| Testing (Unit) | Vitest | 1.6.0 | Fast, Vite-native |
| Testing (E2E) | Playwright | 1.56.1 | Cross-browser |
| Styling | Tailwind CSS | 4.1.14 (existing) | Utility-first |

## Performance Considerations

### Target Metrics (from Success Criteria):
- コピー操作: 200ms以内 ✅ (Clipboard API: ~10-50ms typical)
- 成功率: 95%以上（主要ブラウザ）✅ (browser support confirmed)
- モバイル成功率: 90%以上 ✅ (iOS Safari 13.4+, Android Chrome 63+ support)

### Optimization Strategies:
- **非同期処理**: Clipboard APIは非同期、UIブロックなし
- **debounce不要**: ボタンクリックは低頻度、連続クリック対策は`disabled`状態で対応
- **メモリ効率**: テキストコピーのみ（画像・大容量データなし）、メモリリークリスク低

### Error Handling:
```typescript
try {
  await navigator.clipboard.writeText(text);
  setCopied(true);
} catch (error) {
  // 仕様: 無反応（UIエラー表示なし）
  console.error('Clipboard copy failed:', error);
  // setCopied(false) - アイコンは変化しない
}
```

## Security Considerations

### Clipboard API Requirements:
- **HTTPS必須**: localhost除く（開発環境OK）
- **User Gesture必須**: ボタンクリックで実行（自動コピー不可）
- **Permission**: 読み取りは権限必要、書き込みは不要

### Data Sanitization:
- **不要**: ユーザーが既に作成したMarkdownテキストをコピー
- XSS対策: コピー操作はDOM操作なし、テキストのみ
- 機密情報: ユーザー自身のタスク/メモ、追加の保護不要

## Open Questions Resolved

全ての不明点は仕様明確化フェーズ（`/speckit.clarify`）で解決済み:

✅ Q1: 視覚的フィードバック方法 → A: アイコン変化のみ（1秒間）
✅ Q2: Clipboard API非対応時の動作 → A: 無反応 + console.logエラー出力
✅ Q3: 本文/コメントボタン配置 → A: 右上隅（コンテンツエリア内）
✅ Q4: すべてコピーボタン配置 → A: ページヘッダーエリア
✅ Q5: アイコン変化時間 → A: 1秒間

## Next Steps

1. **Phase 1**: データモデル設計（data-model.md）- データ構造の文書化
2. **Phase 1**: Quickstart guide作成（quickstart.md）- 開発者向け実装ガイド
3. **Phase 2**: タスク分解（tasks.md）- 実装タスクの生成（`/speckit.tasks`）


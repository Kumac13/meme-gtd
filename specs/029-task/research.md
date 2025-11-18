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

### 2. UI Pattern - Dropdown Menu Integration

#### Decision: 既存の三点リーダードロップダウンメニューに「Copy」選択肢を追加

**Rationale** (明確化済み):
- 既存のEditableContentコンポーネントにEdit/Deleteメニューがある
- ユーザー要求: 独立したアイコンではなく、メニューの一選択肢として実装
- UIの一貫性: 既存の操作パターン（三点リーダー→選択肢）を維持
- 最小限のコード変更: 新規コンポーネント不要

**Menu Structure**:
- Edit（既存）
- **Copy（新規追加）**
- Delete（既存）

**Implementation Pattern**:
```typescript
{isMenuOpen && (
  <div className="absolute right-0 mt-1 w-32 bg-white border border-gray-200 rounded-md shadow-lg z-10">
    <button onClick={() => { handleStartEdit(); setIsMenuOpen(false); }}>
      Edit
    </button>
    <button onClick={() => { handleCopy(); setIsMenuOpen(false); }}>
      {copied ? 'Copied!' : 'Copy'}
    </button>
    <button onClick={() => { handleDelete(); setIsMenuOpen(false); }}>
      Delete
    </button>
  </div>
)}
```

### 3. Visual Feedback Pattern

#### Decision: メニュー項目テキスト変化（1秒間）

**Rationale** (明確化済み):
- ユーザー要求: アイコンではなくメニュー項目として実装
- コピー成功時: 「Copy」→「Copied!」に1秒間変化
- シンプルで明確なフィードバック
- メニューが閉じるため、次回開いたときは「Copy」に戻っている

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

// メニュー項目
<button onClick={() => { handleCopy(); /* メニューは閉じない or 閉じる */ }}>
  {copied ? 'Copied!' : 'Copy'}
</button>
```

**Note**: メニューを閉じるタイミングは実装時に調整（フィードバックを見せるために閉じない選択もある）

**Accessibility Considerations**:
- キーボードナビゲーション: 既存のメニューナビゲーションを維持
- `aria-label`: メニュー項目に適切なラベル
- スクリーンリーダー: 「Copied!」状態の通知

### 4. Component Architecture

#### Decision: 既存コンポーネント拡張 + Custom Hook

**Rationale**:
- **EditableContent.tsx**: 既存の三点リーダーメニューに「Copy」選択肢を追加
- **useCopyToClipboard.ts**: ロジックフック（Clipboard API呼び出し、状態管理）
- **markdownFormatter.ts**: ピュアユーティリティ（「すべてコピー」のMarkdown構造化）

**Benefits**:
- 最小限のコード変更（既存コンポーネントの拡張）
- 関心の分離（Separation of Concerns）
- テスタビリティ: ロジックとUIを独立してテスト可能
- 再利用性: 同じフックを異なるコンポーネントで使用可能
- React Best Practices準拠

**Component Hierarchy**:
```
ItemDetail (Page Component)
├── EditableContent (本文)
│   └── 三点リーダーメニュー
│       ├── Edit
│       ├── Copy (新規)
│       └── Delete
├── CommentSection
│   └── EditableContent (each comment)
│       └── 三点リーダーメニュー
│           ├── Edit
│           ├── Copy (新規)
│           └── Delete
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

### 6. Copy Action Placement Strategy

#### Decision (明確化済み):
- **本文コピー**: EditableContentの三点リーダーメニューに「Copy」選択肢を追加
- **コメントコピー**: 各コメントのEditableContentの三点リーダーメニューに「Copy」選択肢を追加
- **すべてコピーボタン**: ページヘッダーエリア（タイトル・ステータス・ブックマークボタンの横）

**Layout Pattern**:
```
┌─ ItemDetail ─────────────────────────────────┐
│ Header: [Title] [Status] [Bookmark] [CopyAll]│
│                                               │
│ ┌─ Body ─────────────────────────────────┐   │
│ │ Markdown Content              [⋮]      │   │
│ │                              ┌────┐    │   │
│ │                              │Edit│    │   │
│ │                              │Copy│    │   │
│ │                              │Del │    │   │
│ │                              └────┘    │   │
│ └────────────────────────────────────────┘   │
│                                               │
│ ┌─ Comment 1 ────────────────────────────┐   │
│ │ Comment text                  [⋮]      │   │
│ └────────────────────────────────────────┘   │
└───────────────────────────────────────────────┘
```

### 7. Testing Strategy

#### Decision: Multi-layer Testing（Unit + Integration + E2E）

**Unit Tests** (Vitest):
- `useCopyToClipboard.test.ts`: フックロジック、状態管理
- `markdownFormatter.test.ts`: Markdown構造化、エッジケース

**Integration Tests** (Vitest + Testing Library):
- EditableContentのメニューコピー機能統合
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

✅ Q1: 視覚的フィードバック方法 → A: メニュー項目テキスト変化「Copied!」（1秒間）
✅ Q2: Clipboard API非対応時の動作 → A: 無反応 + console.logエラー出力
✅ Q3: 本文/コメントコピー配置 → A: 三点リーダーメニューに「Copy」選択肢追加
✅ Q4: すべてコピーボタン配置 → A: ページヘッダーエリア
✅ Q5: フィードバック表示時間 → A: 1秒間

## Next Steps

1. **Phase 1**: データモデル設計（data-model.md）- データ構造の文書化
2. **Phase 1**: Quickstart guide作成（quickstart.md）- 開発者向け実装ガイド
3. **Phase 2**: タスク分解（tasks.md）- 実装タスクの生成（`/speckit.tasks`）


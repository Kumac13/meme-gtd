# Implementation Plan: コードブロック折りたたみ機能

**Branch**: `001-task-147-status` | **Date**: 2025-12-04 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/001-task-147-status/spec.md`

## Summary

GitHubと同じ`<details>/<summary>`HTMLタグを使用して、Markdownコンテンツ内のコードブロックを折りたたみ可能にする。ReactMarkdownに`rehype-raw`プラグインを追加してHTMLタグをパススルーし、`rehype-sanitize`でXSS対策を行う。既存の`CodeBlockWithCopy`コンポーネントは維持し、折りたたみ内のコードブロックでも同様に動作させる。

## Technical Context

**Language/Version**: TypeScript 5.5.4 / React 19.2.0 / Node.js 22+
**Primary Dependencies**: react-markdown 10.1.0, remark-gfm 4.0.1, remark-breaks 4.0.0, rehype-raw (新規追加), rehype-sanitize (新規追加)
**Storage**: N/A (フロントエンドのみ、バックエンド変更なし)
**Testing**: Vitest 1.6.0, Playwright (E2E)
**Target Platform**: Web Browser (モダンブラウザ)
**Project Type**: Web (monorepo: packages/web)
**Performance Goals**: 既存のMarkdownレンダリングと同等のパフォーマンス
**Constraints**: 既存の`CodeBlockWithCopy`コピー機能を維持、XSS攻撃を100%防止
**Scale/Scope**: フロントエンドのみの変更、packages/web/src/utils/markdown.tsxの修正

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Constitutionがテンプレート状態のため、プロジェクト固有のゲートは未定義。一般的なベストプラクティスに従う：

- [x] **単一責任**: markdown.tsx内でのみ変更を行い、他のコンポーネントへの影響を最小化
- [x] **後方互換性**: 既存のMarkdown記法は全て維持
- [x] **セキュリティ**: rehype-sanitizeによるXSS対策を実装
- [x] **テスタビリティ**: 折りたたみ/展開、コピー機能の動作確認が可能

## Project Structure

### Documentation (this feature)

```text
specs/001-task-147-status/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output (N/A - no data model changes)
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output (N/A - no API changes)
└── tasks.md             # Phase 2 output (/speckit.tasks command)
```

### Source Code (repository root)

```text
packages/web/
├── src/
│   ├── utils/
│   │   └── markdown.tsx    # Main file to modify
│   ├── components/         # No changes required
│   └── pages/              # No changes required
└── package.json            # Add rehype-raw, rehype-sanitize dependencies
```

**Structure Decision**: フロントエンドのみの変更。packages/web/src/utils/markdown.tsxにrehypeプラグインを追加し、`<details>/<summary>`タグのレンダリングを有効化する。

## Complexity Tracking

> No violations - changes are minimal and focused on a single file.

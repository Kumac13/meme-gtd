# pages/ での実装ルール

新しいページを作る前に、`packages/web/CLAUDE.md` の「共通UIコンポーネント」選択表を確認する。ページ枠を自作・コピーしない。

- 一覧ページ（`*List.tsx`）: `ListPageLayout` と `FilterDropdown` / `ToggleFilterButton` を使う
- 作成・編集ページ（`*New.tsx` / `*Edit.tsx`）: `FormPageLayout` を使い、Issue系フォーム本体は `IssueForm` に寄せる
- Issue詳細の右パネル: `ItemDetailPanel` を使う（リソース別の専用panelを増やさない）
- ファイル名はディレクトリ走査型の境界テスト（`tests/unit/ComponentBoundaries.test.ts`）の対象になる前提で `*List.tsx` / `*New.tsx` / `*Edit.tsx` の規則に従って付ける

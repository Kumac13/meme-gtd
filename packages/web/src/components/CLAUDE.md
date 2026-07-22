# components/ での実装ルール

新しいコンポーネントを書く前に、`packages/web/CLAUDE.md` の「共通UIコンポーネント」選択表を確認し、該当する共通コンポーネントがあれば必ずそれを使う（既存画面からのコピー実装は禁止。境界は `tests/unit/ComponentBoundaries.test.ts` がディレクトリ走査で検査する）。

このディレクトリで特に守ること:

- 外側クリックで閉じる挙動は `hooks/useOutsideClick.ts`、クリップボード操作は `hooks/useCopyToClipboard.ts` / `utils/copyContent.ts`、画像 paste/drop/upload は `MarkdownTextarea` が所有する。これらを再実装しない
- 全画面バックドロップ（`fixed inset-0`）を持てるのは `ActionMenu` と `SidePanel` のみ
- 複数画面で同じ意味を持つ表示を新たに共通化したら、選択表・`ComponentBoundaries.test.ts`・`docs/architecture.md` を同時に更新する（更新漏れは境界検査の対象外を生む）

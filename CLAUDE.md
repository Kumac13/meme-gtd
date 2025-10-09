# meme-gtd 開発ガイド

## 参照資料

1. **`docs/gtd.md`** - GTDワークフローの概念図
2. **`docs/requirements.md`** - 実装要件とデータモデル（最重要）
3. **`docs/cli-commands.md`** - CLIコマンド仕様
4. **GitHub CLI (`gh`)** - UX設計の参照元（`gh issue`, `gh project`コマンド）

## 開発時の原則

- ファイル作成・更新前に内容を提示して承認を得る
- CLIコマンドのオプションは全て明示的に記載（省略表記禁止）
- GitHub CLIのコマンド仕様は公式ドキュメントで必ず確認
- コマンド・ファイルは全体を提示（部分的な省略禁止）
- 実装前に`docs/requirements.md`を必ず参照

## 過去の指摘事項

- GitHub CLIの仕様を調査せずに実装
- オプション一覧を`[options]`で省略
- ファイル内容を`...`で省略
- 承認なしにファイルを書き出し
- requirements.mdを読まずに推測で実装

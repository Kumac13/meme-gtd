# CLI開発ガイド

## コマンド追加・変更

チェックリスト（`MULTIWORD_COMMANDS` 登録・テスト・`docs/cli-commands.md`・シェル補完）は cli-command-add スキルが唯一の正。

## 実装ルール

- コマンドのオプションは全て明示的に記載（`[options]`などの省略表記禁止）
- GitHub CLI (`gh`) のコマンド仕様を参考にする。実装前に公式ドキュメントで確認
- ヘルプテキスト・出力メッセージは英語で統一

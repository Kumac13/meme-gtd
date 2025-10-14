# Changelog

## 0.1.1 - 2025-10-14

### Breaking Changes

- **kebab-case フラグへの統一**: すべての memo コマンドのフラグを GitHub CLI 準拠の kebab-case に変更しました。
  - `--bodyFile` → `--body-file`
  - `--addLabel` → `--add-label`
  - `--removeLabel` → `--remove-label`
  - 旧 camelCase フラグを使用すると、適切なエラーメッセージと新しいフラグ名が表示されます。

- **`memo edit --set-label` の削除**: ラベルの完全置換は `memo label set` コマンドを使用してください。
  - `--setLabel` / `--set-label` を使用すると、移行ガイダンス付きのエラーメッセージが表示されます。

### New Features

- **エディタ起動の明示的制御**: `memo create`, `memo edit`, `memo comment add` に `--editor` / `--no-editor` フラグを追加しました。
  - `--editor`: body が指定されている場合でも強制的にエディタを起動します。
  - `--no-editor`: body が指定されていない場合でもエディタの起動を抑止します（エラーになります）。
  - 両フラグは相互排他的です。

### Tests

- kebab-case フラグの動作確認テスト（7テスト）を追加
- `--editor` / `--no-editor` フラグのテスト（13テスト）を追加
- `memo label set` コマンドの動作確認テスト（6テスト）を追加
- 全30テストが合格

## 0.1.0 - 2025-10-13

- 初期リリース: `mgtd init` / `mgtd memo` CLI を実装し、ローカル SQLite とメモ操作をサポート。
- CLI ヘルプを gh コマンド準拠のセクション構成に刷新し、スペース区切りのサブコマンドでも `--help` が動作するよう改善。
- `mgtd completion` コマンドと bash / zsh / fish 向けスクリプトを同梱し、コマンドから直接導入できるようにした。
- README とドキュメントを更新し、インストール手順・補完導入手順・テスト実行方法・パッケージ作成フローを明記。
- CLI の help / e2e テストを追加し、主要なコマンドと補完スクリプト生成を自動検証。

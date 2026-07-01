# meme-gtd 開発ガイド

GTD (Getting Things Done) ベースのローカルファースト個人タスク管理ツール。
pnpmモノレポ（CLI / REST API / Web UI / Chrome拡張）+ iOSアプリ。単一ユーザー・認証なし。

## ドキュメントルーティング（作業前にここで参照先を決める）

| 状況 | 読むもの |
|---|---|
| 実装に着手する前（必須） | `docs/architecture.md`（構造・波及範囲・設計意図） |
| 要件・仕様を確認したい | `docs/requirement.md` |
| DBスキーマ・データ構造に触れる | `docs/er-diagram.md`（データモデルの正） |
| CLIコマンドの仕様 | `docs/cli-commands.md` |
| REST APIのフィルタ・検索仕様 | `docs/api-filtering.md`（契約の正は `packages/api/docs/api/openapi.yaml`） |
| バージョニングポリシー | `docs/versioning.md` |
| ドキュメント自体を追加・変更する | `docs/CLAUDE.md`（カタログ・ガバナンス・書き方） |
| パッケージ固有のルール | 各ディレクトリの `CLAUDE.md`（自動ロードされる） |

## 定型作業スキル

定型手順は `.claude/skills/` にスキル化しており、各手順の唯一の正。該当する作業では必ずスキルに従うこと。

| スキル | 使うタイミング |
|---|---|
| `test-env` | CLI/API/Web UIの検証・テスト前（本番環境保護） |
| `api-schema-sync` | APIスキーマ・ルート・ハンドラ変更時の同期チェーン |
| `db-migration` | DBスキーマ変更・本番マイグレーション時 |
| `cli-command-add` | CLIコマンド追加・変更時 |
| `extractor-rebuild` | `packages/extension/src/` の抽出ロジック変更後 |
| `ios-deploy` | iOSアプリのビルド・デプロイ時 |
| `release` | 新機能・修正の実装完了後のバージョンバンプ（指示がなくても自動実行） |

## <critical-safety>本番データの保護</critical-safety>

**IMPORTANT: 検証・テストは必ずテスト環境で行うこと。`mgtd` の直接実行は禁止。**

過去に検証中の `mgtd` 直接実行で本番DBが全消去された（Issue #48、172KB → 0KB）。
`mgtd` はデフォルトで本番DB（`~/.local/share/mgtd/issues.db`）に接続するため、一度のミスが全データ喪失につながる。

- CLI検証は `pnpm mgtd:test`、APIは `curl http://localhost:3001/...`、Web UIは http://localhost:3001 を使う（手順・環境対応表: test-env スキル）
- 本番DBへのマイグレーションはユーザーの明示的な指示があるときのみ（手順: db-migration スキル）
- 誤って本番を変更した場合: 即座に停止し、変更内容を報告してユーザーの指示を仰ぐ

## 開発の基本ルール

- バックエンド（API/DB）の変更・追加には必ず対応するテストを書く（テストなしのバックエンド変更は禁止）
- 実装前に `docs/architecture.md` で変更の波及範囲を確認する（同期チェーンの更新漏れを防ぐため）
- ユーザーに報告・確認を求める前に、自分でビルド・動作確認を済ませる（エラーをユーザーに発見させない）
- 実装中は論理的な区切りごとにコミットする
- 指示にない範囲へ作業を広げる判断が必要な場合は、事前にユーザーへ確認する
- コマンド・ファイル内容は `...` 等で省略せず全文を提示する
- 実装完了後は release スキルでバージョンバンプする（ドキュメントのみ・テストのみの変更は不要）

### Push前のローカル検証（必須）

git push する前にCIと同じチェックをローカルで通すこと:

```bash
pnpm --filter meme-gtd-api lint && pnpm --filter meme-gtd-api openapi:validate && pnpm --filter meme-gtd-api test && pnpm build && pnpm knip
```

## 言語と対話

- ユーザーとの対話: 日本語・丁寧語（ですます調）・絵文字なし
- アプリ内のユーザー向けテキスト（UIラベル・CLI出力・エラーメッセージ）: 英語で統一
- コードコメント・ドキュメント: 日本語

# 運用管理ガイド（Operations Guide）

**Last Updated**: 2026-06-13

## 概要

meme-gtd の運用管理（オペレーション）に関する課題整理・改善ロードマップ・運用手順（Runbook）をまとめるドキュメント。

### 背景

- 過去に AI が `mgtd` コマンドを直接実行し、本番DB（`~/.local/share/mgtd/issues.db`）を全消去する事故が発生した（Issue #48、172KB → 0KB）
- v0.30.0 までのガードは `pnpm mgtd:test` wrapper と CLAUDE.md の運用ルールのみで、コード側の防御が存在しなかった
- バックアップ・ヘルスチェック・プロセス管理・ログファイル出力も存在せず、運用は手作業前提だった

## 環境定義

| 項目 | 本番（Production） | テスト（Test/Development） |
|---|---|---|
| DB | `~/.local/share/mgtd/issues.db` | `./test-data/test.db` または一時ディレクトリ |
| Config | `~/.config/mgtd/context.json` | `MGTD_CONFIG_PATH` で指定 |
| APIサーバー | ポート 3000（`pnpm server:start`） | ポート 3001（`pnpm server:dev`） |
| CLI | `mgtd`（デフォルト設定） | `pnpm mgtd:test`（環境変数を自動設定） |

### `MGTD_ENV` 環境変数（v0.31.0〜）

- `MGTD_ENV=test` を設定すると、設定解決の結果 dbPath が本番データディレクトリ（`~/.local/share/mgtd/`）配下になる場合に**起動を拒否**する（fail-closed）
- `pnpm mgtd:test` と `pnpm server:dev` は自動で `MGTD_ENV=test` を設定する
- 未設定時（人間の通常利用）は従来どおりの動作

## 環境変数一覧

### 共通（config 解決）

| 変数 | 既定値 | 説明 |
|---|---|---|
| `MGTD_CONFIG_PATH` | `~/.config/mgtd/context.json` | 設定ファイルパス |
| `DB_PATH` | config の `dbPath`（既定: 本番DB） | DBパスの上書き。設定ファイルが存在しない場合にも適用される |
| `MGTD_ENV` | （未設定） | `test` で本番DBパスへの解決を拒否 |

### APIサーバー

| 変数 | 既定値 | 説明 |
|---|---|---|
| `PORT` / `HOST` | `3000` / `0.0.0.0` | リッスン設定 |
| `NODE_ENV` | `development` | `production` でpretty印字無効・スタックトレース非表示 |
| `LOG_LEVEL` | `info` | APIサーバーのログレベル |
| `MGTD_LOG_FILE` | （未設定） | 指定するとJSONログをファイルにも出力（pino-roll により日次ローテーション・7世代保持） |
| `CORS_ALLOWED_ORIGINS` | `*` | カンマ区切りの許可オリジン |
| `MGTD_BACKUP_ENABLED` | `true` | `false` で自動バックアップ無効化 |
| `MGTD_BACKUP_INTERVAL_HOURS` | `24` | 自動バックアップ間隔（時間） |
| `MGTD_BACKUP_KEEP` | `7` | 保持する世代数 |
| `MGTD_BACKUP_DIR` | `<DBディレクトリ>/backups` | バックアップ保存先 |

### CLI（logger）

| 変数 | 既定値 | 説明 |
|---|---|---|
| `MGTD_LOG_LEVEL` | `info` | CLIロガーのレベル |
| `MGTD_LOG_FILE` | （未設定） | CLIログのファイル出力 |

注: APIは `LOG_LEVEL`、CLIは `MGTD_LOG_LEVEL` と名前が分かれている（Phase 2 で統一を検討）。

## 改善ロードマップ

### Phase 1（v0.31.0 で実装済み）— 本番データ保護・監視

| 課題 | 対応 |
|---|---|
| 本番DB誤操作ガードがコードに存在しない | `MGTD_ENV=test` ハードガード + 設定ファイル不在時に `DB_PATH` が無視され本番へフォールバックする経路の修正 |
| `init --force` が確認なしで既存DBを削除 | 非対話モードでは `--yes` 必須、TTYでは確認プロンプト |
| バックアップ機構なし | `mgtd db backup`（オンラインバックアップAPI・WAL安全・世代管理）+ APIサーバーの定期自動バックアップ |
| `db migrate` のバックアップが `fs.copy`（WAL非対応で不完全） | `createBackup` に置換 |
| ヘルスチェックなし | `GET /api/health`（DB接続・スキーマバージョン確認、異常時503） |
| プロセス管理なし | systemd user unit テンプレート（`deploy/systemd/mgtd-api.service`） |
| ログがstdoutのみ | `MGTD_LOG_FILE` によるローテーション付きファイル出力（オプトイン） |

### Phase 2（将来）— 運用・セキュリティ

- **残存リスク**: `MGTD_ENV` 未設定の直接実行（設定ファイル不在時）は依然としてデフォルトの本番パスにDBを自動作成・使用する。設定ファイル不在時のDB自動作成を禁止し、明示的な `mgtd init` を必須にすることを検討（v0.31.0 開発中にもこのパターンの誤書き込みが実際に発生した）
- `CORS_ALLOWED_ORIGINS` 既定値 `*` の厳格化（本番では明示指定を必須に）
- マイグレーション失敗時の詳細ログとロールバック戦略（現状は事前バックアップからの復元のみ）
- CI の拡充: 現状 `.github/workflows/api-ci.yml` は API のみ。db/cli/logger/config のテストもCIで実行する（CLIテストの腐敗が実際に発生していた）
- extension の `extractor.test.ts` の修復（DOM環境設定とタイトル抽出アサーションが失敗する。v0.31.0 時点で既知の失敗）
- CLI テストカバレッジ改善（約32%。link / embedding / search コマンドのテスト欠落）
- ログレベル環境変数の統一（`LOG_LEVEL` と `MGTD_LOG_LEVEL`）
- 添付ファイル（`~/.mgtd/attachments`）の容量管理・クリーンアップ

### Phase 3（将来）— 技術的負債

- Web UI のテスト欠落（カバレッジ約6%。`TaskForm.tsx` 962行・`MemoForm.tsx` 793行がテストなし）
- Web UI の直接 `fetch()` 呼び出し（6箇所）を生成済み Service クラスへ置換
- iOS Swift モデルの手動同期リスク解消（OpenAPI からの自動生成、またはスキーマ整合テスト）
- `packages/core/src/index.ts`（540行）のサービス分割

## Runbook

### APIサーバーの常駐化（systemd user unit）

```bash
# 1. ビルド
pnpm build

# 2. ユニットファイルを配置（WorkingDirectory 等は環境に合わせて編集）
mkdir -p ~/.config/systemd/user
cp deploy/systemd/mgtd-api.service ~/.config/systemd/user/

# 3. 有効化・起動
systemctl --user daemon-reload
systemctl --user enable --now mgtd-api

# 4. ログアウト後も常駐させる
loginctl enable-linger $USER

# 5. 状態・ログ確認
systemctl --user status mgtd-api
journalctl --user -u mgtd-api -f

# 6. 動作確認
curl http://localhost:3000/api/health
```

### ヘルスチェック

```bash
curl http://localhost:3000/api/health
# 正常: 200 {"status":"ok","version":"0.31.0","uptimeSeconds":…,"db":{"status":"ok","schemaVersion":"013_add_embeddings"}}
# DB異常: 503 {"status":"error",…,"db":{"status":"error","schemaVersion":null}}
```

### バックアップ

```bash
# 手動バックアップ（本番DBに対して安全。読み取り専用で開く）
mgtd db backup

# バックアップ一覧
mgtd db backup --list
```

APIサーバー稼働中は24時間ごと（`MGTD_BACKUP_INTERVAL_HOURS`）に自動バックアップされ、7世代（`MGTD_BACKUP_KEEP`）を超えた古いものは自動削除される。

### リストア手順

```bash
# 1. APIサーバーを停止
systemctl --user stop mgtd-api

# 2. 現状のDBを退避（任意）
mv ~/.local/share/mgtd/issues.db ~/.local/share/mgtd/issues.db.broken

# 3. バックアップを書き戻し、WAL/SHMを削除
cp ~/.local/share/mgtd/backups/issues-YYYYMMDD-HHmmssSSS.db ~/.local/share/mgtd/issues.db
rm -f ~/.local/share/mgtd/issues.db-wal ~/.local/share/mgtd/issues.db-shm

# 4. 再起動・確認
systemctl --user start mgtd-api
curl http://localhost:3000/api/health
```

### ログ確認

- systemd 経由: `journalctl --user -u mgtd-api -f`
- ファイル出力（`MGTD_LOG_FILE` 設定時）: 指定パスに日次ローテーションで出力（7世代保持）

# 運用管理ガイド（Operations Guide）

> 目的: 本番/テスト環境の定義・環境変数・運用手順（Runbook）のリファレンス
> 読むタイミング: サーバー運用・バックアップ・リストア・障害対応時、運用系機能の実装前
> 更新タイミング: 運用系機能（バックアップ・ヘルスチェック・環境変数等）の追加・変更時

## 背景

過去に AI が `mgtd` コマンドを直接実行し、本番DB（`~/.local/share/mgtd/issues.db`）を全消去する事故が発生した（Issue #48、172KB → 0KB）。
これを受けて `MGTD_ENV=test` ハードガード・自動バックアップ・ヘルスチェック・systemd 常駐化が実装されている。
エージェントの検証手順は test-env スキルを参照。

## 環境定義

| 項目 | 本番（Production） | テスト（Test/Development） |
|---|---|---|
| DB | `~/.local/share/mgtd/issues.db` | `./test-data/test.db` または一時ディレクトリ |
| Config | `~/.config/mgtd/context.json` | `MGTD_CONFIG_PATH` で指定 |
| APIサーバー | ポート 3000（`pnpm server:start`） | ポート 3001（`pnpm server:dev`） |
| CLI | `mgtd`（デフォルト設定） | `pnpm mgtd:test`（環境変数を自動設定） |

### `MGTD_ENV` 環境変数

- `MGTD_ENV=test` を設定すると、設定解決の結果 dbPath が本番データディレクトリ（`~/.local/share/mgtd/`）配下になる場合に**起動を拒否**する（fail-closed）
- `pnpm mgtd:test` と `pnpm server:dev` は自動で `MGTD_ENV=test` を設定する
- 未設定時（人間の通常利用）は従来どおりの動作
- 残存リスク: `MGTD_ENV` 未設定かつ設定ファイル不在で直接実行すると、デフォルトの本番パスにDBを自動作成・使用する。エージェントは必ず `pnpm mgtd:test` を使うこと

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

注: APIは `LOG_LEVEL`、CLIは `MGTD_LOG_LEVEL` と名前が分かれている。

## 既知の問題（2026-07-02 検証済み）

- **`memo.promoted` アクティビティログの退行**: promote が `promotePreview` + `TaskService.create` + `LinkService` の合成に分解された際、`logMemoPromoted` の呼び出し元が消失し、昇格イベントが記録されない（`packages/core` に呼び出し元ゼロを確認）
- **extension の `extractor.test.ts` 失敗**: `DOMParser is not defined`（vitest のDOM環境未設定）で1件失敗する

修正した場合はこの節から削除すること。

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
# 正常: 200 {"status":"ok","version":"X.Y.Z","uptimeSeconds":…,"db":{"status":"ok","schemaVersion":"<最新マイグレーション名>"}}
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
保存先は `~/.local/share/mgtd/backups/`、ファイル名は `issues-YYYYMMDD-HHmmssSSS.db`。

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

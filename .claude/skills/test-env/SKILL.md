---
name: test-env
description: Use BEFORE any verification or testing involving the mgtd CLI, API server, or Web UI. Sets up and uses the isolated test environment (test-data/test.db, port 3001) instead of production (~/.local/share/mgtd/issues.db, port 3000). Running mgtd directly once destroyed the production DB (Issue #48) — this skill prevents that.
---

# テスト環境での検証手順

**絶対ルール**: 開発・検証・テストでは必ずテスト環境を使用。本番環境には絶対に触れない。
このスキルがテスト環境手順の唯一の正。

## 過去のインシデント（Issue #48）

AIが検証中に `mgtd` コマンドを直接実行し、**本番DBを全消去**（172KB → 0KB）した。
`mgtd` はデフォルトで本番DB（`~/.local/share/mgtd/issues.db`）を使用するため、直接実行は一度のミスで全データ喪失につながる。

## 環境の対応表

| | 本番（触らない） | テスト（こちらを使う） |
|---|---|---|
| DB | `~/.local/share/mgtd/issues.db` | `./test-data/test.db` |
| Config | `~/.config/mgtd/context.json` | `./test-data/context.json`（環境変数で指定） |
| APIサーバー | ポート3000（`pnpm server:start`） | ポート3001（`pnpm server:dev`） |
| Web UI | http://localhost:3000 | http://localhost:3001 |
| CLI | `mgtd`（直接実行禁止） | `pnpm mgtd:test` |

## CLI検証（必ず test wrapper を使う）

`pnpm mgtd:test` は `MGTD_ENV=test` / `DB_PATH=$PWD/test-data/test.db` / `MGTD_CONFIG_PATH=$PWD/test-data/context.json` を自動設定する。
`MGTD_ENV=test` の場合、DBパスが本番データディレクトリに解決されるとCLIは実行を拒否する。

```bash
# 初回のみ: テストDBの初期化
pnpm mgtd:test init -d $PWD/test-data/test.db -f --yes

# Task操作
pnpm mgtd:test task create -t "Test Task" --no-editor
pnpm mgtd:test task list --json

# Memo操作
pnpm mgtd:test memo create --body "Test memo" --no-editor
pnpm mgtd:test memo list --json

# Project操作
pnpm mgtd:test project create "Test Project"
pnpm mgtd:test project list --json
```

**❌ `mgtd` の直接実行は絶対禁止**（読み取りだけでも禁止 — 本番DBに触れるため）。

## APIサーバー / Web UI検証

```bash
# テストAPIサーバー起動（ポート3001、test-data/test.db使用）
pnpm server:dev

# API検証（必ずポート3001）
curl http://localhost:3001/api/memos
curl http://localhost:3001/api/tasks

# Web UI検証: ブラウザで http://localhost:3001 にアクセス
```

**❌ ポート3000（本番APIサーバー・本番Web UI）へのアクセスは禁止。**

## 自動テスト（統合テスト）での一時環境パターン

```javascript
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mgtd-test-'));
const configPath = path.join(tmp, 'context.json');
const dbPath = path.join(tmp, 'issues.db');
const env = {
  ...process.env,
  MGTD_CONFIG_PATH: configPath
};

// この env を使ってコマンド実行
const init = runCli(['init', '-d', dbPath, '-f', '-j'], { env });
```

## 検証後の確認

テスト完了後、本番DBが変更されていないことを確認する:

```bash
ls -la ~/.local/share/mgtd/issues.db
```

## 誤って本番を変更した場合

1. 即座に作業を停止
2. 変更内容を報告
3. ユーザーの指示を仰ぐ

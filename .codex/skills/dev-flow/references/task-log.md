# Task への読み書き

開発フローが meme-gtd の Task を読み、記録するための固定手順。API の仕様を毎回調べ直さず、ここにあるコマンドだけを使う（調べ直しながら叩くと、同じリンクを二重に作るなどの誤操作が起きるため）。

## 接続先

ユーザーが起票する Task は本番（ポート3000）にある。`test-env` スキルの「ポート3000へのアクセス禁止」は検証・テストの話で、Task の記録は対象外。ただし本番に対して行ってよいのは、このファイルにある操作だけ。`mgtd` の直接実行は引き続き禁止。

```bash
API="${MGTD_API_URL:-http://localhost:3000}"
```

手順自体を試すときは `MGTD_API_URL=http://localhost:3001` を設定し、テスト環境に向ける。

リクエスト本文は `jq -n` で組み立てる（日本語・引用符・改行を含む本文を安全に送るため）。

## 読む

```bash
curl -fsS "$API/api/tasks/$TASK_ID"
curl -fsS "$API/api/tasks/$TASK_ID/comments"
curl -fsS "$API/api/issues/$TASK_ID/links"
curl -fsS "$API/api/issues/$TASK_ID/url-links"
```

## コメントを追加する

```bash
jq -n --arg b "$BODY" '{bodyMd:$b}' \
  | curl -fsS -X POST "$API/api/tasks/$TASK_ID/comments" -H 'Content-Type: application/json' -d @-
```

コメントに書くもの:

- 計画: 粒度の一覧、または分割しない場合のゴールと確認基準
- 実装中: 着手、ユーザーに確認して決まったこと、確認基準ごとの検証結果、未確認の項目とその理由
- レビュー: 指摘と対応

1件を短く保ち、調査の全文や長い計画は書かない。

## Task を起票する

ユーザーが起票を指示したときに使う。

```bash
jq -n --arg t "$TITLE" --arg b "$BODY" '{title:$t,bodyMd:$b}' \
  | curl -fsS -X POST "$API/api/tasks" -H 'Content-Type: application/json' -d @-
```

## サブ Task を作る

親 Task の既存リンクを先に読み、同じ粒度のサブ Task が無いことを確かめてから作る。

```bash
curl -fsS "$API/api/issues/$PARENT_ID/links"

CHILD_ID=$(jq -n --arg t "$TITLE" --arg b "$BODY" '{title:$t,bodyMd:$b}' \
  | curl -fsS -X POST "$API/api/tasks" -H 'Content-Type: application/json' -d @- | jq .id)

jq -n --argjson s "$CHILD_ID" --argjson t "$PARENT_ID" '{sourceIssueId:$s,targetIssueId:$t,linkType:"parent"}' \
  | curl -fsS -X POST "$API/api/links" -H 'Content-Type: application/json' -d @-
```

リンクは「子が source、親が target、`linkType` は `parent`」の1件だけ作る。

サブ Task の Body の形:

```markdown
## ゴール
- 何がどうできているか

## 確認基準
- 何が確認できれば、できていると言えるか
```

## PR を外部リンクとして登録する

既存の外部リンクを先に読み、同じ URL が無いときだけ登録する。

```bash
curl -fsS "$API/api/issues/$TASK_ID/url-links"

jq -n --arg u "$PR_URL" --arg t "$PR_TITLE" '{url:$u,title:$t}' \
  | curl -fsS -X POST "$API/api/issues/$TASK_ID/url-links" -H 'Content-Type: application/json' -d @-
```

## 行わない操作

Task の Body の更新、status の変更、Task・コメント・リンクの削除は、ユーザーの指示があるときだけ行う。

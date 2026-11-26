#!/usr/bin/env node
// dev-flow から meme-gtd の Task を読み書きする唯一の入口。
// 表示名 `PR`、`#数字` の扱い、指摘一覧の行を消さないことなどをここで固定する。
// 使い方は `node .codex/skills/dev-flow/scripts/task.mjs help`。
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';

const API = (process.env.MGTD_API_URL || 'http://localhost:3000').replace(/\/$/, '');
const STATUS_HEADING = '## 指摘一覧';
const KINDS = ['行動', '制約'];
const ACTION_STATES = ['未着手', '対応中', '完了', '対象外'];
const RULE_STATES = ['有効', '解除'];

// コメントの種類ごとに必須の見出し。本文はこの順で書く。
const TEMPLATES = {
  plan: ['## 計画', '### ゴール', '### 確認基準', '### 触る範囲', '### 合意'],
  start: ['## 着手', '### 何のために', '### 何をする'],
  decision: ['## 決定', '### 問い', '### 決まったこと'],
  verify: ['## 検証結果', '### 確認一覧', '### 結果', '### 未確認'],
  review: ['## レビュー結果', '### 指摘', '### 対応'],
};

const HELP = `task.mjs — dev-flow 用の meme-gtd Task 操作（接続先: ${API}）

  read <taskId>                               本文・コメント・リンク・外部リンクを表示
  comment <taskId> --kind <種類> (--file <path> | --body <本文>)
                                              テンプレートに沿ったコメントを投稿
                                              種類: ${Object.keys(TEMPLATES).join(' / ')}
  status <taskId> init                        指摘一覧のコメントを作る（既にあれば何もしない）
  status <taskId> show                        指摘一覧の全体を表示
  status <taskId> add --kind <行動|制約> --scene <場面> --words <原文> --do <やること|以降守ること> [--done-when <完了の条件>]
                                              ご指摘を1行追加（行は消せない）
                                              場面 = 直前に窓口が何を出し、何をしたか
                                              行動 = この指摘に対してやること（--done-when が必須）
                                              制約 = 以降ずっと守ること
  status <taskId> again --row <番号> --scene <場面> --words <原文>
                                              同じ指摘の繰り返しを、その行に再発として記録（完了済みの行動は対応中に戻る）
  status <taskId> set --row <番号> --state <状態> [--evidence <証拠>]
                                              行動: ${ACTION_STATES.join(' / ')}（完了は証拠が必須）
                                              制約: ${RULE_STATES.join(' / ')}
  add / again / set は、有効な制約（1行ずつ）と、前回の記録より後に付いた Task コメントを表示する。
  次の操作と報告の前に制約に照らす。記録のたびに read を呼び直す必要はない。
  場面は 120 文字、やること・守ることは 60 文字、完了の条件は 80 文字、証拠は 120 文字以内。
  link-pr <taskId> --url <GitHub PR の URL>    外部リンクを表示名 PR で登録（重複しない）
  create --title <題名> (--file <path> | --body <本文>) [--parent <taskId>]
                                              Task を起票（--parent でサブ Task）

本文中の #数字 は \\#数字 に置き換えて送る（Issue への自動リンクを作らないため）。
MemeGTD の Issue を参照したいときは "Task 2109" と書く。`;

function fail(message) {
  console.error(`task.mjs: ${message}`);
  process.exit(1);
}

function parseArgs(argv) {
  const positional = [];
  const flags = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg.startsWith('--')) {
      const value = argv[i + 1];
      if (value === undefined || value.startsWith('--')) fail(`${arg} に値がありません`);
      flags[arg.slice(2)] = value;
      i++;
    } else {
      positional.push(arg);
    }
  }
  return { positional, flags };
}

async function api(method, path, body) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  if (!res.ok) fail(`${method} ${path} が ${res.status} を返しました: ${text}`);
  return text ? JSON.parse(text) : null;
}

function taskIdOf(value) {
  if (!/^\d+$/.test(value ?? '')) fail(`Task ID は数字で指定してください: ${value}`);
  return Number(value);
}

// `#123` を `\#123` にする。コードと既にエスケープ済みのものは残す。
export function escapeIssueRefs(text) {
  return text
    .split(/(```[\s\S]*?```|`[^`\n]*`)/g)
    .map((part, i) => (i % 2 === 1 ? part : part.replace(/(^|[^\\/&#\w])#(\d+)\b/g, '$1\\#$2')))
    .join('');
}

export function checkTemplate(kind, body) {
  const headings = TEMPLATES[kind];
  if (!headings) fail(`種類は ${Object.keys(TEMPLATES).join(' / ')} のどれかです: ${kind}`);
  const lines = body.split('\n').map((l) => l.trim());
  // iOS アプリは Markdown の表を表示できず、記号がそのまま見えてしまう。
  if (lines.some((l) => /^\|.*\|$/.test(l))) fail('Task のコメントに Markdown の表は使えません（iOS アプリで表示できないため）。見出しと箇条書きで書いてください');
  let cursor = -1;
  for (const heading of headings) {
    const index = lines.indexOf(heading);
    if (index === -1) fail(`${kind} には見出し「${heading}」が必要です（順番: ${headings.join(' → ')}）`);
    if (index < cursor) fail(`見出しの順番が違います（順番: ${headings.join(' → ')}）`);
    cursor = index;
  }
}

// ---- 指摘一覧 ----

// ご指摘は、場面（直前に窓口が出したもの）と、それに対する行動か、以降の行動の制約として記録する。
// Task 2122 では、発言を1件1行で写すだけの一覧になり、やることも場面も残らず、状態の表示だけが書き換えられた。
// iOS アプリの Markdown 表示は表に対応していないため、見出しと箇条書きで書く。
// 行動 = 「### 番号. 【行動・状態】やること」＋ 場面・指摘・完了の条件・証拠。
// 制約 = 「### 番号. 【制約・状態】以降守ること」＋ 場面・指摘。
function cell(text) {
  return String(text).replace(/\r?\n/g, ' ').replace(/\s+/g, ' ').trim();
}

// 旧形式（Markdown の表）の行。読み込みだけ対応し、保存時は新形式に書き換える。
function splitRow(line) {
  const cells = [];
  let current = '';
  for (let i = 1; i < line.length - 1; i++) {
    if (line[i] === '\\' && line[i + 1] === '|') {
      current += '\\|';
      i++;
    } else if (line[i] === '|') {
      cells.push(current.trim());
      current = '';
    } else {
      current += line[i];
    }
  }
  cells.push(current.trim());
  return cells;
}

// 旧形式（1発言1行、状態・根拠・次）の行は、やることと場面が無い行動として読み込む。
const LEGACY_TITLE = '（旧形式の行: やることが未記入）';
const LEGACY_SCENE = '記録なし（旧形式の行）';
function legacyRow(no, state, words, evidence) {
  // 旧形式の状態は、完了の条件なしに付けられたものなので引き継がない（対象外だけはユーザーの決定なので残す）。
  const mapped = state === '対象外' ? '対象外' : '未着手';
  const old = evidence && evidence !== '—' ? `—（旧形式での状態「${state}」、根拠「${evidence}」）` : `—（旧形式での状態「${state}」）`;
  return { no, kind: '行動', state: mapped, title: LEGACY_TITLE, scene: LEGACY_SCENE, words, doneWhen: '—', evidence: old, again: [] };
}

const DETAIL_KEYS = { 場面: 'scene', 指摘: 'words', 完了の条件: 'doneWhen', 証拠: 'evidence', 根拠: 'evidence' };

export function parseStatus(body) {
  const rows = [];
  let current = null;
  for (const raw of body.split('\n')) {
    const line = raw.trim();
    const item = line.match(/^###\s+(\d+)\.\s+【(行動|制約)・([^】]+)】\s*(.*)$/);
    if (item) {
      current = { no: Number(item[1]), kind: item[2], state: item[3], title: item[4], scene: '—', words: '—', doneWhen: '—', evidence: '—', again: [] };
      rows.push(current);
      continue;
    }
    const legacy = line.match(/^###\s+(\d+)\.\s+【([^】]+)】\s*(.*)$/);
    if (legacy) {
      current = legacyRow(Number(legacy[1]), legacy[2], legacy[3], '—');
      rows.push(current);
      continue;
    }
    const detail = line.match(/^-\s+(場面|指摘|完了の条件|証拠|根拠|再発|次):\s*(.*)$/);
    if (detail && current) {
      if (detail[1] === '再発') current.again.push(detail[2]);
      else if (DETAIL_KEYS[detail[1]]) current[DETAIL_KEYS[detail[1]]] = detail[2] || '—';
      continue;
    }
    if (/^\|\s*\d+\s*\|/.test(line)) {
      const [no, words, state, evidence] = splitRow(line).map((c) => c.replace(/\\\|/g, '|').replace(/<br>/g, ' '));
      current = legacyRow(Number(no), state, words, evidence);
      rows.push(current);
    }
  }
  return rows;
}

export function renderStatus(rows) {
  const lines = [
    STATUS_HEADING,
    '',
    'ご指摘は、場面と、それに対する行動か、以降の行動の制約として記録する。行は消さない（dev-flow の task.mjs で更新）。',
  ];
  for (const r of rows) {
    lines.push('', `### ${r.no}. 【${r.kind}・${r.state}】${r.title}`, `- 場面: ${r.scene}`, `- 指摘: ${r.words}`);
    if (r.kind === '行動') lines.push(`- 完了の条件: ${r.doneWhen}`, `- 証拠: ${r.evidence}`);
    for (const a of r.again) lines.push(`- 再発: ${a}`);
  }
  return lines.join('\n');
}

// 記録・更新のたびに、有効な制約を窓口へ出し直す。
// 一覧に書いただけでは以降の行動に効かないため、操作の直後（次の行動の直前）に必ず読ませる。
// 出力は会話に残って毎ターン送り直されるので、制約は1行ずつ、行動は件数だけにする（行動の一覧は show）。
export function renderActive(rows) {
  const rules = rows.filter((r) => r.kind === '制約' && r.state === '有効');
  const open = rows.filter((r) => r.kind === '行動' && (r.state === '未着手' || r.state === '対応中'));
  const lines = [`守る制約 ${rules.length} 件（次の操作と報告の前に照らす）`, ...rules.map((r) => `${r.no}. ${r.title}`)];
  return [...lines, `未完了の行動 ${open.length} 件`].join('\n');
}

// 前回の記録より後に Task へ付いたコメントだけを返す。
// 記録のたびに Task 全体を読み直さなくて済むようにする（Task 2122 では読み直しの出力が合計21万文字になった）。
function newComments(statusComment, others) {
  const since = statusComment.updatedAt ?? statusComment.createdAt ?? '';
  const fresh = others.filter((c) => (c.createdAt ?? '') > since);
  if (fresh.length === 0) return '';
  return `\n前回の記録より後の Task コメント ${fresh.length} 件\n` + fresh.map((c) => `[${c.id}] ${c.bodyMd}`).join('\n');
}

function listOf(comments) {
  return Array.isArray(comments) ? comments : comments.items ?? comments.comments ?? [];
}

let otherComments = [];
async function findStatusComment(taskId) {
  const list = listOf(await api('GET', `/api/tasks/${taskId}/comments`));
  otherComments = list.filter((c) => !c.bodyMd.startsWith(STATUS_HEADING));
  return list.find((c) => c.bodyMd.startsWith(STATUS_HEADING)) ?? null;
}

async function saveStatus(taskId, comment, rows) {
  const bodyMd = escapeIssueRefs(renderStatus(rows));
  await api('PATCH', `/api/tasks/${taskId}/comments/${comment.id}`, { bodyMd });
}

// 場面・やること・完了の条件・証拠は、一覧と毎回の表示に残り続けるので短く書かせる。原文（--words）には上限を付けない。
const LIMITS = { scene: 120, do: 60, 'done-when': 80, evidence: 120 };
function capped(flags, name) {
  const value = cell(flags[name] ?? '');
  if (LIMITS[name] && value.length > LIMITS[name]) fail(`--${name} は ${LIMITS[name]} 文字以内で書いてください（いま ${value.length} 文字）`);
  return value;
}

function required(flags, name, what) {
  const value = capped(flags, name);
  if (!value) fail(`--${name} に${what}を渡してください`);
  return value;
}

async function status(taskId, action, flags) {
  if (action === 'init') {
    const existing = await findStatusComment(taskId);
    if (existing) {
      console.log(`指摘一覧は既にあります（コメント ${existing.id}）`);
      return;
    }
    const created = await api('POST', `/api/tasks/${taskId}/comments`, { bodyMd: renderStatus([]) });
    console.log(`指摘一覧を作りました（コメント ${created.id ?? '?'}）`);
    return;
  }
  const comment = await findStatusComment(taskId);
  if (!comment) fail(`Task ${taskId} に指摘一覧がありません。先に status ${taskId} init を実行してください`);
  const rows = parseStatus(comment.bodyMd);
  const tail = () => `${renderActive(rows)}${newComments(comment, otherComments)}`;
  if (action === 'show') {
    console.log(renderStatus(rows));
    return;
  }
  if (action === 'add') {
    if (!KINDS.includes(flags.kind)) fail(`--kind は ${KINDS.join(' / ')} のどちらかです（行動 = この指摘に対してやること、制約 = 以降ずっと守ること）: ${flags.kind}`);
    const scene = required(flags, 'scene', '場面（直前に窓口が何を出し、何をしたか。Task 本文からの要求なら「Task 本文 What」など）');
    const words = required(flags, 'words', 'ご指摘の原文');
    const title = required(flags, 'do', flags.kind === '行動' ? 'やること' : '以降守ること');
    if (scene === words) fail('--scene にご指摘の原文をそのまま渡さないでください。直前に窓口が何を出し、何をしたかを書きます');
    if (title === words) fail('--do にご指摘の原文をそのまま渡さないでください。この指摘を受けて何をするか（制約なら以降何を守るか）を書きます');
    const doneWhen = flags.kind === '行動' ? required(flags, 'done-when', '完了の条件（何が出来ていれば完了か）') : '—';
    const no = rows.reduce((max, r) => Math.max(max, r.no), 0) + 1;
    rows.push({ no, kind: flags.kind, state: flags.kind === '行動' ? '未着手' : '有効', title, scene, words, doneWhen, evidence: '—', again: [] });
    await saveStatus(taskId, comment, rows);
    console.log(`${no} 行目に${flags.kind}として追加\n${tail()}`);
    return;
  }
  const row = rows.find((r) => r.no === Number(flags.row));
  if (!row) fail(`${flags.row} 行目はありません`);
  if (action === 'again') {
    const scene = required(flags, 'scene', '場面（今回、直前に窓口が何を出し、何をしたか）');
    const words = required(flags, 'words', 'ご指摘の原文');
    row.again.push(`場面「${scene}」指摘「${words}」`);
    if (row.kind === '行動' && row.state !== '対応中') {
      row.state = '対応中';
      row.evidence = '—';
    }
    await saveStatus(taskId, comment, rows);
    console.log(`${row.no} 行目に再発（${row.again.length} 回目）を記録${row.kind === '行動' ? '、状態は対応中' : ''}\n${tail()}`);
    return;
  }
  if (action === 'set') {
    const states = row.kind === '行動' ? ACTION_STATES : RULE_STATES;
    if (!states.includes(flags.state)) fail(`${row.no} 行目は${row.kind}です。状態は ${states.join(' / ')} のどれかです: ${flags.state}`);
    if (flags.state === '完了' && !flags.evidence) fail('完了にするには --evidence（完了の条件を満たした証拠: チャットでの報告、スクショのパス、テスト名、コミットなど）が必要です');
    if (row.title === LEGACY_TITLE && !flags.do) fail(`${row.no} 行目は旧形式で、やることが未記入です。--do と --scene を合わせて渡してください`);
    row.state = flags.state;
    if (flags.evidence) row.evidence = capped(flags, 'evidence');
    if (row.title === LEGACY_TITLE) {
      row.title = capped(flags, 'do');
      if (flags.scene) row.scene = capped(flags, 'scene');
      if (flags['done-when']) row.doneWhen = capped(flags, 'done-when');
    }
    await saveStatus(taskId, comment, rows);
    console.log(`${row.no} 行目を「${row.state}」に更新\n${tail()}`);
    return;
  }
  fail(`status の操作は init / show / add / again / set のどれかです: ${action}`);
}

// ---- その他の操作 ----

// 値のある項目だけを1行で出す（null・false・空の項目と、別に出す本文を除く）。
function compact(obj, skip = []) {
  const kept = Object.entries(obj ?? {}).filter(([k, v]) => !skip.includes(k) && v !== null && v !== false && v !== '' && !(Array.isArray(v) && v.length === 0) && !(typeof v === 'object' && !Array.isArray(v) && Object.keys(v).length === 0));
  return JSON.stringify(Object.fromEntries(kept));
}

// Task の現在の内容を、読むのに要る分だけ出す。JSON の全項目を整形して出すと、
// 値の無い項目と字下げで出力が膨らみ、読むたびに会話へ残る。
async function read(taskId) {
  const [task, comments, links, urlLinks] = await Promise.all([
    api('GET', `/api/tasks/${taskId}`),
    api('GET', `/api/tasks/${taskId}/comments`),
    api('GET', `/api/issues/${taskId}/links`),
    api('GET', `/api/issues/${taskId}/url-links`),
  ]);
  const item = task.item ?? task;
  const out = [`# Task ${item.id}: ${item.title}`, compact(item, ['id', 'title', 'bodyMd', 'type', 'isDeleted', 'createdAt', 'updatedAt', 'commentCount']), '', item.bodyMd ?? ''];
  for (const c of listOf(comments)) out.push('', `--- コメント ${c.id}（${(c.createdAt ?? '').slice(0, 16)}）`, c.bodyMd);
  const linkList = Array.isArray(links) ? links : links.items ?? links.links ?? [];
  if (linkList.length) out.push('', '--- リンク', ...linkList.map((l) => compact(l, ['createdAt', 'updatedAt'])));
  if (urlLinks.length) out.push('', '--- 外部リンク', ...urlLinks.map((l) => compact(l, ['createdAt', 'updatedAt', 'issueId'])));
  console.log(out.join('\n'));
}

// 本文は --file（実装役など）か --body（ファイルを書けない窓口）で受け取る。
function bodyOf(flags) {
  if (flags.file && flags.body) fail('--file と --body はどちらか一方だけ指定してください');
  if (flags.file) return readFileSync(flags.file, 'utf8').trim();
  if (flags.body) return flags.body.trim();
  fail('--file か --body で本文を渡してください');
}

async function comment(taskId, flags) {
  if (!flags.kind) fail('--kind が必要です');
  const body = bodyOf(flags);
  checkTemplate(flags.kind, body);
  const created = await api('POST', `/api/tasks/${taskId}/comments`, { bodyMd: escapeIssueRefs(body) });
  console.log(`コメントを投稿しました（コメント ${created.id ?? '?'}）`);
}

async function linkPr(taskId, flags) {
  const url = flags.url ?? '';
  if (!/^https:\/\/github\.com\/[^/]+\/[^/]+\/pull\/\d+$/.test(url)) fail(`--url は GitHub PR の完全な URL です: ${url}`);
  const list = await api('GET', `/api/issues/${taskId}/url-links`);
  const same = list.filter((l) => l.url === url);
  if (same.length > 1) fail(`同じ URL の外部リンクが ${same.length} 件あります（ID: ${same.map((l) => l.id).join(', ')}）。重複を報告してください`);
  if (same.length === 1 && same[0].title !== 'PR') {
    await api('PATCH', `/api/url-links/${same[0].id}`, { title: 'PR' });
  } else if (same.length === 0) {
    await api('POST', `/api/issues/${taskId}/url-links`, { url, title: 'PR' });
  }
  const after = (await api('GET', `/api/issues/${taskId}/url-links`)).filter((l) => l.url === url);
  if (after.length !== 1 || after[0].title !== 'PR') fail('登録後の確認で、表示名 PR の外部リンクが1件になっていません');
  console.log(`Task ${taskId} に ${url} を表示名 PR で登録しています`);
}

async function create(flags) {
  if (!flags.title) fail('--title が必要です');
  const body = escapeIssueRefs(bodyOf(flags));
  const task = await api('POST', '/api/tasks', { title: flags.title, bodyMd: body });
  const id = task.id ?? task.item?.id;
  if (flags.parent) {
    const parentId = taskIdOf(flags.parent);
    await api('POST', '/api/links', { sourceIssueId: id, targetIssueId: parentId, linkType: 'parent' });
  }
  console.log(`Task ${id} を作りました${flags.parent ? `（親 Task ${flags.parent}）` : ''}`);
}

async function main() {
  const { positional, flags } = parseArgs(process.argv.slice(2));
  const [command, first, second] = positional;
  switch (command) {
    case 'read':
      return read(taskIdOf(first));
    case 'comment':
      return comment(taskIdOf(first), flags);
    case 'status':
      return status(taskIdOf(first), second, flags);
    case 'link-pr':
      return linkPr(taskIdOf(first), flags);
    case 'create':
      return create(flags);
    case 'help':
    case undefined:
      console.log(HELP);
      return;
    default:
      fail(`不明な操作です: ${command}\n\n${HELP}`);
  }
}

if (fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((error) => fail(error.message));
}

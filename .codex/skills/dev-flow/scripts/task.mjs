#!/usr/bin/env node
// dev-flow から meme-gtd の Task を読み書きする唯一の入口。
// 表示名 `PR`、`#数字` の扱い、状態表の行を消さないことなどをここで固定する。
// 使い方は `node .codex/skills/dev-flow/scripts/task.mjs help`。
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';

const API = (process.env.MGTD_API_URL || 'http://localhost:3000').replace(/\/$/, '');
const STATUS_HEADING = '## 指摘一覧';
const PLAN_HEADING = '## 計画';
const PLAN_CHECK_HEADING = '## 計画チェック';
const APPROVAL_HEADING = '## 承認';
const STATES = ['未着手', '対応中', '確認済み', '未確認', '対象外'];

// コメントの種類ごとに必須の見出し。本文はこの順で書く。
const TEMPLATES = {
  plan: ['## 計画', '### ゴール', '### 方式', '### 触る範囲', '### 確認基準', '### 反映先', '### 合意'],
  'plan-check': ['## 計画チェック', '### 確認したこと', '### 指摘'],
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
  approve <taskId> --words <ユーザーの承認の原文>
                                              計画の承認を記録（最新の計画と、その後の計画チェックが必要）
  status <taskId> init                        指摘一覧（状態表）のコメントを作る（既にあれば何もしない）
  status <taskId> show                        状態表を表示
  status <taskId> add --words <原文> [--from <出典>]
                                              ご指摘を1行追加（原文のまま。行は消せない）
  status <taskId> set --row <番号> --state <状態> [--evidence <根拠>] [--next <次>]
                                              状態: ${STATES.join(' / ')}（確認済みは根拠が必須）
  link-pr <taskId> --url <GitHub PR の URL>    外部リンクを表示名 PR で登録（重複しない）
  create --title <題名> (--file <path> | --body <本文>) [--parent <taskId>]
                                              Task を起票（--parent でサブ Task）

記録の順番: plan → plan-check → approve → start。start は承認が無いと拒否、
review は表示名 PR の外部リンクが無いと拒否する。

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

// ---- 状態表 ----

// iOS アプリの Markdown 表示は表に対応していないため、状態表は見出しと箇条書きで書く。
// 1件 = 「### 番号. 【状態】ご指摘の原文」＋「- 根拠: 」「- 次: 」。
function cell(text) {
  return String(text).replace(/\r?\n/g, ' ').trim();
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

export function parseStatus(body) {
  const rows = [];
  let current = null;
  for (const raw of body.split('\n')) {
    const line = raw.trim();
    const item = line.match(/^###\s+(\d+)\.\s+【([^】]+)】\s*(.*)$/);
    if (item) {
      current = { no: Number(item[1]), state: item[2], words: item[3], evidence: '—', next: '—' };
      rows.push(current);
      continue;
    }
    const detail = line.match(/^-\s+(根拠|次):\s*(.*)$/);
    if (detail && current) {
      current[detail[1] === '根拠' ? 'evidence' : 'next'] = detail[2] || '—';
      continue;
    }
    if (/^\|\s*\d+\s*\|/.test(line)) {
      const [no, words, state, evidence, next] = splitRow(line).map((c) => c.replace(/\\\|/g, '|').replace(/<br>/g, ' '));
      rows.push({ no: Number(no), words, state, evidence, next });
    }
  }
  return rows;
}

export function renderStatus(rows) {
  const lines = [
    STATUS_HEADING,
    '',
    'ご指摘は1件ずつ。項目は消さず、状態・根拠・次だけを更新する（dev-flow の task.mjs で更新）。',
  ];
  for (const r of rows) {
    lines.push('', `### ${r.no}. 【${r.state}】${r.words}`, `- 根拠: ${r.evidence}`, `- 次: ${r.next}`);
  }
  return lines.join('\n');
}

async function listComments(taskId) {
  const comments = await api('GET', `/api/tasks/${taskId}/comments`);
  return Array.isArray(comments) ? comments : comments.items ?? comments.comments ?? [];
}

async function findStatusComment(taskId) {
  return (await listComments(taskId)).find((c) => c.bodyMd.startsWith(STATUS_HEADING)) ?? null;
}

// ---- 計画の承認 ----

// 見出しが一致する最新のコメント。`## 計画` が `## 計画チェック` に一致しないよう、1行目全体で比べる。
function latestWith(comments, heading) {
  return comments
    .filter((c) => String(c.bodyMd ?? '').split('\n')[0].trim() === heading)
    .reduce((latest, c) => (!latest || c.id > latest.id ? c : latest), null);
}

// 計画が承認まで進んでいるかを返す。コメントの ID は投稿順に増える。
export function planGate(comments) {
  const plan = latestWith(comments, PLAN_HEADING);
  const check = latestWith(comments, PLAN_CHECK_HEADING);
  const approval = latestWith(comments, APPROVAL_HEADING);
  return {
    plan,
    checked: Boolean(plan && check && check.id > plan.id),
    approved: Boolean(plan && approval && approval.id > plan.id),
  };
}

async function approve(taskId, flags) {
  const words = (flags.words ?? '').trim();
  if (!words) fail('--words に、提示した計画に対するユーザーの承認の原文を渡してください');
  const gate = planGate(await listComments(taskId));
  if (!gate.plan) fail(`Task ${taskId} に計画（${PLAN_HEADING}）がありません。計画役に計画を記録させてください`);
  if (!gate.checked) {
    fail(`計画（コメント ${gate.plan.id}）の後に計画チェック（${PLAN_CHECK_HEADING}）がありません。レビュー役に計画チェックをさせ、結果を含めた計画をチャットに出してから承認を得てください`);
  }
  const body = [APPROVAL_HEADING, '### 承認した計画', `- コメント ${gate.plan.id}`, '### ユーザーの言葉', words].join('\n');
  const created = await api('POST', `/api/tasks/${taskId}/comments`, { bodyMd: escapeIssueRefs(body) });
  console.log(`計画（コメント ${gate.plan.id}）の承認を記録しました（コメント ${created.id ?? '?'}）`);
}

async function saveStatus(taskId, comment, rows) {
  const bodyMd = escapeIssueRefs(renderStatus(rows));
  await api('PATCH', `/api/tasks/${taskId}/comments/${comment.id}`, { bodyMd });
}

async function status(taskId, action, flags) {
  if (action === 'init') {
    const existing = await findStatusComment(taskId);
    if (existing) {
      console.log(`状態表は既にあります（コメント ${existing.id}）`);
      return;
    }
    const created = await api('POST', `/api/tasks/${taskId}/comments`, { bodyMd: renderStatus([]) });
    console.log(`状態表を作りました（コメント ${created.id ?? '?'}）`);
    return;
  }
  const comment = await findStatusComment(taskId);
  if (!comment) fail(`Task ${taskId} に状態表がありません。先に status ${taskId} init を実行してください`);
  const rows = parseStatus(comment.bodyMd);
  if (action === 'show') {
    console.log(renderStatus(rows));
    return;
  }
  if (action === 'add') {
    if (!flags.words) fail('--words にご指摘の原文を渡してください');
    const words = flags.from ? `${flags.words}（${flags.from}）` : flags.words;
    const no = rows.reduce((max, r) => Math.max(max, r.no), 0) + 1;
    rows.push({ no, words: cell(words), state: '未着手', evidence: '—', next: '—' });
    await saveStatus(taskId, comment, rows);
    console.log(`${no} 行目を追加しました`);
    return;
  }
  if (action === 'set') {
    const row = rows.find((r) => r.no === Number(flags.row));
    if (!row) fail(`${flags.row} 行目はありません`);
    if (!STATES.includes(flags.state)) fail(`状態は ${STATES.join(' / ')} のどれかです: ${flags.state}`);
    if (flags.state === '確認済み' && !flags.evidence) fail('確認済みにするには --evidence（スクショのパス・コミット・テスト名など）が必要です');
    row.state = flags.state;
    if (flags.evidence) row.evidence = cell(flags.evidence);
    if (flags.next) row.next = cell(flags.next);
    await saveStatus(taskId, comment, rows);
    console.log(`${row.no} 行目を「${row.state}」にしました`);
    return;
  }
  fail(`status の操作は init / show / add / set のどれかです: ${action}`);
}

// ---- その他の操作 ----

async function read(taskId) {
  const [task, comments, links, urlLinks] = await Promise.all([
    api('GET', `/api/tasks/${taskId}`),
    api('GET', `/api/tasks/${taskId}/comments`),
    api('GET', `/api/issues/${taskId}/links`),
    api('GET', `/api/issues/${taskId}/url-links`),
  ]);
  console.log(JSON.stringify({ task, comments, links, urlLinks }, null, 2));
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
  if (flags.kind === 'start') {
    const gate = planGate(await listComments(taskId));
    if (!gate.plan) fail(`Task ${taskId} に計画（${PLAN_HEADING}）がありません。着手の前に、計画・計画チェック・ユーザーの承認が必要です。窓口に返してください`);
    if (!gate.approved) {
      fail(`計画（コメント ${gate.plan.id}）に対するユーザーの承認が記録されていません。実装を始めず、窓口に返してください。窓口は、計画の内容をチャットに出して承認を得てから task.mjs approve で記録します`);
    }
  }
  if (flags.kind === 'review') {
    const links = await api('GET', `/api/issues/${taskId}/url-links`);
    if (!links.some((l) => l.title === 'PR')) fail(`Task ${taskId} に表示名 PR の外部リンクがありません。先に task.mjs link-pr ${taskId} --url <PR URL> で登録してください`);
  }
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
    case 'approve':
      return approve(taskIdOf(first), flags);
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

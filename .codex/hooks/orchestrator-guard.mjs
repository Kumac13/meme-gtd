#!/usr/bin/env node
// PreToolUse フック: 窓口（サブエージェントではないスレッド）の操作を、
// ユーザーとの会話・Task の読み書き・担当役の起動と待機に限る。
// Task 2107 では窓口が自分でブラウザーを操作して撮影し、60秒の待機を52回繰り返した。
// サブエージェントは agent_id 付きで呼ばれるので、この制限を受けない。
// フックは、ユーザーが Codex の Settings > Hooks（CLI は /hooks）で信頼するまで実行されない。
// 定義を変えると信頼は外れる。有効かどうかは HOOK_CHECK のコマンドで確かめる（SKILL.md「最初に」）。
import { fileURLToPath } from 'node:url';
import { appendFileSync, readFileSync } from 'node:fs';
import { markGuardSeen, rememberTask, taskIdIn } from './dev-flow-state.mjs';

export const HOOK_CHECK = 'echo dev-flow-hook-check';
export const WAIT_TIMEOUT_MS = 3600000;

const SKILL_FILE = /^(\.\/)?(\.codex\/(skills|agents|rules)\/|\.claude\/skills\/|AGENTS\.md$|CLAUDE\.md$)/;
const onlySkillFiles = (args) => {
  const files = args.filter((a) => !a.startsWith('-') && !/^\d+(,\d+)?p$/.test(a));
  return files.length > 0 && files.every((a) => SKILL_FILE.test(a) && !a.includes('..'));
};

// 窓口が実行できるコマンド: Task の読み書きと、スキル・ルールのファイルを読むことだけ。
const ALLOWED = {
  node: (args) => /^(\.\/)?\.codex\/skills\/dev-flow\/scripts\/task\.mjs$/.test(args[0] ?? ''),
  cat: onlySkillFiles,
  // パイプの後ろで出力を絞る（cat ... | head -20）。ファイルを指定するなら、スキル・ルールのファイルだけ。
  head: (args) => args.every((a) => a.startsWith('-') || /^\d+$/.test(a)) || onlySkillFiles(args.filter((a) => !/^\d+$/.test(a))),
  tail: (args) => args.every((a) => a.startsWith('-') || /^\d+$/.test(a)) || onlySkillFiles(args.filter((a) => !/^\d+$/.test(a))),
  sed: (args) => args.includes('-n') && !args.some((a) => a.startsWith('-i')) && onlySkillFiles(args.filter((a) => a !== '-n')),
};

// 窓口が自分で行わない操作（調査・画面操作・撮影・画像の点検）。
const WORK_TOOL = /^mcp__|(^|[^a-z])(view_image|web_search|js)$/;

// 引用符の外にある && || ; | で区切る。
export function splitCommands(command) {
  const segments = [];
  let current = '';
  let quote = null;
  for (let i = 0; i < command.length; i++) {
    const c = command[i];
    if (quote) {
      if (c === quote) quote = null;
      else if (c === '\\' && quote === '"') {
        current += c + (command[i + 1] ?? '');
        i++;
        continue;
      }
      current += c;
      continue;
    }
    if (c === '"' || c === "'") {
      quote = c;
      current += c;
      continue;
    }
    const two = command.slice(i, i + 2);
    if (two === '&&' || two === '||') {
      segments.push(current);
      current = '';
      i++;
      continue;
    }
    if (c === ';' || c === '|' || c === '\n') {
      segments.push(current);
      current = '';
      continue;
    }
    current += c;
  }
  segments.push(current);
  return segments.map((s) => s.trim()).filter(Boolean);
}

function words(segment) {
  const result = [];
  const re = /"((?:\\.|[^"\\])*)"|'([^']*)'|(\S+)/g;
  let m;
  while ((m = re.exec(segment))) result.push(m[1] ?? m[2] ?? m[3]);
  // 先頭の環境変数代入（FOO=bar cmd）は飛ばす。
  while (result.length && /^[A-Za-z_][A-Za-z0-9_]*=/.test(result[0])) result.shift();
  return result;
}

// 拒否する理由を返す。許可なら null。
export function denyReason(command) {
  const outsideQuotes = command.replace(/"(?:\\.|[^"\\])*"|'[^']*'/g, '""');
  if (/\$\(|`/.test(outsideQuotes)) return 'コマンド置換（$(...) や `...`）は窓口では使えません';
  const redirects = outsideQuotes.replace(/2>&1|2?>\s*\/dev\/null/g, '');
  if (/>|<</.test(redirects)) return 'ファイルへの書き込み（リダイレクト）は窓口では使えません';
  for (const segment of splitCommands(command)) {
    const [name, ...args] = words(segment);
    if (!name) continue;
    const base = name.split('/').pop();
    const allow = ALLOWED[base];
    if (!allow || !allow(args)) return `「${segment}」は窓口では実行できません`;
  }
  return null;
}

function deny(message) {
  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: 'deny', permissionDecisionReason: message },
    })
  );
}

const DELEGATE =
  '窓口が行うのは、ユーザーとの会話、task.mjs による Task の読み書き、担当役の起動と待機だけです。' +
  '調査・コードの読み取り・画面操作・撮影・画像の点検・編集・ビルド・テスト・push・PR 作成は、担当役に spawn_agent で渡してください。';

// 拒否する文言を返す。許可なら null。
export function decide(input) {
  if (input.agent_id) return null; // サブエージェントは対象外
  const tool = String(input.tool_name ?? '');
  if (tool === 'apply_patch') return `ファイルの編集は窓口では行えません。${DELEGATE}`;
  if (tool === 'Bash') {
    const command = String(input.tool_input?.command ?? '').trim();
    if (command === HOOK_CHECK) return 'dev-flow のフックは有効です。この拒否は確認用なので、そのまま手順を続けてください。';
    const reason = denyReason(command);
    return reason ? `${reason}。${DELEGATE}` : null;
  }
  if (/wait_agent$/.test(tool)) {
    if (Number(input.tool_input?.timeout_ms) === WAIT_TIMEOUT_MS) return null;
    return (
      `wait_agent は timeout_ms=${WAIT_TIMEOUT_MS} で呼んでください。` +
      '担当役の完了とユーザーの発言で待機は終わるので、短い間隔で待ち直す必要はありません（待ち直すたびに窓口の文脈全体が送り直されます）。'
    );
  }
  if (WORK_TOOL.test(tool)) return `${tool} は窓口では使えません。${DELEGATE}`;
  return null;
}

function main() {
  const input = JSON.parse(readFileSync(0, 'utf8'));
  // DEV_FLOW_HOOK_LOG にパスを入れると、受け取った入力を追記する（フックが実行されたか、ツール名が何かを確かめるため）。
  if (process.env.DEV_FLOW_HOOK_LOG) appendFileSync(process.env.DEV_FLOW_HOOK_LOG, `${JSON.stringify(input)}\n`);
  // task.mjs の呼び出しから、このスレッドが進めている Task を控える（制約を渡すフックが使う）。
  const command = input.tool_name === 'Bash' ? String(input.tool_input?.command ?? '') : '';
  if (command.includes('task.mjs')) {
    markGuardSeen();
    if (!input.agent_id) rememberTask(input.session_id, taskIdIn(command));
  }
  const message = decide(input);
  if (message) deny(message);
}

if (fileURLToPath(import.meta.url) === process.argv[1]) main();

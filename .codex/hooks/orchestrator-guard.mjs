#!/usr/bin/env node
// PreToolUse フック: 窓口（サブエージェントではないスレッド）が実行できるのを、
// 読み取り系のコマンドと dev-flow の task.mjs / checklist.mjs に限る。
// 窓口が自分で作業して文脈を膨らませるのを防ぐため（dev-flow「分担」）。
// サブエージェントは agent_id 付きで呼ばれるので、この制限を受けない。
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';

const READ_ONLY = {
  git: (args) => {
    const sub = args[0];
    if (['status', 'diff', 'log', 'show', 'rev-parse', 'ls-files', 'blame', 'grep'].includes(sub)) return true;
    if (sub === 'branch') return !args.some((a) => /^-(d|D|m|M|c|C|f)$|^--(delete|move|copy|force|set-upstream)/.test(a));
    if (sub === 'worktree') return args[1] === 'list';
    return false;
  },
  gh: (args) =>
    (args[0] === 'pr' && ['view', 'diff', 'list', 'checks'].includes(args[1])) ||
    (args[0] === 'issue' && ['view', 'list'].includes(args[1])),
  sed: (args) => args.includes('-n') && !args.some((a) => a.startsWith('-i')),
  find: (args) => !args.some((a) => ['-delete', '-exec', '-execdir', '-ok', '-fprint'].includes(a)),
  node: (args) => /(^|\/)\.codex\/skills\/dev-flow\/scripts\/(task|checklist)\.mjs$/.test(args[0] ?? ''),
};
for (const name of ['rg', 'grep', 'ls', 'cat', 'head', 'tail', 'wc', 'jq', 'pwd', 'echo', 'date', 'which', 'cd', 'true']) {
  READ_ONLY[name] = () => true;
}

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
    const allow = READ_ONLY[base];
    if (!allow || !allow(args)) return `「${segment}」は窓口では実行できません`;
  }
  return null;
}

function deny(reason) {
  const message =
    `${reason}。窓口が実行できるのは読み取り系のコマンドと dev-flow の task.mjs / checklist.mjs だけです。` +
    '作業（編集・ビルド・テスト・シミュレーター・push・PR 作成）は計画役・実装役・確認役・レビュー役に spawn_agent で渡してください。';
  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: 'deny', permissionDecisionReason: message },
    })
  );
}

function main() {
  const input = JSON.parse(readFileSync(0, 'utf8'));
  if (input.agent_id) return; // サブエージェントは対象外
  if (input.tool_name === 'apply_patch') return deny('ファイルの編集');
  if (input.tool_name !== 'Bash') return;
  const reason = denyReason(String(input.tool_input?.command ?? ''));
  if (reason) deny(reason);
}

if (fileURLToPath(import.meta.url) === process.argv[1]) main();

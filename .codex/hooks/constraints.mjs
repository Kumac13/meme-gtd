#!/usr/bin/env node
// SessionStart（圧縮後・再開時）と SubagentStart のフック: そのスレッドが進めている Task の、有効な制約を渡す。
// Task 2122 では、ご指摘を一覧に書いても以降の行動が変わらなかった。制約は、窓口がスクリプトを呼ぶかどうかに頼らず、
// 制約が変わったときの発言（user-prompt.mjs）・会話の圧縮後・担当役の起動時に、フックから開発者向けの文脈として渡す。
// 標準出力が、そのまま文脈に追加される。制約が無いとき、Task が分からないとき、API に届かないときは何も出さない。
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';
import { markSent, taskOf } from './dev-flow-state.mjs';
import { parseStatus } from '../skills/dev-flow/scripts/task.mjs';

const API = (process.env.MGTD_API_URL || 'http://localhost:3000').replace(/\/$/, '');
const STATUS_HEADING = '## 指摘一覧';

function constraintLines(taskId, rows) {
  const rules = rows.filter((r) => r.kind === '制約' && r.state === '有効');
  if (rules.length === 0) return '';
  return [`[dev-flow] Task ${taskId} でユーザーが課した制約 ${rules.length} 件。次の操作と報告の前に、全件に照らす。`, ...rules.map((r) => `${r.no}. ${r.title}`)].join('\n');
}

export async function constraintsFor(sessionId) {
  const taskId = taskOf(sessionId);
  if (!taskId) return '';
  try {
    const res = await fetch(`${API}/api/tasks/${taskId}/comments`, { signal: AbortSignal.timeout(1500) });
    if (!res.ok) return '';
    const comments = await res.json();
    const list = Array.isArray(comments) ? comments : comments.items ?? comments.comments ?? [];
    const status = list.find((c) => c.bodyMd.startsWith(STATUS_HEADING));
    return status ? constraintLines(taskId, parseStatus(status.bodyMd)) : '';
  } catch {
    return '';
  }
}

async function main() {
  const input = JSON.parse(readFileSync(0, 'utf8'));
  const text = await constraintsFor(input.session_id);
  // 圧縮後・再開時は、窓口に渡し直した文面として控える。担当役への受け渡しは窓口の控えを変えない。
  if (!input.agent_id && input.hook_event_name !== 'SubagentStart') markSent(input.session_id, text);
  process.stdout.write(text);
}

if (fileURLToPath(import.meta.url) === process.argv[1]) main();

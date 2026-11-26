// dev-flow のフックと task.mjs が共有する、スレッドごとの小さな状態。
// フックは Task の ID を知らないので、窓口が task.mjs を呼んだときに「このスレッドはどの Task か」を控え、
// 発言ごと・圧縮後・担当役の起動時のフックが、その Task の有効な制約を取りに行けるようにする。
// 置き場所は /tmp（Codex のサンドボックス内のコマンドからも、フックからも書ける）。
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const DIR = join('/tmp', `dev-flow-${createHash('sha1').update(REPO_ROOT).digest('hex').slice(0, 12)}`);
const SEEN = join(DIR, 'guard-seen');
const safe = (id) => String(id).replace(/[^A-Za-z0-9_-]/g, '_');

// コマンド中の task.mjs 呼び出しから Task ID を取り出す（read / status / comment / link-pr）。
export function taskIdIn(command) {
  const m = String(command).match(/task\.mjs["']?\s+(?:read|status|comment|link-pr)\s+(\d+)/);
  return m ? Number(m[1]) : null;
}

export function rememberTask(sessionId, taskId) {
  if (!sessionId || !taskId) return;
  mkdirSync(DIR, { recursive: true });
  writeFileSync(join(DIR, `task-${safe(sessionId)}`), String(taskId));
}

export function taskOf(sessionId) {
  try {
    return Number(readFileSync(join(DIR, `task-${safe(sessionId)}`), 'utf8')) || null;
  } catch {
    return null;
  }
}

// 最後にそのスレッドへ渡した制約の文面。同じ文面を発言のたびに渡し直すと、その分が会話に積み上がって
// 毎ターン送り直されるので、発言ごとのフックは文面が変わったときだけ渡す（圧縮後は必ず渡し直す）。
export function alreadySent(sessionId, text) {
  try {
    return readFileSync(join(DIR, `sent-${safe(sessionId)}`), 'utf8') === text;
  } catch {
    return false;
  }
}

export function markSent(sessionId, text) {
  if (!sessionId) return;
  mkdirSync(DIR, { recursive: true });
  writeFileSync(join(DIR, `sent-${safe(sessionId)}`), text);
}

// 窓口フックが task.mjs の呼び出しを見た時刻。task.mjs はこれで「フックが動いているか」を知る。
export function markGuardSeen() {
  mkdirSync(DIR, { recursive: true });
  writeFileSync(SEEN, String(Date.now()));
}

export function guardSeenRecently(withinMs = 15000) {
  try {
    return Date.now() - statSync(SEEN).mtimeMs < withinMs;
  } catch {
    return false;
  }
}

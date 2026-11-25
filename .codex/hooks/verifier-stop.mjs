#!/usr/bin/env node
// SubagentStop フック（確認役のみ）: 最後の応答にある「確認一覧: <絶対パス>」の全行に、
// 結果と実操作の証拠がそろうまで終了を差し戻す。未確認のまま「確認しました」と返すのを防ぐため。
// 差し戻しは同じ確認役につき3回まで。それ以上は通し、窓口に未完了として扱わせる。
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkChecklist } from '../skills/dev-flow/scripts/checklist.mjs';

const MAX_BLOCKS = 3;

export function checklistPathFrom(message) {
  const match = String(message ?? '').match(/確認一覧[:：]\s*`?(\/[^\s`]+\.json)`?/);
  return match ? match[1] : null;
}

function blockCountFile(agentId) {
  const dir = join(tmpdir(), 'dev-flow-verifier-stop');
  mkdirSync(dir, { recursive: true });
  return join(dir, `${agentId.replace(/[^\w-]/g, '_')}.count`);
}

function main() {
  const input = JSON.parse(readFileSync(0, 'utf8'));
  const path = checklistPathFrom(input.last_assistant_message);
  const problems = path ? checkChecklist(path) : ['最後の応答に「確認一覧: <絶対パス>.json」の行がありません'];
  if (problems.length === 0) return;

  const countFile = blockCountFile(input.agent_id ?? 'unknown');
  const count = existsSync(countFile) ? Number(readFileSync(countFile, 'utf8')) || 0 : 0;
  if (count >= MAX_BLOCKS) {
    process.stdout.write(
      JSON.stringify({ systemMessage: `確認役の確認一覧が未完了のまま終了しました（${problems.length} 件）。窓口は未確認として扱ってください。` })
    );
    return;
  }
  writeFileSync(countFile, String(count + 1));
  const reason =
    `確認一覧が完了していません（${problems.length} 件）。残りの行を実際に操作し、result と evidence を記入してから終了してください。` +
    '最後の応答には「確認一覧: <絶対パス>」の行を必ず入れてください。\n' +
    problems.slice(0, 20).join('\n');
  process.stdout.write(JSON.stringify({ decision: 'block', reason }));
}

if (fileURLToPath(import.meta.url) === process.argv[1]) main();

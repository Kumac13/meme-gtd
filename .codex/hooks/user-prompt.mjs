#!/usr/bin/env node
// UserPromptSubmit フック: ユーザーの発言ごとに、窓口へ「発言の受け取り方」を渡す。
// Task 2107・2115 では、質問に答えずに操作を始める、「は？」を取り下げや新しい作業指示に読み替える、
// 報告の依頼で Task を起票する、といった取り違えが繰り返された。
// スキル本文は会話が長くなると参照されなくなるため、間違いが起きる時点（発言の直後）で毎回渡す。
// 標準出力は、そのターンの開発者向け文脈として追加される。サブエージェントには渡さない。
import { fileURLToPath } from 'node:url';
import { appendFileSync, readFileSync } from 'node:fs';

export const REMINDER = `[dev-flow] この発言に応える前に確かめること（.codex/skills/dev-flow/SKILL.md「発言の受け取り方」）
1. 質問・「答えろ」・「何やってる」には、最初に答える。答える前に操作しない（担当役の停止・調査・Task への記録も後）。
2. 「は？」や短い否定は、直前のあなたの出力への異議。直前の出力と元の依頼を読み直し、外した点を直して、元の依頼を続ける。取り下げ・拒否・新しい作業の指示に読み替えない。
3. 行うのは、言われたことを、言われた範囲で。頼まれた成果物（報告なら報告）以外を作らない。Task の起票は「作れ」と言われたときだけ。
4. Task とユーザーの言葉で決まっていることを聞き返さない。調査で分かることを聞かない。
5. ターンを終えてよいのは、依頼が完了したときか、スキルが定めた合意待ち（検討結果・計画）のときだけ。合意待ちでは、判断に必要な内容をこのチャットに書き、何への合意を求めているかを明記する。
6. 報告や設問を直すときは、指摘された箇所だけを直す。項目・列・件数を減らさない。`;

function main() {
  const input = JSON.parse(readFileSync(0, 'utf8'));
  if (process.env.DEV_FLOW_HOOK_LOG) appendFileSync(process.env.DEV_FLOW_HOOK_LOG, `${JSON.stringify(input)}\n`);
  if (input.agent_id) return;
  process.stdout.write(REMINDER);
}

if (fileURLToPath(import.meta.url) === process.argv[1]) main();

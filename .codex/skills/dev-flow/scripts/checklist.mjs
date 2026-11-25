#!/usr/bin/env node
// 確認一覧（JSON）の検査。確認役の完了条件で、SubagentStop フックからも呼ぶ。
// 使い方: node .codex/skills/dev-flow/scripts/checklist.mjs check <確認一覧の絶対パス>
import { fileURLToPath } from 'node:url';
import { existsSync, readFileSync } from 'node:fs';
import { isAbsolute } from 'node:path';

const SOURCES = ['e2e', 'diff', 'issue'];
const RESULTS = ['pass', 'fail', 'blocked'];

// 問題の一覧を返す。空なら全行に結果と証拠がそろっている。
export function checkChecklist(path) {
  if (!path || !isAbsolute(path)) return [`確認一覧は絶対パスで指定してください: ${path}`];
  if (!existsSync(path)) return [`確認一覧がありません: ${path}`];
  let data;
  try {
    data = JSON.parse(readFileSync(path, 'utf8'));
  } catch (error) {
    return [`確認一覧が JSON として読めません: ${error.message}`];
  }
  const rows = Array.isArray(data.rows) ? data.rows : null;
  if (!rows || rows.length === 0) return ['rows が空です。E2E シナリオ・差分・ご指摘から行を作ってください'];
  const problems = [];
  const ids = new Set();
  for (const [index, row] of rows.entries()) {
    const label = row.id ?? `${index + 1} 行目`;
    if (!row.id) problems.push(`${label}: id がありません`);
    if (ids.has(row.id)) problems.push(`${label}: id が重複しています`);
    ids.add(row.id);
    if (!SOURCES.includes(row.source)) problems.push(`${label}: source は ${SOURCES.join(' / ')} のどれかです`);
    if (!row.operation) problems.push(`${label}: operation（操作）がありません`);
    if (!row.pass) problems.push(`${label}: pass（合格条件）がありません`);
    if (!RESULTS.includes(row.result)) {
      problems.push(`${label}: result が未記入です（${RESULTS.join(' / ')}）`);
      continue;
    }
    if (row.result === 'blocked' && !row.note) problems.push(`${label}: blocked の理由を note に書いてください`);
    if (row.result !== 'blocked') {
      const evidence = Array.isArray(row.evidence) ? row.evidence : [];
      if (evidence.length === 0) problems.push(`${label}: 実操作の証拠（スクショの絶対パス）がありません`);
      for (const file of evidence) {
        if (!isAbsolute(file) || !existsSync(file)) problems.push(`${label}: 証拠のファイルがありません: ${file}`);
      }
    }
  }
  return problems;
}

function main() {
  const [command, path] = process.argv.slice(2);
  if (command !== 'check') {
    console.error('使い方: checklist.mjs check <確認一覧の絶対パス>');
    process.exit(2);
  }
  const problems = checkChecklist(path);
  if (problems.length > 0) {
    console.error(problems.join('\n'));
    process.exit(1);
  }
  const rows = JSON.parse(readFileSync(path, 'utf8')).rows;
  const count = (r) => rows.filter((row) => row.result === r).length;
  console.log(`全 ${rows.length} 行に結果があります（pass ${count('pass')} / fail ${count('fail')} / blocked ${count('blocked')}）`);
}

if (fileURLToPath(import.meta.url) === process.argv[1]) main();

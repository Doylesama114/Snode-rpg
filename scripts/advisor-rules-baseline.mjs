#!/usr/bin/env node
/**
 * 规则语料命中率基线（不调 LLM）。
 * 断言：top-3 命中块的 sheet 覆盖期望章节，且正文包含任一关键词。
 * 用法：node scripts/advisor-rules-baseline.mjs [--verbose] [--threshold 0.9]
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { searchProse, hasCorpus } from './advisor-search-prose.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const CASES = JSON.parse(fs.readFileSync(path.join(ROOT, 'advisor', 'eval', 'rules-baseline.json'), 'utf8'));
const VERBOSE = process.argv.includes('--verbose');
const ti = process.argv.indexOf('--threshold');
const THRESHOLD = ti > 0 ? Number(process.argv[ti + 1]) : 0.9;

if (!hasCorpus()) {
  console.error('FAIL 规则语料缺失，请先运行 python -X utf8 scripts/build_advisor_rules_from_help.py');
  process.exit(1);
}

const perSheet = new Map();
const misses = [];
let passed = 0;

for (const c of CASES) {
  const hits = searchProse(c.question, { limit: 3 });
  const text = hits.map((h) => (h.title || '') + ' ' + (h.body || '')).join('\n');
  const sheetOk = hits.some((h) => h.sheet === c.sheet);
  const termOk = c.terms.some((t) => text.includes(t));
  const ok = sheetOk && termOk && hits.length > 0;
  if (ok) passed += 1;
  else misses.push({ id: c.id, question: c.question, expectSheet: c.sheet, got: hits.map((h) => h.sheet + '/' + h.title), sheetOk, termOk });
  const k = c.sheet;
  if (!perSheet.has(k)) perSheet.set(k, { total: 0, pass: 0 });
  perSheet.get(k).total += 1;
  if (ok) perSheet.get(k).pass += 1;
}

const total = CASES.length;
const rate = total ? passed / total : 0;
console.log('规则语料命中率基线');
for (const [sheet, v] of perSheet) {
  console.log('  ' + sheet.padEnd(14) + v.pass + '/' + v.total);
}
console.log('SUMMARY: ' + passed + '/' + total + ' (' + (rate * 100).toFixed(1) + '%)，阈值 ' + (THRESHOLD * 100) + '%');
if (VERBOSE || rate < THRESHOLD) {
  console.log('未命中：');
  for (const m of misses) console.log('  ' + m.id + ' ' + m.question + ' | 期望 ' + m.expectSheet + ' | 实得 ' + JSON.stringify(m.got) + ' | sheet=' + m.sheetOk + ' term=' + m.termOk);
}
const dir = path.join(ROOT, 'tmp', 'eval_reports');
fs.mkdirSync(dir, { recursive: true });
const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
fs.writeFileSync(path.join(dir, 'rules-baseline-' + stamp + '.json'), JSON.stringify({ date: new Date().toISOString(), total, passed, rate, perSheet: Object.fromEntries(perSheet), misses }, null, 2));
process.exit(rate >= THRESHOLD ? 0 : 1);

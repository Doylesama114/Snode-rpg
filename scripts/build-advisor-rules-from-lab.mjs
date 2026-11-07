#!/usr/bin/env node
/**
 * 从 advisor/source/lab-20261030/ 生成规则语料：
 *   advisor/rules/chunks.jsonl   规则节 + 关键词卡（带锚点）
 *   advisor/rules/facts/*.json   等级/兼职/幕间/色彩/状态/名望/声望
 *   advisor/rules/index.json     构建元数据（版本戳 + 计数 + 锚点表）
 *
 * 用法：node scripts/build-advisor-rules-from-lab.mjs [--check]
 */
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const SRC = path.join(ROOT, 'advisor', 'source', 'lab-20261030');
const OUT = path.join(ROOT, 'advisor', 'rules');
const CHECK = process.argv.includes('--check');

const SHEET_ANCHOR = {
  '基本规则': 's0',
  '检定规则': 's1',
  '战斗规则': 's2',
  '冒险规则': 's-adventure',
  '其他规则': 's10',
};
const FACT_FILES = {
  'rule-levels.json': { out: 'levels.json', anchor: 's3', title: '升级规则' },
  'rule-multiclass.json': { out: 'multiclass.json', anchor: 's4', title: '兼职规则' },
  'rule-interludes.json': { out: 'interludes.json', anchor: 's5', title: '幕间规则' },
  'rule-marks.json': { out: 'marks.json', anchor: 's6', title: '色彩标识' },
  'rule-mark-rules.json': { out: 'mark-rules.json', anchor: 's6', title: '技能点与色彩规则' },
  'rule-states.json': { out: 'states.json', anchor: 's7', title: '异常状态' },
  'rule-renown.json': { out: 'renown.json', anchor: 's9', title: '名望' },
  'rule-reputation.json': { out: 'reputation.json', anchor: 's9', title: '声望' },
};

function readJson(name) {
  return JSON.parse(fs.readFileSync(path.join(SRC, name), 'utf8'));
}
function pkgVersion() {
  return JSON.parse(fs.readFileSync(path.join(ROOT, 'electron-app', 'package.json'), 'utf8')).version;
}
function clean(s) {
  return String(s == null ? '' : s).replace(/\r/g, '').trim();
}

const sections = readJson('rule-sections.json');
const keywords = readJson('rule-keywords.json');
const chunks = [];
const errors = [];

for (const s of sections) {
  const anchor = SHEET_ANCHOR[s.sheet];
  if (!anchor) { errors.push('未知 sheet: ' + s.sheet); continue; }
  const body = clean(s.body || (s.parts || []).join('\n'));
  if (!body) { errors.push('空正文: ' + s.sheet + '/' + s.title); continue; }
  chunks.push({
    id: 'rule:' + anchor + ':' + s.ord,
    kind: 'section',
    sheet: s.sheet,
    ord: s.ord,
    title: clean(s.title),
    body: body,
    parts: Array.isArray(s.parts) ? s.parts.map(clean) : [],
    anchor: '#' + anchor,
  });
}

for (const k of keywords) {
  const term = clean(k.term);
  const def = clean(k.definition);
  if (!term || !def) { errors.push('空关键词: ' + term); continue; }
  chunks.push({
    id: 'keyword:' + (k.category || 'x') + ':' + term,
    kind: 'keyword',
    sheet: '关键词规则',
    category: k.category || '',
    title: term,
    body: def,
    anchor: '#s8',
  });
}

// 事实表 → 检索块（状态/幕间/色彩/升级/兼职/名望/声望）
function pushFact(anchor, sheet, title, body, extra) {
  const b = clean(body);
  if (!b) return;
  chunks.push(Object.assign({
    id: 'fact:' + anchor + ':' + title,
    kind: 'fact',
    sheet: sheet,
    title: clean(title),
    body: sheet + '：' + b,
    anchor: '#' + anchor,
  }, extra || {}));
}

const states = readJson('rule-states.json');
for (const s of states) pushFact('s7', '异常状态', s.name, '[' + (s.type || '') + '] ' + (s.effect || ''));

const interludes = readJson('rule-interludes.json');
for (const it of interludes) {
  pushFact('s5', '幕间规则', it.content,
    '3 个月：' + (it.threeMonth || '-') + '；6 个月：' + (it.sixMonth || '-') + '；1 年：' + (it.oneYear || '-') + '。' + (it.note || ''));
}

const marks = readJson('rule-marks.json');
for (const m of marks) pushFact('s6', '色彩标识', m.color, (m.meaning || '') + '（关键词：' + (m.keywords || []).join('、') + '）');

const levels = readJson('rule-levels.json');
for (const lv of (levels.levels || [])) {
  pushFact('s3', '升级规则', (lv.track === 'sub' ? '子职' : '主职') + ' ' + lv.level + ' 级',
    '经验 ' + (lv.xp || '-') + '；熟练 ' + (lv.prof || '-') + '；属性 ' + (lv.attr || '-') + '；技能槽 ' + (lv.slots || '-') + '；' + (lv.other || '') + '；属性上限 ' + (lv.attrCap || '-') + '；熟练上限 ' + (lv.profCap || '-'));
}

const multiclass = readJson('rule-multiclass.json');
for (const mc of multiclass) {
  pushFact('s4', '兼职规则', mc.class,
    '属性要求：' + (mc.attrReq || '-') + '；熟练要求：' + (mc.profReq || '-') + '；其他：' + (mc.otherReq || '-') + '；可兼容：' + (mc.compat || []).join('、'));
}

const renown = readJson('rule-renown.json');
for (const rn of (renown.levels || [])) {
  pushFact('s9', '名望', rn.title, '范围 ' + (rn.range || '') + '。' + (rn.intro || '') + ' 正面：' + (rn.positive || ''));
}
const reputation = readJson('rule-reputation.json');
for (const rp of (reputation.levels || [])) {
  pushFact('s9', '声望', rp.title || rp.name || String(rp.range || ''), JSON.stringify(rp).slice(0, 600));
}

const counts = {
  sections: chunks.filter((c) => c.kind === 'section').length,
  keywords: chunks.filter((c) => c.kind === 'keyword').length,
  facts: 0,
  factChunks: 0,
};
const factsMeta = {};
for (const [file, cfg] of Object.entries(FACT_FILES)) {
  const data = readJson(file);
  factsMeta[cfg.out] = { anchor: '#' + cfg.anchor, title: cfg.title, items: Array.isArray(data) ? data.length : Object.keys(data).length };
  counts.facts += 1;
}

counts.factChunks = chunks.filter((c) => c.kind === 'fact').length;

if (errors.length) {
  console.error('数据问题 ' + errors.length + ' 项：');
  errors.slice(0, 10).forEach((e) => console.error('  - ' + e));
  process.exit(1);
}

const index = {
  buildTime: new Date().toISOString(),
  sourceVersion: pkgVersion(),
  source: 'advisor/source/lab-20261030',
  counts,
  anchors: { ...SHEET_ANCHOR, '关键词规则': 's8', facts: factsMeta },
  sourceHash: crypto.createHash('sha1')
    .update(JSON.stringify(chunks.map((c) => [c.id, c.title, c.body])))
    .digest('hex')
    .slice(0, 16),
};

if (CHECK) {
  const idxPath = path.join(OUT, 'index.json');
  if (!fs.existsSync(idxPath)) { console.error('index.json 不存在，请先构建'); process.exit(1); }
  const old = JSON.parse(fs.readFileSync(idxPath, 'utf8'));
  const same = old.sourceHash === index.sourceHash && old.counts.sections === counts.sections && old.counts.keywords === counts.keywords;
  console.log(same ? 'OK 规则语料与源一致（' + counts.sections + ' 节 + ' + counts.keywords + ' 关键词）' : 'FAIL 规则语料过期，请重新构建');
  process.exit(same ? 0 : 1);
}

fs.mkdirSync(path.join(OUT, 'facts'), { recursive: true });
fs.writeFileSync(path.join(OUT, 'chunks.jsonl'), chunks.map((c) => JSON.stringify(c)).join('\n') + '\n', 'utf8');
for (const [file, cfg] of Object.entries(FACT_FILES)) {
  const data = readJson(file);
  fs.writeFileSync(path.join(OUT, 'facts', cfg.out), JSON.stringify(data, null, 2) + '\n', 'utf8');
}
fs.writeFileSync(path.join(OUT, 'index.json'), JSON.stringify(index, null, 2) + '\n', 'utf8');
console.log('规则语料已生成: ' + counts.sections + ' 节 + ' + counts.keywords + ' 关键词 + ' + counts.facts + ' 个事实表');
console.log('锚点: ' + JSON.stringify(index.anchors));

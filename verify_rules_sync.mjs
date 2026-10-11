import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const XLSX = require('xlsx');
/** 基本规则同步校验：xlsx ↔ help.html #s0 ↔ advisor-tips.js rules；另 11 张表建立基线；无旧文案残留 */
const ROOT = process.cwd();
const XLSX_PATH = path.join(ROOT, '冒险者基础规则.xlsx');
const HELP = path.join(ROOT, '斯诺德跑团', 'help.html');
const TIPS = path.join(ROOT, '斯诺德跑团', 'advisor-tips.js');
let pass = 0, fail = 0;
const ok = (n, c, extra) => { if (c) { pass++; console.log('  PASS ' + n + (extra ? '  ' + extra : '')); } else { fail++; console.log('  FAIL ' + n + (extra ? '  ' + extra : '')); } };
const norm = (s) => String(s == null ? '' : s).replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/\s+/g, ' ').trim();
for (const p of [XLSX_PATH, HELP, TIPS]) if (!fs.existsSync(p)) { console.log('  FAIL 缺少文件 ' + path.relative(ROOT, p)); process.exit(1); }
const wb = XLSX.read(fs.readFileSync(XLSX_PATH), { type: 'buffer' });
const help = fs.readFileSync(HELP, 'utf8');
const tips = fs.readFileSync(TIPS, 'utf8');
/* ---- 从 xlsx「基本规则」抽取规范条目（标题 = 数字开头短句，正文 = 同一列下一行） ---- */
const ws = wb.Sheets['基本规则'];
const cell = {};
for (const k of Object.keys(ws)) {
  if (k.startsWith('!')) continue;
  const v = ws[k] && ws[k].v;
  if (v == null || String(v).trim() === '') continue;
  const m = k.match(/^([A-Z]+)([0-9]+)$/); if (!m) continue;
  const col = m[1], row = parseInt(m[2], 10);
  cell[col + '|' + row] = String(v).trim();
}
const rect = XLSX.utils.decode_range(ws['!ref'] || 'A1');
const colName = (n) => XLSX.utils.encode_col(n);
const items = [];
for (let r = rect.s.r; r <= rect.e.r + 1; r++) {
  for (let c = rect.s.c; c <= rect.e.c; c++) {
    const cn = colName(c);
    const v = cell[cn + '|' + (r + 1)];
    if (!v) continue;
    const m = v.match(/^([0-9]{1,2})\s*[.、]\s*(.+)$/);
    if (m && v.length <= 40) items.push({ no: parseInt(m[1], 10), title: m[2].trim(), body: cell[cn + '|' + (r + 2)] || '' });
  }
}
items.sort((a, b) => a.no - b.no);
ok('xlsx 规范条目可解析', items.length >= 12, items.length + ' 条');
/* ---- ① 三方一致性 ---- */
const s0 = help.indexOf('<div class="section" id="s0">');
const s1 = help.indexOf('<div class="section" id="s1">');
const seg = s0 >= 0 && s1 > s0 ? help.slice(s0, s1) : '';
const cards = Array.from(seg.matchAll(/<div class="num">([\s\S]*?)<\/div>\s*<div class="desc">([\s\S]*?)<\/div>/g))
  .map((m) => ({ title: norm(m[1]).replace(/^[0-9]+[.]/, '').trim(), body: norm(m[2]) }));
ok('help.html #s0 卡片数 = xlsx 条目数', cards.length === items.length, cards.length + ' / ' + items.length);
let mism = [];
items.forEach((it, i) => {
  const c = cards[i];
  if (!c) { mism.push('#' + it.no + ' 缺卡'); return; }
  if (norm(c.title) !== norm(it.title)) mism.push('#' + it.no + ' 标题: 页面「' + c.title + '」≠ 表「' + it.title + '」');
  if (norm(c.body) !== norm(it.body)) mism.push('#' + it.no + ' 正文不一致');
});
ok('help.html #s0 与 xlsx 逐条一致', mism.length === 0, mism.slice(0, 4).join(' ; '));
const arrM = tips.match(/"rules"\s*:\s*\[([\s\S]*?)\n\s*\]/);
let rules = [];
if (arrM) { try { rules = JSON.parse('[' + arrM[1].replace(/,\s*$/, '') + ']'); } catch (e) { rules = []; } }
ok('advisor-tips.js rules 条数 = xlsx 条目数', rules.length === items.length, rules.length + ' / ' + items.length);
let am = [];
items.forEach((it, i) => { if (norm(rules[i]) !== norm(it.body)) am.push('#' + it.no); });
ok('advisor-tips.js rules 与 xlsx 逐条一致', am.length === 0, am.slice(0, 5).join(','));
/* ---- ② 其余 10 张表基线：表与对应 section 必须存在；逐格差异仅作提示 ---- */
const sheetToSection = { '检定规则': 's1', '战斗规则': 's2', '升级规则': 's3', '兼职规则': 's4', '幕间规则': 's5', '技能点和色彩标识规则': 's6', '异常状态规则': 's7', '关键词规则': 's8', '名望等级和声望规则': 's9', '其他规则': 's10' };
const stripTags = (s) => String(s).replace(/<script[\s\S]*?<\/script>/g, ' ').replace(/<style[\s\S]*?<\/style>/g, ' ').replace(/<[^>]+>/g, ' ');
const helpNorm = norm(stripTags(help));
const missSheets = [], missSections = [];
let cellMiss = 0;
for (const name in sheetToSection) {
  const w = wb.Sheets[name];
  if (!w) { missSheets.push(name); continue; }
  if (help.indexOf('id="' + sheetToSection[name] + '"') < 0) missSections.push(name + '→#' + sheetToSection[name]);
  for (const k of Object.keys(w)) {
    if (k.startsWith('!')) continue;
    const val = w[k] && w[k].v; if (val == null) continue;
    const s = norm(val);
    if (s.length < 20 || /^[0-9.、\s]+$/.test(s)) continue;
    if (helpNorm.indexOf(s) < 0) cellMiss++;
  }
}
ok('其余 10 张表在 xlsx 中齐全', missSheets.length === 0, missSheets.join(','));
ok('对应 section 在 help.html 中存在', missSections.length === 0, missSections.join(','));
console.log((cellMiss === 0 ? '  PASS ' : '  WARN ') + '其余 10 张表逐格文本命中 help.html（未命中 ' + cellMiss + ' 处，仅提示不判失败）');
if (cellMiss === 0) pass++;
/* ---- ③ 无旧文案残留 ---- */
const OLD = ['这不是D&D', '了解这里的风土人情', '说，你要干嘛', '没有什么是理所当然的', '摆烂不救', '假如...？'];
const leftovers = [];
for (const s of OLD) {
  const n = norm(s);
  if (norm(help).indexOf(n) >= 0) leftovers.push('help.html:' + s);
  if (norm(tips).indexOf(n) >= 0) leftovers.push('advisor-tips.js:' + s);
  const MA = path.join(ROOT, 'scripts', 'mage-advisor.mjs');
  if (fs.existsSync(MA) && norm(fs.readFileSync(MA, 'utf8')).indexOf(n) >= 0) leftovers.push('mage-advisor.mjs:' + s);
}
ok('无旧文案残留', leftovers.length === 0, leftovers.slice(0, 5).join(' ; '));
console.log('');
console.log('基本规则同步校验: ' + pass + 'P ' + fail + 'F');
process.exit(fail === 0 ? 0 : 1);

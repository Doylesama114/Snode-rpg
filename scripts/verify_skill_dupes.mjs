// 同名技能冲突校验（发版检查）：扫描 SKILL_DATA 跨职业同名技能，标记同名不同效果
// 用法: node scripts/verify_skill_dupes.mjs
import fs from 'node:fs';
import vm from 'node:vm';

const SRC = '斯诺德跑团/panel_data.js';
const js = fs.readFileSync(SRC, 'utf8');
const ctx = { document: { title: '' }, window: {}, console };
vm.createContext(ctx);
try { vm.runInContext(js, ctx); } catch (e) { console.error('panel_data.js 执行失败:', e.message); process.exit(1); }
const SKILL_DATA = ctx.SKILL_DATA;
if (!SKILL_DATA) { console.error('未找到 SKILL_DATA'); process.exit(1); }

function skillFingerprint(s) {
  const f = s.fields || {};
  return JSON.stringify([
    f['描述'] || (s.description || []).join(' '),
    f['前置条件'] || '',
    f['关键词'] || '',
    (s.cost || []).map(c => c.name + c.count).join(','),
    (s.level_upgrades || []).map(u => u.text).join('|')
  ]);
}

const byName = {};
const domainNames = {};
for (const cls in SKILL_DATA) {
  const arr = SKILL_DATA[cls] || [];
  for (const s of arr) {
    if (!s.name) continue;
    if (!byName[s.name]) byName[s.name] = [];
    if (cls === '牧师·神圣领域') { domainNames[s.name] = (domainNames[s.name] || 0) + 1; continue; }   // 神圣领域为独立数据源，不参与跨职业异常计数
    byName[s.name].push({ cls, fp: skillFingerprint(s), type: s.type || '' });
  }
}

const dupeGroups = Object.entries(byName).filter(([, v]) => v.length > 1);
const diffGroups = dupeGroups.filter(([, v]) => new Set(v.map(x => x.fp)).size > 1);

console.log('同名技能总数: ' + dupeGroups.length + ' 组');
console.log('同名不同效果: ' + diffGroups.length + ' 组');

// 同职业内重名（数据重复嫌疑）
const sameClsDupes = [];
for (const cls in SKILL_DATA) {
  const seen = {};
  for (const s2 of SKILL_DATA[cls] || []) {
    if (!s2.name) continue;
    if (seen[s2.name]) sameClsDupes.push(cls + '/' + s2.name);
    seen[s2.name] = true;
  }
}
if (sameClsDupes.length) {
  console.log('\n⚠ 同职业内重名（疑似数据重复）: ' + sameClsDupes.length + ' 处');
  for (const d of sameClsDupes) console.log('  ' + d);
} else {
  console.log('同职业内重名: 0（数据无重复）');
}
if (diffGroups.length) {
  console.log('\n=== 同名不同效果清单（人工核对） ===');
  for (const [nm, list] of diffGroups.sort()) {
    const detail = list.map(x => x.cls + (x.type === 'starting' ? '(起始)' : '')).join(' vs ');
    console.log('  ' + nm + ': ' + detail);
  }
}
console.log('\n【神圣领域】与职业技能重名（独立数据源，各神域自有文本，不计入异常）：' + Object.keys(domainNames).length + ' 个名称');
// 白名单：跨职业同名不同效果属规则设计（各职业自有文本）。以基线文件为准，
// 只有「基线之外新出现的同名组」才判失败，避免每次新增内容都要调阈值。
const keyOf = (nm, list) => nm + '|' + list.map(x => x.cls).sort().join(',');
const BASELINE_FILE = 'scripts/skill_dupes_baseline.json';
let baseline = new Set();
try {
  baseline = new Set(JSON.parse(fs.readFileSync(BASELINE_FILE, 'utf8')).allowed || []);
} catch (e) {
  console.log('\n（未找到基线文件，将以本次结果作为基线写入）');
}
if (process.argv.includes('--write-baseline')) {
  fs.writeFileSync(BASELINE_FILE, JSON.stringify({
    updated: new Date().toISOString(),
    note: '跨职业同名不同效果白名单：各职业自有文本，按 名称|职业列表 记录',
    allowed: diffGroups.map(([nm, list]) => keyOf(nm, list)).sort(),
  }, null, 1));
  console.log('已写入基线 ' + diffGroups.length + ' 组 → ' + BASELINE_FILE);
  process.exit(0);
}
const newGroups = diffGroups.filter(([nm, list]) => !baseline.has(keyOf(nm, list)));
if (newGroups.length) {
  console.error('\nFAIL: 出现 ' + newGroups.length + ' 组基线之外的同名不同效果，请核对：');
  for (const [nm, list] of newGroups.slice(0, 40)) console.error('  ' + nm + ': ' + list.map(x => x.cls).join(' vs '));
  process.exit(1);
}
console.log('\nOK: 同名冲突全部在白名单内（' + diffGroups.length + ' 组，基线 ' + baseline.size + ' 组）');
process.exit(0);

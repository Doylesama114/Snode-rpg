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
for (const cls in SKILL_DATA) {
  const arr = SKILL_DATA[cls] || [];
  for (const s of arr) {
    if (!s.name) continue;
    if (!byName[s.name]) byName[s.name] = [];
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
const WARN_LIMIT = 120; // 89 组为正常跨职业同名不同效果（规则设计）
if (diffGroups.length > WARN_LIMIT) {
  console.error('FAIL: 同名不同效果组数异常（>' + WARN_LIMIT + '），请核查 docx 数据');
  process.exit(1);
}
console.log('\nOK: 同名冲突在预期范围内（上限 ' + WARN_LIMIT + '）');
process.exit(0);

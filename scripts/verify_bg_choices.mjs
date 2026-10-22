// 校验：背景特殊选择（罪名/隐居原因/专职/造访原因/动物伙伴/神祇简介/骗局装备/学术领域）
// 数据来自 个性与背景创建规则.xlsx；本脚本检查数据字段与导出文案（U27）是否完整。
// 用法: node scripts/verify_bg_choices.mjs
import fs from 'node:fs';

const errors = [];
const ok = [];

// —— 数据层 ——
const dataSrc = fs.readFileSync('职业页/数据/bg_personality_data.js', 'utf8');
const BG_PERSONALITY = new Function(dataSrc + '; return BG_PERSONALITY;')();

const expect = {
  '侍僧': ['deity_details', 11],
  '骗子': ['scam_details', 6],
  '恶棍': ['crime_details', 6],
  '乐师': ['fame_tiers', 3],
  '艺人': ['fame_tiers', 3],
  '驯兽师': ['companions', 8],
  '隐士': ['seclusion_reasons', 8],
  '士兵': ['military_roles', 8],
  '外乡人': ['foreign_origins', 6],
  '教授': ['academic_details', 6],
};
for (const [name, [field, count]] of Object.entries(expect)) {
  const arr = (BG_PERSONALITY[name] || {})[field];
  if (!Array.isArray(arr)) errors.push(`${name}: 缺少字段 ${field}`);
  else if (arr.length !== count) errors.push(`${name}.${field}: 期望 ${count} 条，实际 ${arr.length} 条`);
  else ok.push(`${name}.${field} = ${count}`);
}
// 特殊段落的附加列不能丢
const detailChecks = [
  ['侍僧', 'deity_details', 'desc'],
  ['骗子', 'scam_details', 'gear'],
  ['恶棍', 'crime_details', 'contact'],
  ['士兵', 'military_roles', 'prof'],
  ['士兵', 'military_roles', 'gear'],
  ['外乡人', 'foreign_origins', 'desc'],
  ['教授', 'academic_details', 'prof'],
  ['教授', 'academic_details', 'gear'],
  ['乐师', 'fame_tiers', 'bonus'],
];
for (const [bg, field, key] of detailChecks) {
  const arr = (BG_PERSONALITY[bg] || {})[field] || [];
  if (!arr.length || !arr.every(x => x[key])) errors.push(`${bg}.${field}[].${key} 存在空值`);
  else ok.push(`${bg}.${field}[].${key} 完整`);
}

// —— 个性四类色彩标识（26.10.22） ——
const MARK_HEX = new Set(['#FFFFFF', '#595959', '#FFFF00', '#FFC000', '#FFB7E3', '#FF0000',
  '#00FA99', '#AC6520', '#D2B7FF', '#F79646', '#00B0F0', '#00B050', '#B3F9FF']);
const CATS = ['traits', 'ideals', 'bonds', 'flaws'];
let colorTotal = 0;
const colorHist = {};
for (const [name, bg] of Object.entries(BG_PERSONALITY)) {
  const colors = bg && bg.colors;
  if (!colors) { errors.push(name + ': 缺少 colors 字段'); continue; }
  for (const f of CATS) {
    const texts = bg[f] || [];
    const arr = colors[f] || [];
    if (arr.length !== texts.length) {
      errors.push(name + '.colors.' + f + ': 颜色 ' + arr.length + ' 项 ≠ 文本 ' + texts.length + ' 项');
    }
    const bad = [...new Set(arr.filter(h => !MARK_HEX.has(String(h).toUpperCase())))];
    if (bad.length) errors.push(name + '.colors.' + f + ': 非法色值 ' + bad.join(','));
    for (const h of arr) { const k = String(h).toUpperCase(); colorHist[k] = (colorHist[k] || 0) + 1; }
    colorTotal += arr.length;
  }
}
if (colorTotal !== 1092) errors.push('色彩标识总数 ' + colorTotal + '，期望 1092（42 背景 × 26 项）');
else ok.push('色彩标识共 1092 项（42 背景 × 26 项）');
// 聚合抽样：白色含"无填充按白"的 2 格；金色孤例归黄
const histWant = { '#FFFFFF': 138, '#595959': 136, '#FFC000': 1, '#B3F9FF': 34 };
for (const [hex, n] of Object.entries(histWant)) {
  if ((colorHist[hex] || 0) !== n) errors.push(hex + ' 期望 ' + n + ' 项，实际 ' + (colorHist[hex] || 0));
}
// 定点抽样
const colorSamples = [
  ['侍僧', 'traits', 0, '#FFFF00'],
  ['侍僧', 'traits', 2, '#FFFFFF'],
  ['雇佣兵', 'traits', 0, '#FF0000'],
  ['雇佣兵', 'traits', 3, '#FFC000'],
  ['医者', 'ideals', 5, '#FFFFFF'],
  ['小丑', 'flaws', 5, '#FFFFFF'],
  ['隐士', 'traits', 1, '#FFFFFF'],
];
for (const [bg, f, i, hex] of colorSamples) {
  const got = ((BG_PERSONALITY[bg] || {}).colors || {})[f] || [];
  if (String(got[i] || '').toUpperCase() !== hex) {
    errors.push(bg + '.colors.' + f + '[' + i + '] 期望 ' + hex + '，实际 ' + (got[i] || '(无)'));
  } else {
    ok.push(bg + '.' + f + '[' + i + '] = ' + hex);
  }
}

// —— 导出文案（从 panel_engine.js 抽取函数，避免加载整页） ——
const engine = fs.readFileSync('斯诺德跑团/panel_engine.js', 'utf8');
const start = engine.indexOf('function exportBackgroundChoiceText(state) {');
const end = engine.indexOf('function exportBackgroundExtraText(state) {');
if (start < 0 || end < 0) errors.push('panel_engine.js 中未找到背景选择导出函数');
const snippet = engine.slice(start, end);
const exportBackgroundChoiceText = new Function('BG_PERSONALITY', snippet + '; return exportBackgroundChoiceText;')(BG_PERSONALITY);

const cases = [
  ['侍僧', { deity: '公正与荣耀之神' }, ['神祇：公正与荣耀之神']],
  ['骗子', { scamType: '我在博弈游戏中作弊。' }, ['偏好骗局：我在博弈游戏中作弊。', '装备：一套作弊骰子和暗号纸牌']],
  ['恶棍', { crime: '敲诈' }, ['罪名：敲诈', '接头人：']],
  ['隐士', { seclusion: '我正在寻求灵魂的启迪。' }, ['隐居原因：我正在寻求灵魂的启迪。']],
  ['士兵', { militaryRole: '军官' }, ['专职：军官', '熟练度加成：说服', '额外装备：一枚镶金怀表']],
  ['外乡人', { foreignOrigin: '游客' }, ['造访原因：游客', '额外获得50金币的起始资金']],
  ['教授', { academicDomain: '医学' }, ['学术领域：医学', '熟练度加成：医药', '额外装备：一份绷带、酒精和医疗包']],
  ['驯兽师', { companion: '一只灵巧的猫咪' }, ['动物伙伴：一只灵巧的猫咪']],
  ['侦探', { contacts: '一名友好的执法人员' }, ['联系渠道：一名友好的执法人员']],
];
for (const [bg, bc, wants] of cases) {
  const text = exportBackgroundChoiceText({ background: bg, backgroundChoices: bc });
  for (const w of wants) {
    if (!text.includes(w)) errors.push(`${bg} 导出文案缺少「${w}」→ 实际: ${text || '(空)'}`);
  }
  if (text) ok.push(`${bg} 导出: ${text.slice(0, 46)}${text.length > 46 ? '…' : ''}`);
}

console.log(ok.map(x => '  ✓ ' + x).join('\n'));
if (errors.length) {
  console.log('\nFAIL: 背景选择数据/导出校验失败');
  errors.forEach(e => console.log('  - ' + e));
  process.exit(1);
}
console.log('\nOK: 背景特殊选择数据与导出文案完整（' + ok.length + ' 项）');

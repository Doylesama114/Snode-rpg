import fs from 'node:fs';
import vm from 'node:vm';
const SRC = '斯诺德跑团/panel_data.js';
const OUT = '职业页/hp_calc_data.js';
const src = fs.readFileSync(SRC, 'utf8');
let REF_CLASSES = null, REF_RACES = null, REF_BACKGROUNDS = null;
const notes = [];
try {
  const ctx = { console, JSON, Math, Number, String, Object, Array, Boolean, Date, RegExp, parseInt, parseFloat, isNaN };
  vm.createContext(ctx);
  vm.runInContext(src, ctx, { timeout: 60000 });
  const rd = (name) => { try { const v = vm.runInContext('typeof ' + name + ' !== "undefined" ? JSON.stringify(' + name + ') : null', ctx); return v ? JSON.parse(v) : null; } catch (e) { return null; } };
  REF_CLASSES = rd('REF_CLASSES'); REF_RACES = rd('REF_RACES'); REF_BACKGROUNDS = rd('REF_BACKGROUNDS');
  notes.push('vm 裸上下文（内部求值读取）');
} catch (e) { notes.push('vm 失败: ' + String(e.message).slice(0, 70)); }
function grab(name) {
  const i = src.indexOf(name);
  if (i < 0) return null;
  const seg = src.slice(i, i + 5000000);
  const re = new RegExp(name + '\\s*=\\s*JSON\\.parse\\((\"(?:[^\"\\\\]|\\\\.)*\")\\)');
  const m = seg.match(re);
  if (!m) return null;
  try { return JSON.parse(JSON.parse(m[1])); } catch (e) { return null; }
}
if (!REF_CLASSES) { REF_CLASSES = grab('REF_CLASSES'); notes.push('REF_CLASSES 走正则'); }
if (!REF_RACES) { REF_RACES = grab('REF_RACES'); notes.push('REF_RACES 走正则'); }
if (!REF_BACKGROUNDS) { REF_BACKGROUNDS = grab('REF_BACKGROUNDS'); notes.push('REF_BACKGROUNDS 走正则'); }
console.log('抽取方式: ' + notes.join(' | '));
console.log('职业 ' + (REF_CLASSES ? Object.keys(REF_CLASSES).length : 'X') + ' · 种族 ' + (REF_RACES ? Object.keys(REF_RACES).length : 'X') + ' · 背景 ' + (REF_BACKGROUNDS ? Object.keys(REF_BACKGROUNDS).length : 'X'));
if (REF_CLASSES) { const k = Object.keys(REF_CLASSES)[0]; const c = REF_CLASSES[k]; console.log('样例职业 ' + k + ' → hp=' + JSON.stringify(c.hp_formula) + ' fp=' + JSON.stringify(c.fp_formula) + ' keyAttr=' + c.keyAttr); }
if (REF_RACES) { const k = Object.keys(REF_RACES)[0]; const r = REF_RACES[k]; console.log('样例种族 ' + k + ' → hp_bonus=' + JSON.stringify(r.hp_bonus) + ' fp_bonus=' + JSON.stringify(r.fp_bonus) + ' size=' + r.size); }
if (!(REF_CLASSES && REF_RACES && REF_BACKGROUNDS)) { console.log('数据不完整，未生成'); process.exit(1); }
const classes = {};
Object.keys(REF_CLASSES).forEach(k => {
  const c = REF_CLASSES[k];
  if (!c || !c.hp_formula || !c.fp_formula) return;
  classes[k] = { name: c.name || k, keyAttrRaw: c.key_attr || c.keyAttr || '', hp: { first: Number(c.hp_formula.first) || 0, up: Number(c.hp_formula.level_up) || 0 }, fp: { first: Number(c.fp_formula.first) || 0, up: Number(c.fp_formula.level_up) || 0 } };
});
const races = {};
Object.keys(REF_RACES).forEach(k => {
  const r = REF_RACES[k];
  races[k] = { name: r.name || k, hp_bonus: r.hp_bonus === undefined ? 0 : r.hp_bonus, fp_bonus: Number(r.fp_bonus) || 0, size: r.size || '' };
});
const bgs = {};
Object.keys(REF_BACKGROUNDS).forEach(k => {
  const b = REF_BACKGROUNDS[k];
  if (b) bgs[k] = { name: b.name || k, hp_bonus: Number(b.hp_bonus) || 0 };
});
const L = [];
L.push('/* 由 scripts/gen_hp_calc_data.mjs 从 斯诺德跑团/panel_data.js 抽取生成，请勿手改。 */');
L.push('/* 字段与 panel_data.js 同名，以便职业页直接复用 character_stats.js 的 totalHP / totalFP */');
L.push('/* 结构精简为计算器所需：hp/fp = {first, up}；种族含 hp_bonus/fp_bonus/size */');
L.push('var SNOWD_HP_SRC = {');
L.push('  classes: ' + JSON.stringify(classes) + ',');
L.push('  races: ' + JSON.stringify(races) + ',');
L.push('  backgrounds: ' + JSON.stringify(bgs) + ',');
L.push('  /* 特殊专长（如「健壮」）只能在 4 / 8 / 13 级获得，且只影响选择之后的等级 —— 来源：冒险者基础规则.xlsx「升级规则」表第 4/8/13 行「获取一项特殊专长」 */');
L.push('  toughPickLevels: [4, 8, 13]');
L.push('};');
L.push('/* 还原成 character_stats.js 期望的全局名（仅暴露计算所需字段） */');
L.push('var REF_CLASSES = {};');
L.push('var REF_RACES = {};');
L.push('var REF_BACKGROUNDS = {};');
L.push('(function(){');
L.push('  Object.keys(SNOWD_HP_SRC.classes).forEach(function(k){ var c = SNOWD_HP_SRC.classes[k];');
L.push('    REF_CLASSES[k] = { name: c.name, keyAttrRaw: c.keyAttrRaw, hp_formula: { first: c.hp.first, level_up: c.hp.up }, fp_formula: { first: c.fp.first, level_up: c.fp.up } }; });');
L.push('  Object.keys(SNOWD_HP_SRC.races).forEach(function(k){ var r = SNOWD_HP_SRC.races[k];');
L.push('    REF_RACES[k] = { name: r.name, hp_bonus: r.hp_bonus, fp_bonus: r.fp_bonus, size: r.size }; });');
L.push('  Object.keys(SNOWD_HP_SRC.backgrounds).forEach(function(k){ var b = SNOWD_HP_SRC.backgrounds[k];');
L.push('    REF_BACKGROUNDS[k] = { name: b.name, hp_bonus: b.hp_bonus }; });');
L.push('})();');
L.push('');
fs.writeFileSync(OUT, L.join('\n'), 'utf8');
console.log('');
console.log('生成 ' + OUT + ' · ' + Math.round(fs.statSync(OUT).size / 1024) + ' KB · ' + Object.keys(classes).length + ' 职业 / ' + Object.keys(races).length + ' 种族 / ' + Object.keys(bgs).length + ' 个个性背景（含血量加成的照实标注）');
console.log('战舞者: ' + JSON.stringify(classes['战舞者']));
console.log('人类: ' + JSON.stringify(races['人类']));

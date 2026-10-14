import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';
const ROOT = process.cwd();
const PAGE_DIR = path.join(ROOT, '职业页');
const DATA = path.join(PAGE_DIR, 'hp_calc_data.js');
let pass = 0, fail = 0;
const ok = (n, c, x) => { if (c) { pass++; console.log('  PASS ' + n + (x ? '  ' + x : '')); } else { fail++; console.log('  FAIL ' + n + (x ? '  ' + x : '')); } };
/* 数据与 panel_data.js 零差异 */
import { spawnSync } from 'node:child_process';
const tmp = path.join(ROOT, '_scratch', 'hp_calc_data.regen.js');
const gen = spawnSync('node', ['scripts/gen_hp_calc_data.mjs'], { encoding: 'utf8', cwd: ROOT });
ok('生成脚本可运行', gen.status === 0, (gen.stderr || '').slice(0, 60));
const cur = fs.readFileSync(DATA, 'utf8');
ok('数据文件与重新生成结果零差异', cur === fs.readFileSync(DATA, 'utf8'), '');
const dataSrc = fs.readFileSync(DATA, 'utf8');
const cj = dataSrc.match(/classes: (\{.*?\}),\n  races:/s);
const classes = JSON.parse(cj[1]);
const names = Object.keys(classes);
ok('职业数 = 18', names.length === 18, names.length + ' 个');
/* 浏览器：逐页验证 + 与面板比对 */
const b = await chromium.launch({ headless: true });
const panel = await b.newPage({ viewport: { width: 1440, height: 900 } });
await panel.goto('file:///' + ROOT.replace(/\\/g, '/') + '/' + encodeURI('斯诺德跑团/角色面板.html') + '?v=' + Date.now(), { waitUntil: 'load' });
await panel.waitForTimeout(2500);
const INPUT = { lv: 5, con: 14, kv: 16, race: '高等精灵' };
const truth = await panel.evaluate(({ names, INPUT }) => {
  const S = window.SNOWD_CHARACTER_STATS;
  const out = {};
  names.forEach(n => { out[n] = { hp: S.totalHP(n, INPUT.lv, '', 0, INPUT.con, INPUT.race, '', 0, ''), fp: S.totalFP(n, INPUT.lv, '', 0, INPUT.kv, INPUT.kv, INPUT.race, 0) }; });
  return out;
}, { names, INPUT });
await panel.close();
let pageOk = 0, pageBad = [];
for (const name of names) {
  const file = path.join(PAGE_DIR, name + '.html');
  if (!fs.existsSync(file)) { pageBad.push(name + '(缺页)'); continue; }
  const p = await b.newPage({ viewport: { width: 1440, height: 950 } });
  const errs = []; p.on('pageerror', e => errs.push(String(e.message).slice(0, 50)));
  await p.goto('file:///' + ROOT.replace(/\\/g, '/') + '/' + encodeURI('职业页/' + name + '.html') + '?v=' + Date.now(), { waitUntil: 'load' });
  await p.waitForTimeout(1600);
  const r = await p.evaluate((INPUT) => {
    const $ = (i) => document.getElementById(i);
    const mount = document.querySelector('.hpcalc');
    const lv = $('hpLevel');
    if (!mount || !lv) return { err: 'no calc' };
    lv.value = INPUT.lv; lv.dispatchEvent(new Event('input'));
    $('hpCon').value = INPUT.con; $('hpCon').dispatchEvent(new Event('input'));
    $('hpKeyVal').value = INPUT.kv; $('hpKeyVal').dispatchEvent(new Event('input'));
    $('hpRace').value = INPUT.race; $('hpRace').dispatchEvent(new Event('change'));
    const cards = document.querySelectorAll('#hpOut .hpcalc-card .hpcalc-v');
    const cells = document.querySelectorAll('#hpTable tbody td.mc-x');
    const groups = new Set(Array.from(document.querySelectorAll('#hpTable td.mc-lv')).map(t => (t.className.match(/mc-g[0-3]/) || [''])[0]));
    const de = document.documentElement;
    return { hp: Number((cards[0] || {}).textContent), fp: Number((cards[1] || {}).textContent), cells: cells.length, groups: groups.size,
      nav: !!document.querySelector('a[href$="-hpcalc"]'), overflow: de.scrollWidth > innerWidth + 1 };
  }, INPUT);
  const t = truth[name];
  const good = !r.err && r.hp === t.hp && r.fp === t.fp && r.cells === 60 && r.groups >= 1 && r.nav && !r.overflow && errs.length === 0;
  if (good) { pageOk++; console.log('  OK   ' + name.padEnd(5) + ' 计算器 ' + r.hp + '/' + r.fp + ' = 面板 ' + t.hp + '/' + t.fp + ' · 格 ' + r.cells + ' · 配色组 ' + r.groups + ' · 导航 ' + r.nav); }
  else { pageBad.push(name + ' ' + JSON.stringify({ err: r.err, hp: r.hp, fp: r.fp, want: t, cells: r.cells, groups: r.groups, nav: r.nav, overflow: r.overflow, jsErr: errs.length })); console.log('  FAIL ' + name + ' ' + JSON.stringify(r) + ' want ' + JSON.stringify(t)); }
  await p.close();
}
await b.close();
/* 健壮分级生效（方案A：只影响选择之后的等级）—— 注意：此项刻意不与面板比对（面板为旧算法，见待办B） */
const toughLevels = (JSON.parse(fs.readFileSync(DATA, 'utf8').match(/toughPickLevels: (\[[^\]]*\])/)[1]));
ok('toughPickLevels = [4,8,13]', JSON.stringify(toughLevels) === '[4,8,13]', JSON.stringify(toughLevels));
{
  const b2 = await chromium.launch({ headless: true });
  const p2 = await b2.newPage({ viewport: { width: 1440, height: 950 } });
  const e2 = []; p2.on('pageerror', e => e2.push(String(e.message).slice(0, 50)));
  await p2.goto('file:///' + ROOT.replace(/\\/g, '/') + '/' + encodeURI('职业页/战舞者.html') + '?v=' + Date.now(), { waitUntil: 'load' });
  await p2.waitForTimeout(1800);
  const res = await p2.evaluate(() => {
    const $ = (i) => document.getElementById(i);
    const hp = () => Number(document.querySelectorAll('#hpOut .hpcalc-card .hpcalc-v')[0].textContent);
    const setLv = (n) => { $('hpLevel').value = n; $('hpLevel').dispatchEvent(new Event('input')); };
    const out = {};
    /* 未勾选基准 */
    const fp = () => Number(document.querySelectorAll('#hpOut .hpcalc-card .hpcalc-v')[1].textContent);
    out.off = {}; out.fpOff = {}; [3, 4, 5, 13, 20].forEach(n => { setLv(n); out.off[n] = hp(); out.fpOff[n] = fp(); });
    /* 勾选 + 选 4 级 */
    $('hpTough').checked = true; $('hpTough').dispatchEvent(new Event('change'));
    $('hpToughLv').value = '4'; $('hpToughLv').dispatchEvent(new Event('change'));
    setLv(20); out.fpOn20 = fp(); setLv(4);
    out.L4 = {}; [3, 4, 5, 20].forEach(n => { setLv(n); out.L4[n] = hp(); });
    /* 选 8 级 */
    $('hpToughLv').value = '8'; $('hpToughLv').dispatchEvent(new Event('change'));
    out.L8 = {}; [20].forEach(n => { setLv(n); out.L8[n] = hp(); });
    /* 选 13 级 */
    $('hpToughLv').value = '13'; $('hpToughLv').dispatchEvent(new Event('change'));
    out.L13 = {}; [13, 20].forEach(n => { setLv(n); out.L13[n] = hp(); });
    /* 取消勾选但选择等级仍是 13 → 应与未勾选一致 */
    $('hpTough').checked = false; $('hpTough').dispatchEvent(new Event('change'));
    out.offAgain = {}; [20].forEach(n => { setLv(n); out.offAgain[n] = hp(); });
    out.wrapHidden = getComputedStyle($('hpToughLvWrap')).display === 'none';
    return out;
  });
  await b2.close();
  const b = res.off;
  res.fpSame = res.fpOff[20] === res.fpOn20;
  ok('健壮 L=4 · N=3（早于选择）→ 与不勾一致', res.L4[3] === b[3], res.L4[3] + ' vs ' + b[3]);
  ok('健壮 L=4 · N=4 → +2', res.L4[4] === b[4] + 2, res.L4[4] + ' vs ' + (b[4] + 2));
  ok('健壮 L=4 · N=5 → +4', res.L4[5] === b[5] + 4, res.L4[5] + ' vs ' + (b[5] + 4));
  ok('健壮 L=4 · N=20 → +34（旧算法会 +40）', res.L4[20] === b[20] + 34, res.L4[20] + ' vs ' + (b[20] + 34));
  ok('健壮 L=8 · N=20 → +26', res.L8[20] === b[20] + 26, res.L8[20] + ' vs ' + (b[20] + 26));
  ok('健壮 L=13 · N=13 → +2', res.L13[13] === b[13] + 2, res.L13[13] + ' vs ' + (b[13] + 2));
  ok('健壮 L=13 · N=20 → +16', res.L13[20] === b[20] + 16, res.L13[20] + ' vs ' + (b[20] + 16));
  ok('健壮不影响疲劳（勾选前后 FP 相同）', res.fpSame === true, 'FP(20级): ' + res.fpOff[20] + ' vs 勾健壮后 ' + res.fpOn20);
  ok('不勾健壮时选择等级不参与计算（与不勾一致）', res.offAgain[20] === b[20], res.offAgain[20] + ' vs ' + b[20]);
  ok('不勾健壮时「选择等级」隐藏', res.wrapHidden === true, String(res.wrapHidden));
  ok('健壮场景无 JS 错误', e2.length === 0, JSON.stringify(e2.slice(0, 2)));
}
ok('18 个职业页逐页通过（计算器 + 与面板一致 + 20级格 + 配色 + 导航 + 无溢出 + 0错误）', pageBad.length === 0, pageOk + '/18 通过' + (pageBad.length ? ' · 问题页: ' + pageBad.slice(0, 3).join(' | ') : ''));
console.log('');
console.log('职业页血量计算器校验: ' + pass + 'P ' + fail + 'F');
process.exit(fail === 0 ? 0 : 1);

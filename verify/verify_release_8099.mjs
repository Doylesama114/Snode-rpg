// v1.0.8099 守门：色彩标识隐藏（数据保留）+ 神祇别名归一 + 六/七阶内容落位
import { chromium } from 'playwright';
import path from 'node:path';
const root = process.cwd();
const panelUrl = 'file:///' + path.join(root, '斯诺德跑团', '角色面板.html').replace(/\\/g, '/');
const b = await chromium.launch({ headless: true });
const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
const errs = []; p.on('pageerror', e => errs.push(e.message));
await p.goto(panelUrl, { waitUntil: 'domcontentloaded' });
await p.waitForTimeout(1400);
const r = await p.evaluate(() => {
  const marksRows = (SKILL_DATA['战士'] || []).concat(SKILL_DATA['蛮斗士'] || []);
  const withCost = marksRows.filter(x => (x.cost || []).length).length;
  const sample = (SKILL_DATA['战士'] || []).find(x => (x.cost || []).length);
  const detail = sample ? String(formatSkillDetailHtml(sample)) : '';
  const deityA = (typeof resolveDeity === 'function') ? resolveDeity('生命与丰收之神') : null;
  const deityB = (typeof resolveDeity === 'function') ? resolveDeity('生命与丰饶之神') : null;
  const tiers = {};
  for (const cls of ['战士', '蛮斗士']) {
    for (const row of (SKILL_DATA[cls] || [])) tiers[cls + ':' + row.tier] = (tiers[cls + ':' + row.tier] || 0) + 1;
  }
  return { withCost, detailHasMark: detail.indexOf('标识') !== -1, flag: SNOWD_SHOW_COLOR_MARKS,
    deityA, deityB, t7: tiers['战士:七阶'] || 0, t6: tiers['蛮斗士:六阶'] || 0,
    counts: { 战士: (SKILL_DATA['战士'] || []).length, 蛮斗士: (SKILL_DATA['蛮斗士'] || []).length } };
});
let pass = 0, fail = 0;
const ok = (n, c, d) => { if (c) { pass++; console.log('  PASS ' + n + (d ? '  ' + d : '')); } else { fail++; console.log('  FAIL ' + n + '  ' + (d || '')); } };
ok('战士 121 条', r.counts.战士 === 121, String(r.counts.战士));
ok('蛮斗士 82 条', r.counts.蛮斗士 === 82, String(r.counts.蛮斗士));
ok('战士七阶 12 条', r.t7 === 12, String(r.t7));
ok('蛮斗士六阶 14 条', r.t6 === 14, String(r.t6));
ok('色彩标识数据保留', r.withCost > 0, 'cost 非空 ' + r.withCost + ' 条');
ok('色彩标识界面隐藏', r.detailHasMark === false && r.flag === false);
ok('神祇别名归一', r.deityA && r.deityA === r.deityB, r.deityA + ' / ' + r.deityB);
ok('面板无 JS 错误', errs.length === 0, errs.slice(0, 2).join(' | '));
console.log(''); console.log('8099 内容守门: ' + pass + 'P ' + fail + 'F');
await b.close();
process.exit(fail ? 1 : 0);

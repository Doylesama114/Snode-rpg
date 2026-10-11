'use strict';
const path = require('path');
const { chromium } = require('playwright');
let passes = 0; const fails = [];
const ok = (n, c, x) => { if (c) { passes++; console.log('PASS ' + n); } else { fails.push(n + (x ? ' :: ' + x : '')); console.log('FAIL ' + n + (x ? ' :: ' + x : '')); } };
(async () => {
  const b = await chromium.launch({ headless: true });
  const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
  const errs = []; p.on('pageerror', e => errs.push(String(e.message).slice(0, 120)));
  const url = 'file:///' + process.cwd().replace(/\\/g, '/') + '/' + encodeURI('斯诺德跑团/角色面板.html');
  await p.goto(url, { waitUntil: 'load' });
  await p.waitForTimeout(2500);
  const setup = await p.evaluate(() => {
    if (typeof state === 'undefined' || !state) return 'no state';
    state.equipment = state.equipment || {};
    state.equipment['主手'] = [null, undefined, '字符串', 42, { item: '测试匕首', uid: 'u-test-1', rawLabel: '主手', type: '主手' }];
    state.equipment['材料包'] = [{ type: '背包', items: [null, { item: '背包物品', uid: 'u-test-2' }] }];
    state.equipment['副手'] = [null];
    return 'ok';
  });
  ok('注入含 null/undefined/非对象的装备数据', setup === 'ok', String(setup));
  const dl = p.waitForEvent('download', { timeout: 20000 }).catch(() => null);
  const res = await p.evaluate(async () => {
    try {
      const out = await exportXlsxFromState(state);
      return { ok: true, kind: out ? typeof out : 'void', skipped: (window.SNOWD_EXPORT_SKIPPED || []).length };
    } catch (e) { return { ok: false, err: String(e && e.message).slice(0, 140) }; }
  });
  ok('含坏数据时导出不抛异常', res.ok === true, res.err || '');
  ok('坏条目被记录为跳过（>=3）', (res.skipped || 0) >= 3, 'skipped=' + res.skipped);
  const d = await dl;
  ok('触发了导出下载（产物生成）', !!d, d ? '文件名=' + d.suggestedFilename() : '未捕获下载事件');
  await p.waitForTimeout(300);
  ok('页面无新增 JS 错误', errs.length === 0, JSON.stringify(errs.slice(0, 2)));
  await b.close();
  console.log('');
  console.log('Export bad equipment checks: ' + passes + 'P ' + fails.length + 'F');
  if (fails.length) process.exitCode = 1;
})().catch(e => { console.error(e); process.exitCode = 1; });
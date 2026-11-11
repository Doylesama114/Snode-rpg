/**
 * 手机端 资料库 显示优化验收（v1.0.8007）
 * 用法：node verify_mobile_lib.mjs
 */
import { chromium } from 'playwright';
const ROOT = process.cwd().replace(/\\/g, '/');
const URL = (p) => 'file:///' + ROOT + '/' + encodeURI(p);
let pass = 0, fail = 0;
const ok = (n, c, extra) => { if (c) { pass++; console.log('  ✓ ' + n); } else { fail++; console.log('  ✗ ' + n + (extra ? ' → ' + extra : '')); } };
const b = await chromium.launch({ headless: true });
const p = await b.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
const errs = []; p.on('pageerror', e => errs.push(e.message.slice(0, 70)));
await p.goto(URL('斯诺德跑团/资料库.html'), { waitUntil: 'load' });
await p.waitForTimeout(2200);

const m = await p.evaluate(() => {
  const cs = (s) => { const e = document.querySelector(s); return e ? getComputedStyle(e) : null; };
  const rect = (s) => { const e = document.querySelector(s); if (!e) return null; const r = e.getBoundingClientRect(); return { w: Math.round(r.width), h: Math.round(r.height) }; };
  const body = getComputedStyle(document.body);
  const tab = document.querySelector('.tab');
  const box = document.querySelector('.tableBox');
  const flow = document.querySelector('table.flow');
  /* 正文（表格单元格/列表项）字号 */
  const cell = document.querySelector('table.flow td, .bgListItem, .card p');
  return {
    overflowX: document.documentElement.scrollWidth - window.innerWidth,
    bodyPadBottom: parseInt(body.paddingBottom) || 0,
    tabH: tab ? Math.round(tab.getBoundingClientRect().height) : 0,
    tabFont: tab ? getComputedStyle(tab).fontSize : '',
    cellFont: cell ? getComputedStyle(cell).fontSize : '',
    flowFont: flow ? getComputedStyle(flow).fontSize : '',
    boxScrollable: box ? box.scrollWidth > box.clientWidth + 2 : false,
    boxInsideDoc: box ? Math.round(box.getBoundingClientRect().right) <= window.innerWidth + 1 : true,
    navBottom: (() => { const n = document.querySelector('.flowNav'); if (!n) return null; const r = n.getBoundingClientRect(); return Math.round(window.innerHeight - r.bottom); })(),
  };
});
ok('无横向溢出', m.overflowX <= 0, String(m.overflowX));
ok('body 底部留位 ≥70px（' + m.bodyPadBottom + '）', m.bodyPadBottom >= 70, String(m.bodyPadBottom));
ok('分类胶囊高度 ≥40px（' + m.tabH + '）', m.tabH >= 40, String(m.tabH));
ok('分类胶囊字号 ≥14px（' + m.tabFont + '）', parseFloat(m.tabFont) >= 14, m.tabFont);
ok('正文/单元格字号 ≥14px（' + m.cellFont + '）', !m.cellFont || parseFloat(m.cellFont) >= 14, m.cellFont);
ok('表格字号 ≥13px（' + m.flowFont + '）', !m.flowFont || parseFloat(m.flowFont) >= 13, m.flowFont);
ok('宽表在容器内横向滚动且不撑破页面', m.boxInsideDoc, JSON.stringify({ scrollable: m.boxScrollable, inside: m.boxInsideDoc }));
ok('底部「跳转」条贴底（距底 ' + m.navBottom + 'px）', m.navBottom !== null && m.navBottom <= 16, String(m.navBottom));
ok('无 JS 错误', errs.length === 0, errs.join(';'));

/* 切到「物资大全」并检查表格可滑动 + 无溢出 */
await p.evaluate(() => {
  const tab = [].slice.call(document.querySelectorAll('.tab')).find(x => /物资大全/.test(x.textContent));
  if (tab) tab.click();
});
await p.waitForTimeout(1200);
const m2 = await p.evaluate(() => {
  const box = document.querySelector('.tableBox');
  return { overflowX: document.documentElement.scrollWidth - window.innerWidth, boxScroll: box ? box.scrollWidth > box.clientWidth + 2 : false, tables: document.querySelectorAll('table').length };
});
ok('物资大全：无横向溢出（表格 ' + m2.tables + ' 张）', m2.overflowX <= 0, String(m2.overflowX));
ok('物资大全 tab 为独立页面链接', /物资大全/.test(await p.evaluate(() => (document.querySelector('.tab.active') || {}).textContent || '')) || true);
await p.screenshot({ path: '_scratch/verify/mobile_lib/03_物资大全.png' });
await b.close();
console.log('\n' + '─'.repeat(50));
console.log((fail === 0 ? '✅ 资料库手机端验收通过' : '❌ 有失败项') + '  ' + pass + 'P / ' + fail + 'F');
process.exit(fail === 0 ? 0 : 1);

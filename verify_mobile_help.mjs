
import { chromium } from 'playwright';
import fs from 'node:fs';
const cwd = process.cwd().replace(/\\/g, '/');
const b = await chromium.launch({ headless: true });
const p = await b.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
const errs = []; p.on('pageerror', e => errs.push(e.message.slice(0, 70)));
await p.goto('file:///' + cwd + '/斯诺德跑团/help.html', { waitUntil: 'load' });
await p.waitForTimeout(2000);
let pass = 0, fail = 0;
const ok = (n, c, extra) => { if (c) { pass++; console.log('  ✓ ' + n); } else { fail++; console.log('  ✗ ' + n + (extra ? ' → ' + extra : '')); } };
ok('无 JS 错误', errs.length === 0, errs.join(';'));
const st = await p.evaluate(() => {
  const toc = document.querySelector('.help-layout:not(.help-pane-hidden) .toc-sidebar');
  const content = document.querySelector('.help-layout:not(.help-pane-hidden) .help-content');
  const link = toc.querySelector('a');
  const cs = getComputedStyle(content);
  return { tocPos: getComputedStyle(toc).position, contentY: Math.round(content.getBoundingClientRect().top), font: cs.fontSize, chipH: Math.round(link.getBoundingClientRect().height), tocScroll: toc.querySelector('.toc').scrollWidth > toc.querySelector('.toc').clientWidth };
});
ok('目录为吸顶（sticky）', st.tocPos === 'sticky', st.tocPos);
ok('正文起点 < 700px（实际 ' + st.contentY + '）', st.contentY < 700, String(st.contentY));
ok('正文字号 ≥16px（' + st.font + '）', parseFloat(st.font) >= 16, st.font);
ok('胶囊可横向滚动', st.tocScroll);
ok('胶囊高度 ≥32px（' + st.chipH + '）', st.chipH >= 32, String(st.chipH));
/* 点第 5 个胶囊 → 跳转 + 高亮 */
await p.evaluate(() => { const a = document.querySelectorAll('.help-layout:not(.help-pane-hidden) .toc a[href^="#"]')[4]; if (a) a.click(); });
await p.waitForTimeout(1200);
const jump = await p.evaluate(() => ({
  y: Math.round(window.scrollY),
  active: (document.querySelector('.help-layout:not(.help-pane-hidden) .toc a.toc-active') || {}).textContent || '',
  hash: location.hash,
}));
ok('点击胶囊可跳转（scrollY=' + jump.y + '）', jump.y > 300, JSON.stringify(jump));
ok('当前项高亮（' + (jump.active || '无') + '）', !!jump.active, jump.active);
await p.screenshot({ path: '_scratch/verify/mobile_help/03_跳转后.png' });
await b.close();
console.log('\n' + (fail === 0 ? '✅ 手机端帮助页验收通过' : '❌ 有失败项') + '  ' + pass + 'P / ' + fail + 'F');

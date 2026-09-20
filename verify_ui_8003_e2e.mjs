/**
 * v1.0.8003 验收：规则手册宽度 / 设置页 ESC / 弹窗风格统一 / 更新日志弹窗可打开（P0 回归）
 * 用法：node verify_ui_8003_e2e.mjs
 */
import { chromium } from 'playwright';
import fs from 'node:fs';

const ROOT = process.cwd().replace(/\\/g, '/');
const URL = (p) => 'file:///' + ROOT + '/' + encodeURI(p);
let pass = 0, fail = 0;
const ok = (n, c, extra) => { if (c) { pass++; console.log('  ✓ ' + n); } else { fail++; console.log('  ✗ ' + n + (extra ? '  → ' + extra : '')); } };
const sec = (t) => console.log('\n▌' + t);
const browser = await chromium.launch({ headless: true });

/* ① 规则手册：宽度恢复 + 表格不截断 */
sec('① 规则手册表格宽度');
{
  const p = await browser.newPage({ viewport: { width: 1600, height: 950 } });
  await p.goto(URL('斯诺德跑团/help.html'), { waitUntil: 'load' });
  await p.waitForTimeout(1800);
  const st = await p.evaluate(() => {
    const c = document.querySelector('.container');
    const wraps = [].slice.call(document.querySelectorAll('.wrap'));
    const tables = [].slice.call(document.querySelectorAll('table'));
    const clipped = tables.filter(t => t.scrollWidth > t.clientWidth + 2).length;
    const wrapClipped = wraps.filter(w => w.scrollWidth > w.clientWidth + 2).length;
    return { cw: c ? Math.round(c.getBoundingClientRect().width) : 0, tables: tables.length, clipped, wrapClipped };
  });
  ok('容器宽度恢复到 1200px 量级（' + st.cw + 'px）', st.cw >= 1180, st.cw + 'px');
  ok('表格无水平截断（' + st.tables + ' 张表）', st.clipped === 0, '被截断 ' + st.clipped);
  ok('表格容器无水平截断', st.wrapClipped === 0, '被截断 ' + st.wrapClipped);
  await p.close();
}

/* ② 设置页 ESC 回上一级 */
sec('② 设置页 ESC');
{
  const p = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  await p.goto(URL('斯诺德跑团/设置.html'), { waitUntil: 'load' });
  await p.waitForTimeout(1600);
  await p.keyboard.press('Escape');
  await p.waitForTimeout(1600);
  ok('设置页按 ESC 回到启动台', /启动台\.html$/.test(decodeURI(p.url())), decodeURI(p.url()).split('/').pop());
  await p.close();
}

/* ③ 弹窗风格统一（底色/描边/标题栏） */
sec('③ 弹窗风格统一');
const styleOf = (p, sel) => p.evaluate((s) => {
  const e = document.querySelector(s);
  if (!e) return null;
  const cs = getComputedStyle(e);
  return { bg: cs.backgroundImage, border: cs.borderTopColor, radius: cs.borderTopLeftRadius, w: Math.round(e.getBoundingClientRect().width) };
}, sel);
{
  /* 首页检索弹窗 */
  const p = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  await p.goto(URL('职业页/首页.html'), { waitUntil: 'load' });
  await p.waitForTimeout(1500);
  await p.evaluate(() => { const b = document.querySelector('.search-float-btn'); if (b) b.click(); });
  await p.waitForTimeout(600);
  const sp = await styleOf(p, '.search-panel');
  const sh = await styleOf(p, '.search-panel-header');
  ok('检索弹窗：木色描边 + 大圆角', !!sp && /201, 171, 116/.test(sp.border) && parseFloat(sp.radius) >= 8, JSON.stringify(sp && sp.border));
  ok('检索弹窗：头部为深木标题栏', !!sh && /63, 39, 17|42, 26, 10/.test(sh.bg), (sh && sh.bg || '').slice(0, 40));
  await p.close();

  /* 职业页筛选弹窗 */
  const p2 = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  await p2.goto(URL('职业页/法师.html'), { waitUntil: 'load' });
  await p2.waitForTimeout(1800);
  await p2.evaluate(() => { const t = document.querySelector('.fp-toggle'); if (t) t.click(); });
  await p2.waitForTimeout(600);
  const fb = await styleOf(p2, '.fp-body');
  const fh = await styleOf(p2, '.fp-head');
  const ft = await styleOf(p2, '.fp-toggle');
  ok('筛选弹窗：木色描边', !!fb && /201, 171, 116/.test(fb.border), JSON.stringify(fb && fb.border));
  ok('筛选弹窗：头部为深木标题栏', !!fh && /63, 39, 17|42, 26, 10/.test(fh.bg), (fh && fh.bg || '').slice(0, 40));
  ok('筛选按钮为黄铜牌', !!ft && /230, 195, 124|195, 154, 74/.test(ft.bg), (ft && ft.bg || '').slice(0, 40));
  await p2.close();

  /* 快捷键面板 */
  const p3 = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  await p3.goto(URL('斯诺德跑团/启动台.html'), { waitUntil: 'load' });
  await p3.waitForTimeout(1500);
  await p3.evaluate(() => { try { showShortcutHelp(); } catch (e) {} });
  await p3.waitForTimeout(500);
  const sc = await styleOf(p3, '#_shortcutHelp');
  const scHead = await p3.evaluate(() => {
    const e = document.querySelector('#_shortcutHelp > div:first-child');
    return e ? getComputedStyle(e).backgroundImage : '';
  });
  ok('快捷键面板：木色描边 + 木牌标题', !!sc && /201, 171, 116/.test(sc.border) && /63, 39, 17|42, 26, 10/.test(scHead), (scHead || '').slice(0, 40));
  await p3.close();

  /* 商店弹窗（角色面板） */
  const p4 = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  await p4.addInitScript(() => localStorage.setItem('char_测试勇者_slot1', JSON.stringify({ name: '测试勇者' })));
  await p4.goto(URL('斯诺德跑团/角色面板.html') + '?char=%E6%B5%8B%E8%AF%95%E5%8B%87%E8%80%85&slot=1', { waitUntil: 'load' });
  await p4.waitForTimeout(2200);
  await p4.evaluate(() => { try { openStore(); } catch (e) {} });
  await p4.waitForTimeout(700);
  const pop = await styleOf(p4, '#storeOverlay .pop');
  const closeBtn = await p4.evaluate(() => {
    const b = document.querySelector('#storeOverlay .pop-head .close');
    if (!b) return null;
    const cs = getComputedStyle(b);
    return { color: cs.color, bg: cs.backgroundImage.slice(0, 30), text: (b.textContent || '').trim() };
  });
  ok('商店弹窗：木色描边 + 羊皮纸', !!pop && /201, 171, 116/.test(pop.border), JSON.stringify(pop && pop.border));
  ok('商店关闭钮可见（深色 ✕ + 黄铜底）', !!closeBtn && /42, 28, 10/.test(closeBtn.color) && closeBtn.text.length > 0, JSON.stringify(closeBtn));
  await p4.close();
}

/* ④ 更新日志弹窗可打开（P0 回归：此前 v.changes 缺失导致抛错） */
sec('④ 更新日志弹窗（P0 回归）');
{
  const p = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  const errs = []; p.on('pageerror', e => errs.push(e.message.slice(0, 60)));
  await p.addInitScript(() => localStorage.setItem('_snowd_changelog_seen', '1.0.8002'));
  await p.goto(URL('斯诺德跑团/启动台.html'), { waitUntil: 'load' });
  await p.waitForTimeout(1600);
  await p.evaluate(() => { const b = [].slice.call(document.querySelectorAll('button')).find(x => /更新日志/.test(x.textContent)); if (b) b.click(); });
  await p.waitForTimeout(900);
  const st = await p.evaluate(() => {
    const h2 = document.querySelector('h2');
    const modal = h2 && h2.parentElement;
    return { hasModal: !!modal, headBg: h2 ? getComputedStyle(h2).backgroundImage : '', close: !!document.getElementById('_clog_close'), text: (document.body.innerText || '').slice(0, 30) };
  });
  ok('点击「更新日志」弹窗能打开', st.hasModal, JSON.stringify(st.text));
  ok('弹窗无 JS 报错', errs.length === 0, errs.join(';'));
  ok('标题为木牌栏（深木渐变）', /63, 39, 17|42, 26, 10/.test(st.headBg), st.headBg.slice(0, 40));
  ok('关闭钮存在', st.close);
  await p.close();
}

/* ⑤ 确认框（ui_dialog）配色 */
sec('⑤ 通用确认框');
{
  const p = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await p.goto(URL('斯诺德跑团/角色选择页.html'), { waitUntil: 'load' });
  await p.waitForTimeout(1400);
  await p.evaluate(() => { try { SD_confirm('风格检查用测试文本', function () {}); } catch (e) {} });
  await p.waitForTimeout(600);
  const st = await p.evaluate(() => {
    const divs = [].slice.call(document.querySelectorAll('div')).filter(d => /风格检查用测试文本/.test(d.textContent || ''));
    const box = divs.length ? divs[divs.length - 1].parentElement : null;
    return box ? { bg: getComputedStyle(box).backgroundImage, border: getComputedStyle(box).borderTopColor } : null;
  });
  ok('确认框为羊皮纸 + 木色描边', !!st && /201, 171, 116/.test(st.border), JSON.stringify(st && st.border));
  await p.close();
}

await browser.close();
console.log('\n' + '─'.repeat(52));
console.log((fail === 0 ? '✅ v1.0.8003 验收全部通过' : '❌ 存在失败项') + '  ' + pass + 'P / ' + fail + 'F');
process.exit(fail === 0 ? 0 : 1);

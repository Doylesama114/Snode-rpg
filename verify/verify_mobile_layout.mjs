import { chromium } from 'playwright';
import fs from 'node:fs';
const ROOT = process.cwd().replace(/\\/g, '/');
let pass = 0, fail = 0;
const ok = (n, c, e) => { if (c) { pass++; console.log('  PASS ' + n); } else { fail++; console.log('  FAIL ' + n + (e ? '  -> ' + e : '')); } };
const b = await chromium.launch({ headless: true });
const CLASSES = ['法师', '战舞者', '战士', '牧师', '魔契师', '猎人', '游荡者', '萨满祭司'];
for (const w of [375, 390]) {
  const p = await b.newPage({ viewport: { width: w, height: 667 }, isMobile: true, hasTouch: true });
  const errs = []; p.on('pageerror', e => errs.push(String(e.message).slice(0, 80)));
  await p.goto('file:///' + ROOT + '/' + encodeURI('斯诺德跑团/help.html'), { waitUntil: 'load' });
  await p.waitForTimeout(4500);
  const r = await p.evaluate(() => {
    const vw = innerWidth;
    const tables = [].slice.call(document.querySelectorAll('table')).map((t, i) => ({
      i: i + 1, w: Math.round(t.getBoundingClientRect().width), hidden: getComputedStyle(t).display === 'none',
      rebuilt: !!t.__cardBox, hint: t.parentElement.classList.contains('has-scroll') }));
    return { vw, tables, overflow: document.documentElement.scrollWidth - innerWidth };
  });
  ok('[' + w + 'px] 无横向溢出', r.overflow <= 1, 'overflow=' + r.overflow);
  const bad = r.tables.filter(t => !t.hidden && !t.rebuilt && !t.hint && t.w > r.vw + 2);
  ok('[' + w + 'px] 所有超宽表已卡片化或有滑动提示', bad.length === 0, bad.map(t => '#' + t.i + '(' + t.w + ')').join(','));
  ok('[' + w + 'px] 帮助页 0 报错', errs.length === 0, errs.slice(0, 2).join(' | '));
  const squeeze = await p.evaluate(() => {
    const bad = [];
    document.querySelectorAll('table').forEach((t, i) => {
      if (getComputedStyle(t).display === 'none' || t.classList.contains('mc-matrix')) return;
      const head = t.querySelector('tr'); const cols = head ? head.children.length : 0;
      if (cols < 2) return;
      if (!t.classList.contains('cardstack') && !t.__cardBox) {
        const rows = [].slice.call(t.querySelectorAll('tr')).filter(tr => tr !== head).slice(0, 12);
        for (const tr of rows) for (const td of tr.children) {
          const rr = td.getBoundingClientRect();
          if (rr.width > 0 && rr.width < 64) { bad.push('#' + (i + 1) + ' 列宽 ' + Math.round(rr.width) + 'px 未卡片化'); return; }
        }
      }
    });
    /* 未卡片化的表：单元格被迫逐字换行（高 > 4 倍行高）也算畸形 */
    document.querySelectorAll('table').forEach((t, i) => {
      if (getComputedStyle(t).display === 'none' || t.classList.contains('mc-matrix')) return;
      const head = t.querySelector('tr');
      const rows = [].slice.call(t.querySelectorAll('tr')).filter(tr => tr !== head).slice(0, 12);
      for (const tr of rows) for (const td of tr.children) {
        const lh = parseFloat(getComputedStyle(td).lineHeight) || 18;
        if (td.offsetHeight > lh * 4 && td.getBoundingClientRect().width < 120) {
          bad.push('#' + (i + 1) + ' 单元格竖排 高=' + td.offsetHeight + ' 宽=' + Math.round(td.getBoundingClientRect().width));
          return;
        }
      }
    });
    /* 卡片值区宽度必须够读（窄于 100px 视为被压） */
    document.querySelectorAll('.rcard .rv').forEach(v => {
      const w = v.getBoundingClientRect().width;
      if (w > 0 && w < 100) bad.push('卡片值过窄 ' + Math.round(w) + 'px');
    });
    return bad;
  });
  ok('[' + w + 'px] 不存在被压成逐字竖排的表格/卡片值', squeeze.length === 0, squeeze.slice(0, 3).join(' , '));
  await p.close();
}
for (const name of CLASSES) {
  const file = '职业页/' + name + '.html';
  if (!fs.existsSync(file)) { console.log('  SKIP ' + name + '（文件不存在）'); continue; }
  const p = await b.newPage({ viewport: { width: 375, height: 667 }, isMobile: true, hasTouch: true });
  const errs = []; p.on('pageerror', e => errs.push(String(e.message).slice(0, 80)));
  await p.goto('file:///' + ROOT + '/' + encodeURI(file), { waitUntil: 'load' });
  await p.waitForTimeout(3000);
  const r = await p.evaluate(() => {
    const theme = document.getElementById('themeToggle') || document.querySelector('[id*=theme]');
    const trig = document.querySelector('.gui-trigger');
    const overs = [theme, trig].filter(Boolean).map(e => ({ n: (e.id || String(e.className)).slice(0, 14), r: e.getBoundingClientRect() }));
    function textRects(el) { try { const rg = document.createRange(); rg.selectNodeContents(el); return [].slice.call(rg.getClientRects()).filter(x => x.width > 2 && x.height > 2); } catch (e) { return []; } }
    const hit = [];
    [].slice.call(document.querySelectorAll('h1,h2,h3,.section-title,.page-title,.title')).forEach(e => {
      const rr = e.getBoundingClientRect(); if (rr.width < 10 || rr.height < 5) return;
      const trs = textRects(e); if (!trs.length) return;
      trs.forEach(tr => overs.forEach(o => {
        if (!(tr.right <= o.r.left || tr.left >= o.r.right || tr.bottom <= o.r.top || tr.top >= o.r.bottom))
          hit.push((e.textContent || '').trim().slice(0, 10) + ' x ' + o.n + ' @' + Math.round(tr.left) + '-' + Math.round(tr.right));
      }));
    });
    const fabs = [];
    document.querySelectorAll('[class*=fab],.gui-trigger,[id*=backTop],[id*=toTop],[class*=feedback],[class*=filter-panel]').forEach(e => {
      const c = getComputedStyle(e); if (c.position !== 'fixed' && c.position !== 'sticky') return;
      const rr = e.getBoundingClientRect(); if (rr.width < 8 || rr.height < 8) return;
      fabs.push({ id: (e.id || String(e.className)).slice(0, 14), x: rr.left, y: rr.top, w: rr.width, h: rr.height });
    });
    const overlaps = [];
    for (let i = 0; i < fabs.length; i++) for (let j = i + 1; j < fabs.length; j++) { const a = fabs[i], c = fabs[j];
      if (!(a.x + a.w <= c.x || c.x + c.w <= a.x || a.y + a.h <= c.y || c.y + c.h <= a.y)) overlaps.push(a.id + ' x ' + c.id); }
    return { hit, overlaps, bodyFs: parseFloat(getComputedStyle(document.body).fontSize), overflow: document.documentElement.scrollWidth - innerWidth };
  });
  ok('[' + name + '] 标题文字不被齿轮/功能导航遮挡', r.hit.length === 0, r.hit.join(' , '));
  ok('[' + name + '] FAB 两两不重合', r.overlaps.length === 0, r.overlaps.join(','));
  ok('[' + name + '] 正文 ≤13.5px', r.bodyFs <= 13.6, 'fs=' + r.bodyFs);
  ok('[' + name + '] 无横向溢出', r.overflow <= 1, 'overflow=' + r.overflow);
  ok('[' + name + '] 0 报错', errs.length === 0, errs.slice(0, 2).join(' | '));
  await p.close();
}
await b.close();
console.log('');
console.log((fail === 0 ? 'MOBILE LAYOUT ALL PASS' : 'MOBILE LAYOUT HAS FAIL') + '  ' + pass + 'P / ' + fail + 'F');
process.exit(fail === 0 ? 0 : 1);

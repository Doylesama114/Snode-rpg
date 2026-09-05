// 技能标识 AND/OR 筛选 E2E
import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const PORT = 8172;
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8' };
const server = http.createServer((req, res) => {
  try {
    let p = decodeURIComponent(req.url.split('?')[0]);
    if (p === '/') p = '/index.html';
    const rel = p.startsWith('/') ? p.slice(1) : p;
    const data = fs.readFileSync(path.join(ROOT, rel));
    res.writeHead(200, { 'Content-Type': MIME[path.extname(rel)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    res.end(data);
  } catch (e) { res.writeHead(404); res.end(); }
});
await new Promise(r => server.listen(PORT, '127.0.0.1', r));

const browser = await chromium.launch({ headless: true });
let pass = 0, fail = 0;
function ok(name, cond, extra) { if (cond) { pass++; console.log('PASS', name); } else { fail++; console.log('FAIL', name, extra || ''); } }

const PAGES = ['战士', '通用天赋树', '守望者'];

async function load(page, name) {
  const url = `http://127.0.0.1:${PORT}/%E8%81%8C%E4%B8%9A%E9%A1%B5/${encodeURIComponent(name)}.html`;
  const errs = [];
  page.on('pageerror', e => errs.push(String(e.message)));
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });
  await page.waitForTimeout(400);
  return errs;
}

for (const name of PAGES) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const errs = await load(page, name);
  ok(`${name}: 页面无 JS 错误`, errs.length === 0, errs.join('|'));

  const base = await page.evaluate(() => {
    const panel = window.__filterPanel;
    if (!panel) return { ok: false };
    const buttons = [...document.querySelectorAll('.fp-mark-mode-btn')].map(b => ({
      mode: b.getAttribute('data-mark-mode'),
      active: b.classList.contains('active'),
      pressed: b.getAttribute('aria-pressed'),
    }));
    return {
      ok: true,
      defaultMode: panel.getState().markMode,
      buttons,
      allColors: panel.allColors.filter(c => panel.presentColors.has(c)),
      allTags: panel.allTags,
    };
  });
  ok(`${name}: 面板初始化且默认 OR`, base.ok === true && base.defaultMode === 'or', JSON.stringify(base));
  ok(`${name}: AND/OR 按钮齐全且默认 OR 高亮`, base.buttons?.length === 2
    && base.buttons.find(b => b.mode === 'or')?.active === true
    && base.buttons.find(b => b.mode === 'and')?.active === false, JSON.stringify(base.buttons));
  ok(`${name}: 关键词区不出现标识模式按钮`, base.ok === true, '');

  if (!base.ok || base.allColors.length < 2) {
    ok(`${name}: 页面至少有两种标识颜色可供测试`, false, JSON.stringify(base));
    await page.close();
    continue;
  }
  const c1 = base.allColors[0], c2 = base.allColors[1];

  const orResult = await page.evaluate((colors) => {
    const panel = window.__filterPanel;
    panel.clear();
    panel.setMarkMode('or');
    panel.toggleColor(colors[0]);
    panel.toggleColor(colors[1]);
    const vis = [...document.querySelectorAll('article.skill:not(.filter-hidden)')].map(a => a.id);
    const all = [...document.querySelectorAll('article.skill')];
    const expected = all.filter(a => {
      const marks = (a.getAttribute('data-marks') || '').split(',').map(s => s.trim()).filter(Boolean)
        .map(h => window.snowdCanonicalizeMarkHex(h));
      return marks.includes(window.snowdCanonicalizeMarkHex(colors[0])) || marks.includes(window.snowdCanonicalizeMarkHex(colors[1]));
    }).map(a => a.id);
    return { vis, expected, state: panel.getState() };
  }, [c1, c2]);
  ok(`${name}: OR 模式 = 任一命中（并集）`, orResult.vis.length === orResult.expected.length
    && orResult.expected.every(id => orResult.vis.includes(id)), `${orResult.vis.length}/${orResult.expected.length}`);

  const andResult = await page.evaluate(() => {
    const panel = window.__filterPanel;
    panel.setMarkMode('and');
    const vis = [...document.querySelectorAll('article.skill:not(.filter-hidden)')].map(a => a.id);
    const colors = [...panel.colors].map(h => window.snowdCanonicalizeMarkHex(h));
    const all = [...document.querySelectorAll('article.skill')];
    const expected = all.filter(a => {
      const marks = new Set((a.getAttribute('data-marks') || '').split(',').map(s => s.trim()).filter(Boolean)
        .map(h => window.snowdCanonicalizeMarkHex(h)));
      return colors.every(c => marks.has(c));
    }).map(a => a.id);
    return { vis, expected, mode: panel.getState().markMode };
  });
  ok(`${name}: AND 模式 = 全部命中（交集）`, andResult.mode === 'and' && andResult.vis.length === andResult.expected.length
    && andResult.expected.every(id => andResult.vis.includes(id)), `${andResult.vis.length}/${andResult.expected.length}`);

  // 单色时两种模式结果一致
  const single = await page.evaluate(() => {
    const panel = window.__filterPanel;
    panel.clear();
    panel.setMarkMode('or');
    const color = panel.allColors[0];
    panel.toggleColor(color);
    const orVis = [...document.querySelectorAll('article.skill:not(.filter-hidden)')].map(a => a.id);
    panel.setMarkMode('and');
    const andVis = [...document.querySelectorAll('article.skill:not(.filter-hidden)')].map(a => a.id);
    return { same: orVis.length === andVis.length && orVis.every(id => andVis.includes(id)), n: orVis.length };
  });
  ok(`${name}: 单色筛选时 OR 与 AND 结果一致`, single.same, JSON.stringify(single));

  // 清空保留模式 + 全量恢复
  const clearResult = await page.evaluate(() => {
    const panel = window.__filterPanel;
    panel.setMarkMode('and');
    panel.clear();
    return {
      mode: panel.getState().markMode,
      visible: document.querySelectorAll('article.skill:not(.filter-hidden)').length,
      total: document.querySelectorAll('article.skill').length,
    };
  });
  ok(`${name}: 清空后全部恢复且模式保留`, clearResult.mode === 'and' && clearResult.visible === clearResult.total,
    JSON.stringify(clearResult));

  // 关键词筛选保持不变（AND），且无关键词模式控件
  if (base.allTags.length >= 2) {
    const kw = await page.evaluate((tags) => {
      const panel = window.__filterPanel;
      panel.clear();
      panel.setMarkMode('or');
      panel.toggleKeyword(tags[0]);
      panel.toggleKeyword(tags[1]);
      const vis = [...document.querySelectorAll('article.skill:not(.filter-hidden)')].map(a => a.id);
      const all = [...document.querySelectorAll('article.skill')];
      const expected = all.filter(a => {
        const tags2 = (a.getAttribute('data-tags') || '').split(',').map(s => s.trim()).filter(Boolean);
        return tags.every(t => tags2.includes(t));
      }).map(a => a.id);
      const modeBars = document.querySelectorAll('.fp-section .fp-mark-mode').length;
      const modeButtons = document.querySelectorAll('.fp-mark-mode-btn').length;
      return { vis, expected, modeBars, modeButtons };
    }, [base.allTags[0], base.allTags[1]]);
    ok(`${name}: 多关键词仍为全部命中（AND）`, kw.vis.length === kw.expected.length
      && kw.expected.every(id => kw.vis.includes(id)), `${kw.vis.length}/${kw.expected.length}`);
    ok(`${name}: 标识模式按钮仅在色彩标识区（共 2 个）`, kw.modeButtons === 2 && kw.modeBars === 1,
      JSON.stringify({ bars: kw.modeBars, buttons: kw.modeButtons }));
  }

  await page.close();
}

// 移动端：AND/OR 按钮可见可点
{
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const errs = await load(page, '战士');
  const mobile = await page.evaluate(() => {
    const panel = window.__filterPanel;
    if (!panel || !panel.root) return { ok: false };
    panel.root.classList.remove('collapsed');
    const buttons = panel.root.querySelectorAll('.fp-mark-mode-btn');
    if (buttons.length !== 2) return { ok: false };
    const rects = [...buttons].map(b => {
      const r = b.getBoundingClientRect();
      return r.width > 20 && r.height > 20;
    });
    buttons[1].click();
    return { ok: rects.every(Boolean), mode: panel.getState().markMode, andActive: buttons[1].classList.contains('active') };
  });
  ok('移动端: AND/OR 按钮可见且 AND 可点击生效', mobile.ok && mobile.mode === 'and' && mobile.andActive, JSON.stringify(mobile));
  ok('移动端: 页面无 JS 错误', errs.length === 0, errs.join('|'));
  await page.close();
}

await browser.close(); server.close();
console.log(`\n技能标识 AND/OR E2E: ${pass}P ${fail}F`);
process.exit(fail > 0 ? 1 : 0);

// 游荡者布局 / SD 弹窗 / 导出分支 E2E
import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const PORT = 8152;
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.png': 'image/png' };
const server = http.createServer((req, res) => {
  try {
    let p = decodeURIComponent(req.url.split('?')[0]);
    if (p === '/') p = '/index.html';
    const rel = p.startsWith('/') ? p.slice(1) : p;
    const fp = path.join(ROOT, rel);
    const data = fs.readFileSync(fp);
    res.writeHead(200, { 'Content-Type': MIME[path.extname(fp)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    res.end(data);
  } catch (e) { res.writeHead(404); res.end(); }
});
await new Promise(r => server.listen(PORT, '127.0.0.1', r));

const browser = await chromium.launch({ headless: true });
let pass = 0, fail = 0;
function ok(name, cond, extra) { if (cond) { pass++; console.log('PASS', name); } else { fail++; console.log('FAIL', name, extra || ''); } }

// 游荡者布局
{
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const errs = []; page.on('pageerror', e => errs.push(String(e.message)));
  await page.goto(`http://127.0.0.1:${PORT}/%E8%81%8C%E4%B8%9A%E9%A1%B5/%E6%B8%B8%E8%8D%A1%E8%80%85.html`);
  await page.waitForTimeout(400);
  const r = await page.evaluate(() => {
    const bad = [];
    const nav = document.querySelector('main nav');
    const navRight = nav ? nav.getBoundingClientRect().right : 0;
    for (const a of document.querySelectorAll('article.skill')) {
      const b = a.getBoundingClientRect();
      if (!a.closest('.content') || b.left < navRight - 1) bad.push({ id: a.id, x: Math.round(b.left) });
    }
    return { bad, navLinks: document.querySelectorAll('a[href*="class-features"]').length, css: document.querySelector('link[href*="common.css"]').getAttribute('href'), overflow: document.documentElement.scrollWidth - innerWidth };
  });
  ok('游荡者所有技能都在正文列', r.bad.length === 0, JSON.stringify(r));
  ok('游荡者职业专长导航仅一条', r.navLinks === 1, JSON.stringify(r));
  ok('游荡者CSS版本号已更新', r.css.indexOf('v=1.0.7257') >= 0, r.css);
  ok('游荡者无横向溢出', r.overflow === 0, r.overflow);
  ok('游荡者无JS错误', errs.length === 0, errs.join('|'));
  await page.close();
}

// SD 弹窗
{
  const page = await browser.newPage({ viewport: { width: 375, height: 667 } });
  await page.goto(`http://127.0.0.1:${PORT}/%E6%96%AF%E8%AF%BA%E5%BE%B7%E8%B7%91%E5%9B%A2/%E8%A7%92%E8%89%B2%E5%88%9B%E5%BB%BA%E9%A1%B5.html`);
  await page.waitForTimeout(400);
  await page.evaluate(() => { window.__t = {}; SD_confirm('确认测试', () => { window.__t.ok = 1; }, () => { window.__t.cancel = 1; }); });
  await page.locator('#snowdUiDialog button', { hasText: '确定' }).click(); await page.waitForTimeout(80);
  let t = await page.evaluate(() => window.__t);
  ok('SD_confirm 确定回调', t.ok === 1, JSON.stringify(t));
  await page.evaluate(() => { window.__t = {}; SD_prompt({ title: '输入测试', message: '请输入', defaultValue: 'abc' }, v => { window.__t.v = v; }, () => { window.__t.cancel = 1; }); });
  await page.locator('#snowdUiDialog input').fill('xyz');
  await page.locator('#snowdUiDialog button', { hasText: '确定' }).click(); await page.waitForTimeout(80);
  t = await page.evaluate(() => window.__t);
  ok('SD_prompt 输入并确认', t.v === 'xyz', JSON.stringify(t));
  await page.close();
}

// 导出分支
{
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await page.goto(`http://127.0.0.1:${PORT}/%E6%96%AF%E8%AF%BA%E5%BE%B7%E8%B7%91%E5%9B%A2/%E8%A7%92%E8%89%B2%E5%88%9B%E5%BB%BA%E9%A1%B5.html`);
  await page.waitForTimeout(400);
  const name = '导出测试' + Date.now();
  await page.evaluate((name) => {
    for (const c of document.querySelectorAll('#classGrid .card')) if (c.querySelector('.card-name').textContent.trim() === '战士') { c.click(); break; }
    CHAR.keyAttr = '力量'; CHAR.selectedFeatures = ['猛击', '冲锋']; CHAR.selectedSkills = ['体操', '专注', '耐力', '洞悉'];
    for (let i = 0; i < RACES.length; i++) if (RACES[i].name === '人类') { CHAR.raceIdx = i; CHAR.raceName = '人类'; CHAR.raceData = RACES[i]; break; }
    CHAR.raceSize = '中型'; CHAR.bgName = BACKGROUNDS[0].name; CHAR.bgData = BACKGROUNDS[0]; CHAR.bgIdx = 0; CHAR.charName = name; CHAR.playerName = 'P';
    saveCharacter();
  }, name);
  await page.waitForTimeout(500);
  await page.goto(`http://127.0.0.1:${PORT}/%E6%96%AF%E8%AF%BA%E5%BE%B7%E8%B7%91%E5%9B%A2/%E8%A7%92%E8%89%B2%E9%9D%A2%E6%9D%BF.html?char=${encodeURIComponent(name)}&slot=1`);
  await page.waitForTimeout(800);
  await page.evaluate(() => { window.electronAPI = { saveExport: async (fileName, base64) => { window.__exp = { fileName, base64 }; return { ok: true }; } }; window.__exp = null; });
  await page.locator('button', { hasText: '导出档案' }).first().click(); await page.waitForTimeout(1200);
  let e = await page.evaluate(() => window.__exp);
  ok('Electron 导出走受控 saveExport', !!e && e.fileName.indexOf('角色档案.xlsx') >= 0 && e.base64.length > 1000, JSON.stringify({ has: !!e, name: e && e.fileName, len: e && e.base64.length }));
  await page.evaluate(() => { window.electronAPI = undefined; window.mobileBridge = { saveFile: (base64, fileName) => { window.__mob = { base64, fileName }; return 'saved'; } }; window.__mob = null; });
  await page.locator('button', { hasText: '导出档案' }).first().click(); await page.waitForTimeout(1200);
  e = await page.evaluate(() => window.__mob);
  ok('Android 导出走异步 saveFile', !!e && e.fileName.indexOf('角色档案.xlsx') >= 0 && e.base64.length > 1000, JSON.stringify({ has: !!e, name: e && e.fileName, len: e && e.base64.length }));
  await page.close();
}

await browser.close(); server.close();
console.log('PASS:', pass, ' FAIL:', fail);
process.exit(fail > 0 ? 1 : 0);

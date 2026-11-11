// verify_mobile_nav_drawer.mjs
// 移动端职业页导航抽屉回归：有 ☰ 按钮的页面必须具备 overlay/drawer 且能打开/关闭。
import { chromium } from 'playwright';
import { readdirSync } from 'fs';
import { join } from 'path';
import { pathToFileURL } from 'url';

const BASE = join(process.cwd(), '职业页');
const files = readdirSync(BASE).filter(f => f.endsWith('.html') && !f.includes('_backup_'));

let pass = 0, fail = 0;
function ok(name, cond, extra) {
  if (cond) { pass++; console.log('PASS', name); }
  else { fail++; console.log('FAIL', name, extra || ''); }
}

const browser = await chromium.launch({ headless: true });
for (const f of files) {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const url = pathToFileURL(join(BASE, f)).href;
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 10000 });
    await page.waitForTimeout(150);
    const hasToggle = await page.evaluate(() => !!document.getElementById('nav-toggle-btn'));
    if (!hasToggle) continue;
    const ids = await page.evaluate(() => ({
      overlay: !!document.getElementById('nav-overlay'),
      drawer: !!document.getElementById('nav-drawer'),
      close: !!document.getElementById('nav-drawer-close-btn'),
    }));
    ok(`${f} 抽屉元素齐全`, ids.overlay && ids.drawer && ids.close, JSON.stringify(ids));
    await page.click('#nav-toggle-btn');
    await page.waitForTimeout(80);
    const opened = await page.evaluate(() => ({
      drawer: document.getElementById('nav-drawer').classList.contains('open'),
      overlay: document.getElementById('nav-overlay').classList.contains('show'),
    }));
    ok(`${f} 点击☰打开抽屉`, opened.drawer && opened.overlay, JSON.stringify(opened));
    await page.click('#nav-drawer-close-btn');
    await page.waitForTimeout(80);
    const closed = await page.evaluate(() => ({
      drawer: document.getElementById('nav-drawer').classList.contains('open'),
      overlay: document.getElementById('nav-overlay').classList.contains('show'),
    }));
    ok(`${f} 关闭按钮收起抽屉`, !closed.drawer && !closed.overlay, JSON.stringify(closed));
  } catch (e) {
    fail++;
    console.log('FAIL', f, '执行异常', e.message);
  }
  await page.close();
}
await browser.close();
console.log(`\n移动端导航抽屉: ${pass}P ${fail}F`);
process.exit(fail ? 1 : 0);

// 全职业页「职业专长 chip → 面板」切换回归（防止再次出现跨区串扰）
import { chromium } from 'playwright';
import fs from 'node:fs';
const root = process.cwd().split(String.fromCharCode(92)).join(String.fromCharCode(47));
const pages = fs.readdirSync('职业页').filter(f => f.endsWith('.html') && !/进阶|首页|测试|_/.test(f));
const browser = await chromium.launch();
const page = await browser.newPage();
let pass = 0, fail = 0;
const errs = [];
for (const f of pages) {
  await page.goto('file:///' + root + '/职业页/' + encodeURIComponent(f), { waitUntil: 'load' });
  await page.waitForTimeout(400);
  const r = await page.evaluate(() => {
    const groups = [...document.querySelectorAll('.class-features')].filter(g => g.querySelectorAll('.class-feature-chip').length > 1);
    const out = [];
    for (const g of groups) {
      const chips = [...g.querySelectorAll('.class-feature-chip')];
      const panels = [...g.querySelectorAll('.class-feature-panel')];
      const before = panels.findIndex(p => p.classList.contains('active'));
      chips[1].click();
      const activeIdx = panels.findIndex(p => p.classList.contains('active'));
      const activeCount = panels.filter(p => p.classList.contains('active')).length;
      const chipTxt = chips[1].textContent.trim();
      out.push({ id: g.id, chip: chipTxt, before, activeIdx, activeCount, ok: activeCount === 1 && activeIdx === 1 });
    }
    return out;
  });
  const bad = r.filter(x => !x.ok);
  if (bad.length) { fail++; errs.push(f + ' → ' + JSON.stringify(bad)); console.log('FAIL', f, JSON.stringify(bad)); }
  else { pass++; }
}
console.log(`\n职业专长切换回归: ${pass}P ${fail}F${errs.length ? ' | ' + errs.join(' ; ') : ''}`);
await browser.close();
process.exit(fail ? 1 : 0);

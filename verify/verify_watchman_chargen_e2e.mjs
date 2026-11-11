// 守望者创建页 E2E：起手套装 A–D 非空 + 创建页/面板 HP/FP 公式一致
import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const PORT = 8171;
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

// ===== 角色创建页 =====
{
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const errs = []; page.on('pageerror', e => errs.push(String(e.message)));
  await page.goto(`http://127.0.0.1:${PORT}/%E6%96%AF%E8%AF%BA%E5%BE%B7%E8%B7%91%E5%9B%A2/%E8%A7%92%E8%89%B2%E5%88%9B%E5%BB%BA%E9%A1%B5.html`);
  await page.waitForTimeout(500);
  const r = await page.evaluate(() => {
    const wd = CLASSES.find(c => c.name === '守望者');
    CHAR.className = '守望者'; CHAR.classData = wd; CHAR.keyAttr = '意志';
    CHAR.attrs = { 力量: 10, 敏捷: 10, 体质: 14, 智力: 10, 感知: 13, 魅力: 10, 意志: 14, 幸运: 10 };
    CHAR.selectedSkills = ['承重', '专注', '耐力', '自然'];
    CHAR.selectedFeatures = ['挫志打击', '警戒之眼'];
    CHAR.raceName = '人类'; CHAR.raceSize = '中型';
    CHAR.raceData = { name: '人类', '属性加成': {}, '生命值加成': 0, '疲劳值加成': 0 };
    CHAR.bgName = '测试'; CHAR.bgData = { name: '测试', '生命值加成': 0, '疲劳值加成': 0 };
    renderEquipStep(document.getElementById('stepContent'));
    const cards = [...document.querySelectorAll('#stepContent .card')].map(c => ({
      name: c.querySelector('.card-name')?.textContent.trim(),
      sub: c.querySelector('.card-sub')?.textContent.trim(),
    }));
    selectEquip(0);
    updateOverview();
    return {
      cards,
      overview: document.getElementById('ovContent')?.textContent.replace(/\s+/g, ' '),
      hpFormula: wd?.hp_formula,
      fpFormula: wd?.fp_formula,
    };
  });
  ok('守望者创建页无 JS 错误', errs.length === 0, errs.join('|'));
  ok('守望者起手套装显示 4 组', r.cards.length === 4, JSON.stringify(r.cards));
  ok('套装 A 为团队近卫套装', r.cards[0]?.sub?.includes('团队近卫') && r.cards[0]?.sub?.includes('25枚金币'), r.cards[0]?.sub);
  ok('套装 D 为荒野求生套装', r.cards[3]?.sub?.includes('荒野求生') && r.cards[3]?.sub?.includes('医疗包'), r.cards[3]?.sub);
  ok('创建页 HP 公式 = 12 + 体质调整值', r.hpFormula?.first === 12 && r.hpFormula?.level_up === 4, JSON.stringify(r.hpFormula));
  ok('创建页 FP 公式 = 8 + 意志调整值', r.fpFormula?.first === 8 && r.fpFormula?.level_up === 1, JSON.stringify(r.fpFormula));
  ok('创建页预览 HP=14（体质14） FP=10（意志14）', r.overview?.includes('HP: 14') && r.overview?.includes('FP: 10'), r.overview);
  await page.close();
}

// ===== 角色面板升级公式 =====
{
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const errs = []; page.on('pageerror', e => errs.push(String(e.message)));
  await page.goto(`http://127.0.0.1:${PORT}/%E6%96%AF%E8%AF%BA%E5%BE%B7%E8%B7%91%E5%9B%A2/%E8%A7%92%E8%89%B2%E9%9D%A2%E6%9D%BF.html`);
  await page.waitForTimeout(500);
  const r = await page.evaluate(() => {
    const hp = calcTotalHP('守望者', 1, '', 0, 14, '人类', 0, 0, '中型');
    const hp3 = calcTotalHP('守望者', 3, '', 0, 14, '人类', 0, 0, '中型');
    const fp = calcTotalFP('守望者', 1, '', 0, '意志', 14, '人类', 0);
    const fp3 = calcTotalFP('守望者', 3, '', 0, '意志', 14, '人类', 0);
    return { hp, hp3, fp, fp3 };
  });
  ok('面板加载无 JS 错误', errs.length === 0, errs.join('|'));
  ok('面板 HP 公式：1级=16（12+2体质+2人类）', r.hp === 16, String(r.hp));
  ok('面板 HP 公式：3级=28（16 + 2×(4+2)）', r.hp3 === 28, String(r.hp3));
  ok('面板 FP 公式：1级=10', r.fp === 10, String(r.fp));
  ok('面板 FP 公式：3级=12', r.fp3 === 12, String(r.fp3));
  await page.close();
}

await browser.close(); server.close();
console.log(`\n守望者创建页E2E: ${pass}P ${fail}F`);
process.exit(fail > 0 ? 1 : 0);

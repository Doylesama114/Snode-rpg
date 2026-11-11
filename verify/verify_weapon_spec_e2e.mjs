// 猎人武器专精 E2E：创建页按 docx 显示 5 类；面板按职业显示正确增益；旧档别名兼容
import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const PORT = 8162;
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

const CHARGEN_URL = `http://127.0.0.1:${PORT}/%E6%96%AF%E8%AF%BA%E5%BE%B7%E8%B7%91%E5%9B%A2/%E8%A7%92%E8%89%B2%E5%88%9B%E5%BB%BA%E9%A1%B5.html`;
const PANEL_URL = `http://127.0.0.1:${PORT}/%E6%96%AF%E8%AF%BA%E5%BE%B7%E8%B7%91%E5%9B%A2/%E8%A7%92%E8%89%B2%E9%9D%A2%E6%9D%BF.html`;

const HUNTER_CATS = ['长柄武器', '弓箭', '弓弩', '枪械', '简易武器'];
const WARRIOR_CATS = ['剑类', '斧类', '锤类', '长柄', '弓箭', '简易'];
const HUNTER_BONUS = {
  '长柄武器': '可通过单手持有长柄武器',
  '弓箭': '攻击命中检定值+2',
  '弓弩': '结算造成伤害值后+2',
  '枪械': '攻击未命中或伤害骰为1/2时可重掷一次并接受重掷结果',
  '简易武器': '每场战斗限一次:附赠动作基础攻击(无法以此施展技能)'
};

const browser = await chromium.launch({ headless: true });
let pass = 0, fail = 0;
function ok(name, cond, extra) {
  if (cond) { pass++; console.log('  ✅ ' + name); }
  else { fail++; console.log('  ❌ ' + name + (extra ? ' — ' + extra : '')); }
}

// ============ 创建页：类别与文案 ============
{
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const errs = [];
  page.on('pageerror', e => errs.push(String(e && e.message || e)));
  await page.goto(CHARGEN_URL);
  await page.waitForTimeout(700);
  ok('创建页加载无 JS 错误', errs.length === 0, errs.join(' | ').slice(0, 300));

  const readSpec = await page.evaluate((clsName) => {
    var idx = CLASSES.findIndex(c => c.name === clsName);
    selectClass(idx);
    var btns = Array.prototype.slice.call(document.querySelectorAll('#specChoiceArea .weapon-spec-btn'));
    return btns.map(b => ({ cat: b.getAttribute('data-spec'), title: b.getAttribute('title'), text: b.textContent }));
  }, '猎人');
  const hunterCats = readSpec.map(x => x.cat);
  ok('猎人武器专精类别 = docx 5 类', JSON.stringify(hunterCats) === JSON.stringify(HUNTER_CATS), JSON.stringify(readSpec));
  let bad = [];
  for (const item of readSpec) {
    if (HUNTER_BONUS[item.cat] && item.title !== HUNTER_BONUS[item.cat]) bad.push(item.cat + ':[' + item.title + ']');
  }
  ok('猎人每类增益文案与 docx 一致', bad.length === 0, bad.join('|'));
  ok('猎人不再出现战士专属类别', !hunterCats.includes('剑类') && !hunterCats.includes('斧类') && !hunterCats.includes('锤类'));

  const warrior = await page.evaluate(() => {
    var idx = CLASSES.findIndex(c => c.name === '战士');
    selectClass(idx);
    var btns = Array.prototype.slice.call(document.querySelectorAll('#specChoiceArea .weapon-spec-btn'));
    return btns.map(b => b.getAttribute('data-spec'));
  });
  ok('战士武器专精类别保持原 6 类', JSON.stringify(warrior) === JSON.stringify(WARRIOR_CATS), JSON.stringify(warrior));

  const aliases = await page.evaluate(() => ({
    a: normalizeHunterWeaponSpec('长柄'),
    b: normalizeHunterWeaponSpec('简易'),
    c: weaponSpecDefForClass('猎人').bonuses['弓弩']
  }));
  ok('猎人旧档别名：长柄→长柄武器，简易→简易武器', aliases.a === '长柄武器' && aliases.b === '简易武器');
  ok('猎人弓弩增益定义正确', aliases.c === HUNTER_BONUS['弓弩']);
  await page.close();
}

// ============ 面板：按职业选择正确增益 + 旧档兼容 ============
{
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const errs = [];
  page.on('pageerror', e => errs.push(String(e && e.message || e)));
  await page.goto(PANEL_URL);
  await page.waitForTimeout(700);
  const r = await page.evaluate(() => {
    state.classes = [{ name: '猎人', level: 1, keyAttr: '敏捷', styles: ['', '', '', ''] }, { name: '', level: 0, styles: ['', '', '', ''] }, { name: '', level: 0, styles: ['', '', '', ''] }];
    function renderWith(specs) {
      state.weapon_specs = specs;
      renderLangProfs();
      var el = document.getElementById('weapon-profs');
      return el ? el.textContent : 'NO_EL';
    }
    var out = {};
    out.hunterBolt = renderWith(['弓弩']);
    out.hunterLong = renderWith(['长柄']);
    out.hunterUnknown = renderWith(['剑类']);
    state.classes[0].name = '战士';
    out.warriorSword = renderWith(['剑类']);
    return out;
  });
  ok('面板猎人弓弩显示 docx 专精文案', r.hunterBolt.includes('弓弩') && r.hunterBolt.includes('结算造成伤害值后+2') && !r.hunterBolt.includes('命中检定+2'), r.hunterBolt);
  ok('面板猎人旧档 长柄 自动按 长柄武器 显示', r.hunterLong.includes('长柄武器') && r.hunterLong.includes('可通过单手持有长柄武器'), r.hunterLong);
  ok('面板猎人旧错误档 剑类 显示旧档提示', r.hunterUnknown.includes('剑类') && r.hunterUnknown.includes('旧档'), r.hunterUnknown);
  ok('面板战士剑类保持原增益', r.warriorSword.includes('剑类') && r.warriorSword.includes('近战伤害骰=1可重掷'), r.warriorSword);
  ok('面板无 JS 错误', errs.length === 0, errs.join(' | ').slice(0, 300));
  await page.close();
}

await browser.close();
server.close();
console.log(`\n猎人武器专精 E2E: ${pass}P ${fail}F`);
process.exit(fail ? 1 : 0);

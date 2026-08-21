// 武器熟练度 E2E：角色面板展示具体武器（docx 原文），创建页 CLASSES 与 docx 一致
import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const PORT = 8159;
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

const PANEL_URL = 'http://127.0.0.1:' + PORT + '/%E6%96%AF%E8%AF%BA%E5%BE%B7%E8%B7%91%E5%9B%A2/%E8%A7%92%E8%89%B2%E9%9D%A2%E6%9D%BF.html';
const CHARGEN_URL = 'http://127.0.0.1:' + PORT + '/%E6%96%AF%E8%AF%BA%E5%BE%B7%E8%B7%91%E5%9B%A2/%E8%A7%92%E8%89%B2%E5%88%9B%E5%BB%BA%E9%A1%B5.html';

const DOCX = {
  '战士': '全部武器',
  '蛮斗士': '除枪械武器外的全部武器',
  '圣骑士': '除枪械武器以外的全部武器',
  '法师': '法杖、魔棒、匕首、手弩、简易武器',
  '猎人': '猎刀、匕首、远程武器、长柄武器、简易武器',
  '牧师': '轻锤、匕首、简易武器',
  '游荡者': '刺剑、匕首、袖剑、手弩、火枪、简易武器',
  '德鲁伊': '猎刀、匕首、法杖、简易武器',
  '萨满祭司': '手斧、轻锤、匕首、拳刃、法杖、简易武器',
  '术士': '匕首、手弩、简易武器',
  '武僧': '拳刃、长柄武器、简易武器',
  '吟游诗人': '刺剑、匕首、手弩、火枪、简易武器',
  '魔契师': '匕首、手弩、魔棒、简易武器',
  '奇械师': '匕首、枪械武器、简易武器'
};

const browser = await chromium.launch({ headless: true });
let pass = 0, fail = 0;
function ok(name, cond, extra) {
  if (cond) { pass++; console.log('  ✅ ' + name); }
  else { fail++; console.log('  ❌ ' + name + (extra ? ' — ' + extra : '')); }
}
const displayOf = (s) => s.split('、').join(' · ');

// ============ 角色面板 ============
{
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const errs = [];
  page.on('pageerror', e => errs.push(String(e && e.message || e)));
  await page.goto(PANEL_URL);
  await page.waitForTimeout(600);
  ok('角色面板加载无 JS 错误', errs.length === 0, errs.join(' | ').slice(0, 300));

  const panel = await page.evaluate((docxMap) => {
    function mkState(className, extraWeapon) {
      return {
        name: '武器测试', race: '人类', hp: 10, fp: 8,
        attrs: { '力量': 10, '敏捷': 10, '体质': 10, '智力': 10, '感知': 10, '魅力': 10, '意志': 10, '幸运': 10 },
        classes: [{ name: className, level: 1, keyAttr: '力量' }, { name: '', level: 0 }, { name: '', level: 0 }],
        equipment: { '防具': [], '主手武器': [], '副手武器': [], '配饰': [], '背包': [], '杂物包': [], '旅行腰包': [], '材料包': [] },
        containerItems: {}, skills: [], special_feats: [], currency: {}, unlocked_tiers: [], class_levels: {},
        languages: ['通用语'], professionals: [], custom_profs: {},
        weapon_profs: extraWeapon || {}, weapon_prof_bonus: {}, armor_profs: {}, weapon_specs: [],
        profs: { '力量': { '承重': 0 } }
      };
    }
    var out = { visible: {}, legacy: {}, extra: {} };
    for (var name in docxMap) {
      var st = mkState(name);
      window.state = st;
      try { SB_renderLangRows(); } catch (e) { out.visible[name] = 'ERR:' + e.message; }
      var row = document.querySelector('.lang-row');
      var rows = document.querySelectorAll('.lang-row');
      for (var i = 0; i < rows.length; i++) {
        var label = rows[i].querySelector('.lr-label');
        if (label && label.textContent === '武器熟练') {
          row = rows[i];
          break;
        }
      }
      out.visible[name] = row ? row.querySelector('.lr-val').textContent.trim() : 'NO_ROW';
      try { renderLangProfs(); } catch (e) { out.legacy[name] = 'ERR:' + e.message; }
      var we = document.getElementById('weapon-profs');
      out.legacy[name] = we ? we.textContent.trim() : 'NO_EL';
    }
    // 专长/种族额外武器熟练仍追加
    var stExtra = mkState('游荡者', { '弓弩': 1 });
    window.state = stExtra;
    SB_renderLangRows();
    var rows = document.querySelectorAll('.lang-row');
    for (var j = 0; j < rows.length; j++) {
      var lb = rows[j].querySelector('.lr-label');
      if (lb && lb.textContent === '武器熟练') out.extra.value = rows[j].querySelector('.lr-val').textContent.trim();
    }
    return out;
  }, DOCX);

  let bad = [];
  for (const name in DOCX) {
    const expected = displayOf(DOCX[name]);
    const got = panel.visible[name];
    if (got !== expected) bad.push(name + ':期望[' + expected + ']实际[' + got + ']');
    const legacy = panel.legacy[name] || '';
    for (const token of DOCX[name].split('、')) {
      if (legacy.indexOf(token) < 0) bad.push(name + ':旧引擎缺[' + token + ']实际[' + legacy + ']');
    }
  }
  ok('面板武器熟练行：14 职业均显示 docx 具体武器', bad.length === 0, bad.slice(0, 5).join(' | '));
  ok('额外武器熟练（弓弩+1）仍追加显示', panel.extra.value && panel.extra.value.indexOf('弓弩') >= 0, JSON.stringify(panel.extra));
  await page.close();
}

// ============ 角色创建页 ============
{
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const errs = [];
  page.on('pageerror', e => errs.push(String(e && e.message || e)));
  await page.goto(CHARGEN_URL);
  await page.waitForTimeout(600);
  ok('角色创建页加载无 JS 错误', errs.length === 0, errs.join(' | ').slice(0, 300));

  const got = await page.evaluate(() => {
    var out = {};
    for (var i = 0; i < CLASSES.length; i++) out[CLASSES[i].name] = CLASSES[i]['武器'] || '';
    return out;
  });
  let cgBad = [];
  for (const name in DOCX) if (got[name] !== DOCX[name]) cgBad.push(name + ':期望[' + DOCX[name] + ']实际[' + got[name] + ']');
  ok('创建页 CLASSES：14 职业武器文案与 docx 一致', cgBad.length === 0, cgBad.join(' | '));
  await page.close();
}

await browser.close();
server.close();
console.log(`\n武器熟练度E2E: ${pass}P ${fail}F`);
process.exit(fail ? 1 : 0);

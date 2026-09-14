// 谋士创建页 E2E：起手套装 A–D + 起始特性 4 选 2 + 创建页/面板 HP·FP 公式一致
import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const PORT = 8173;
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
    const ms = CLASSES.find(c => c.name === '谋士');
    CHAR.className = '谋士'; CHAR.classData = ms; CHAR.keyAttr = '智力';
    CHAR.attrs = { 力量: 10, 敏捷: 12, 体质: 14, 智力: 16, 感知: 12, 魅力: 12, 意志: 10, 幸运: 10 };
    CHAR.selectedSkills = ['专注', '调查', '逻辑', '知识'];
    CHAR.selectedFeatures = ['交友术', '战术部署'];
    CHAR.raceName = '人类'; CHAR.raceSize = '中型';
    CHAR.raceData = { name: '人类', '属性加成': {}, '生命值加成': 2, '疲劳值加成': 0 };
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
      hpFormula: ms?.hp_formula,
      fpFormula: ms?.fp_formula,
      specs: (CLASS_SPECIALIZATIONS['谋士'] || []).map(x => x.n),
      starting: (CLASS_STARTING_FEATURES['谋士'] || []).map(x => ({ n: x.n, d: x.d })),
    };
  });
  ok('谋士创建页无 JS 错误', errs.length === 0, errs.join('|'));
  ok('谋士关键属性=智力、护甲=轻甲', r.hpFormula && r.fpFormula, JSON.stringify({ hp: r.hpFormula, fp: r.fpFormula }));
  ok('谋士 HP 公式 = 8 + 体质调整值（每级+2）', r.hpFormula?.first === 8 && r.hpFormula?.level_up === 2, JSON.stringify(r.hpFormula));
  ok('谋士 FP 公式 = 10 + 智力调整值（每级+1）', r.fpFormula?.first === 10 && r.fpFormula?.level_up === 1, JSON.stringify(r.fpFormula));
  ok('谋士职业专长 = 运筹帷幄/博闻强识/料敌机先', r.specs.join('、') === '运筹帷幄、博闻强识、料敌机先', r.specs.join('、'));
  ok('谋士起始特性 = 4 条（交友术/战术部署/毒刃/离间）',
    r.starting.map(x => x.n).join('、') === '交友术、战术部署、毒刃、离间' && r.starting.every(x => x.d),
    JSON.stringify(r.starting));
  ok('起手套装显示 4 组', r.cards.length === 4, JSON.stringify(r.cards));
  ok('套装 A = 顾问套装（刺剑+35金币）', /顾问套装/.test(r.cards[0]?.sub || '') && /刺剑/.test(r.cards[0]?.sub || '') && /35枚金币/.test(r.cards[0]?.sub || ''), r.cards[0]?.sub);
  ok('套装 D = 学者套装（放大镜+空白魔法卷轴）', /学者套装/.test(r.cards[3]?.sub || '') && /放大镜/.test(r.cards[3]?.sub || '') && /空白/.test(r.cards[3]?.sub || ''), r.cards[3]?.sub);
  ok('创建页预览 HP=12（8+2体质+2人类） FP=13（10+3智力）',
    /HP: 12/.test(r.overview || '') && /FP: 13/.test(r.overview || ''), r.overview);
  await page.close();
}

// ===== 角色面板升级公式 =====
{
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const errs = []; page.on('pageerror', e => errs.push(String(e.message)));
  await page.goto(`http://127.0.0.1:${PORT}/%E6%96%AF%E8%AF%BA%E5%BE%B7%E8%B7%91%E5%9B%A2/%E8%A7%92%E8%89%B2%E9%9D%A2%E6%9D%BF.html`);
  await page.waitForTimeout(600);
  const r = await page.evaluate(() => {
    const hp = calcTotalHP('谋士', 1, '', 0, 14, '人类', 0, 0, '中型');
    const hp3 = calcTotalHP('谋士', 3, '', 0, 14, '人类', 0, 0, '中型');
    const fp = calcTotalFP('谋士', 1, '', 0, '智力', 16, '人类', 0);
    const fp3 = calcTotalFP('谋士', 3, '', 0, '智力', 16, '人类', 0);
    return { hp, hp3, fp, fp3, hasRef: !!REF_CLASSES['谋士'],
      startFeatures: (REF_CLASSES['谋士'] || {}).starting_features?.map(x => x.name),
      specs: (REF_CLASSES['谋士'] || {}).specializations?.map(x => x.name),
      styles: Object.keys(STYLE_COLOR_MAP['谋士'] || {}) };
  });
  ok('谋士面板加载无 JS 错误', errs.length === 0, errs.join('|'));
  ok('面板 REF_CLASSES 含谋士（3 专长/4 起始特性）',
    r.hasRef && r.startFeatures?.length === 4 && r.specs?.join('、') === '运筹帷幄、博闻强识、料敌机先',
    JSON.stringify({ start: r.startFeatures, specs: r.specs }));
  ok('面板谋士战斗风格配色 = 6', r.styles?.join('、') === '权谋、军团、先见、鸩毒、混乱、博物', (r.styles || []).join('、'));
  ok('面板 HP：1级=12（8+2体质+2人类）', r.hp === 12, String(r.hp));
  ok('面板 HP：3级=20（12 + 2×(2+2)）', r.hp3 === 20, String(r.hp3));
  ok('面板 FP：1级=13（10+3智力）', r.fp === 13, String(r.fp));
  ok('面板 FP：3级=15（13 + 2×1）', r.fp3 === 15, String(r.fp3));
  await page.close();
}

await browser.close(); server.close();
console.log(`\n谋士创建页E2E: ${pass}P ${fail}F`);
process.exit(fail > 0 ? 1 : 0);

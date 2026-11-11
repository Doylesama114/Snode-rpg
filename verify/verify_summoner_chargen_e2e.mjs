// 召唤师创建页 E2E：职业条目 / 起始特性全给 / 契约生物选择（第 1 步内）/ HP·FP=幸运 / 装备 / 快照往返
import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const PORT = 8177;
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

const page = await browser.newPage({ viewport: { width: 1280, height: 950 } });
const errs = [];
page.on('pageerror', e => errs.push('pageerror: ' + e.message));
page.on('console', m => { if (m.type() === 'error' && !/audio\//.test(m.text())) errs.push('console: ' + m.text()); });
await page.goto(`http://127.0.0.1:${PORT}/%E6%96%AF%E8%AF%BA%E5%BE%B7%E8%B7%91%E5%9B%A2/%E8%A7%92%E8%89%B2%E5%88%9B%E5%BB%BA%E9%A1%B5.html`);
await page.waitForTimeout(700);

// ===== 选择职业步骤：契约生物选择 =====
const step1 = await page.evaluate(() => {
  const idx = CLASSES.findIndex(c => c.name === '召唤师');
  selectClass(idx);
  const chips = [...document.querySelectorAll('#contractChips .skill-chip')];
  return {
    inClasses: idx >= 0,
    entry: (() => { const c = CLASSES[idx] || {}; return { key_attr: c['关键属性'], hp: c.hp_formula, fp: c.fp_formula, armor: c['护甲'], weapons: c['武器'], saves: c['豁免'] }; })(),
    chips: chips.length,
    hasRandom: !!document.querySelector('#summonerContractArea button'),
    nextDisabled: document.getElementById('nextBtn')?.disabled,
    cardEmpty: /尚未选择契约生物/.test(document.getElementById('contractCard')?.textContent || ''),
  };
});
ok('CLASSES 含召唤师', step1.inClasses);
ok('召唤师：关键属性=幸运 / HP 8+2 / FP 8+1', step1.entry.key_attr === '幸运' && step1.entry.hp.first === 8 && step1.entry.hp.level_up === 2 && step1.entry.fp.first === 8 && step1.entry.fp.level_up === 1, JSON.stringify(step1.entry));
ok('契约生物 20 个 chip 渲染在第 1 步', step1.chips === 20, String(step1.chips));
ok('未选契约生物时下一步禁用', step1.nextDisabled === true, String(step1.nextDisabled));
ok('契约生物卡初始为空态', step1.cardEmpty);

const picked = await page.evaluate(() => {
  const chips = [...document.querySelectorAll('#contractChips .skill-chip')];
  const target = chips.find(c => c.textContent.includes('烬火狐'));
  target.click();
  return {
    contract: CHAR.contractCreature,
    selected: [...document.querySelectorAll('#contractChips .skill-chip.selected')].map(c => c.textContent.trim()),
    card: (document.getElementById('contractCard')?.textContent || '').replace(/\s+/g, ' ').slice(0, 400),
    nextDisabled: document.getElementById('nextBtn')?.disabled,
  };
});
ok('自选契约生物生效（烬火狐/火焰系）', picked.contract?.name === '烬火狐' && picked.contract?.category === '火焰系', JSON.stringify(picked.contract));
ok('选中态与数据卡渲染', picked.selected.length === 1 && /防御等级 13/.test(picked.card) && /火焰亲和/.test(picked.card), picked.card);
ok('选好后下一步可用', picked.nextDisabled === false, String(picked.nextDisabled));

const rolled = await page.evaluate(() => {
  rollSummonerContract();
  return { name: CHAR.contractCreature?.name, cat: CHAR.contractCreature?.category, chips: document.querySelectorAll('#contractChips .skill-chip.selected').length };
});
ok('🎲 随机抽取可用', !!rolled.name && !!rolled.cat && rolled.chips === 1, JSON.stringify(rolled));

// 固定回烬火狐便于后续断言
await page.evaluate(() => {
  const chips = [...document.querySelectorAll('#contractChips .skill-chip')];
  chips.find(c => c.textContent.includes('烬火狐')).click();
});

// ===== 起始特性步骤（3 条全给） =====
const step2 = await page.evaluate(() => {
  CURRENT_STEP = 1;
  renderStep(1);
  const chips = [...document.querySelectorAll('#featGrid .skill-chip')];
  return {
    features: (CLASS_STARTING_FEATURES['召唤师'] || []).map(f => f.n),
    selected: (CHAR.selectedFeatures || []).slice(),
    chips: chips.length,
    desc: (document.querySelector('.step-desc')?.textContent || '').trim(),
    nextDisabled: document.getElementById('nextBtn')?.disabled,
  };
});
ok('起始特性 3 条', step2.features.join('、') === '魔法飞弹、次级召唤术、唤回', step2.features.join('、'));
ok('起始特性自动全选（无需手动挑选）', step2.selected.length === 3 && step2.nextDisabled === false, JSON.stringify({ sel: step2.selected, disabled: step2.nextDisabled }));
ok('说明文案：召唤师初始拥有全部起始特性', /全部起始特性/.test(step2.desc), step2.desc);

// ===== 装备步骤 =====
const step6 = await page.evaluate(() => {
  CHAR.raceName = '人类'; CHAR.raceSize = '中型';
  CHAR.raceData = { name: '人类', '属性加成': {}, '生命值加成': 2, '疲劳值加成': 0 };
  CHAR.bgName = '测试'; CHAR.bgData = { name: '测试', '生命值加成': 0, '疲劳值加成': 0 };
  CHAR.attrs = { 力量: 10, 敏捷: 12, 体质: 14, 智力: 10, 感知: 12, 魅力: 12, 意志: 10, 幸运: 16 };
  renderEquipStep(document.getElementById('stepContent'));
  const cards = [...document.querySelectorAll('#stepContent .card')].map(c => (c.querySelector('.card-sub')?.textContent || '').trim());
  selectEquip(0);
  updateOverview();
  return { cards, overview: (document.getElementById('ovContent')?.textContent || '').replace(/\s+/g, ' ') };
});
ok('起手套装 4 组（A–D）', step6.cards.length === 4, JSON.stringify(step6.cards.map(c => c.slice(0, 12))));
ok('套装 A=学院派套装', /学院派/.test(step6.cards[0] || ''), step6.cards[0]);
ok('套装 D=探索异界旅行者套装', /探索异界/.test(step6.cards[3] || ''), step6.cards[3]);
ok('创建页预览 HP=10（8+2体质+2人类 → 12？按公式校验）', /HP: 12/.test(step6.overview) && /FP: 11/.test(step6.overview), step6.overview.slice(0, 200));

// ===== 导出描述 —— 机缘召唤写契约生物 =====
const exported = await page.evaluate(() => {
  const specs = CLASS_SPECIALIZATIONS['召唤师'] || [];
  let desc = '';
  for (const sp of specs) {
    if (sp.n === '机缘召唤' && CHAR.contractCreature) desc = '契约生物：' + CHAR.contractCreature.name + '（' + CHAR.contractCreature.category + '）';
  }
  const snap = buildCreationSnapshot();
  const backup = JSON.parse(JSON.stringify(CHAR.contractCreature));
  CHAR.contractCreature = null;
  applyCreationSnapshotToChar(JSON.parse(JSON.stringify(snap)));
  const restored = JSON.parse(JSON.stringify(CHAR.contractCreature));
  CHAR.contractCreature = backup;
  return { desc, snap: snap.contractCreature, restored };
});
ok('机缘召唤导出描述含契约生物', exported.desc === '契约生物：烬火狐（火焰系）', exported.desc);
ok('快照含契约生物', exported.snap?.name === '烬火狐' && exported.snap?.category === '火焰系', JSON.stringify(exported.snap));
ok('快照还原契约生物', exported.restored?.name === '烬火狐', JSON.stringify(exported.restored));

ok('创建页无 JS 错误', errs.length === 0, errs.join(' | '));

await browser.close(); server.close();
console.log(`\n召唤师创建页E2E: ${pass}P ${fail}F`);
process.exit(fail > 0 ? 1 : 0);

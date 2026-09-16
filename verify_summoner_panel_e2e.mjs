// 召唤师面板 E2E：SKILL_DATA / 风格配色 / 起始特性映射 / 契约生物卡（含等级·羁绊点数）
import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const PORT = 8181;
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8' };
const server = http.createServer((req, res) => {
  try {
    let p = decodeURIComponent(req.url.split('?')[0]);
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

const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const errs = [];
page.on('pageerror', e => errs.push('pageerror: ' + e.message));
page.on('console', m => { if (m.type() === 'error' && !/audio\//.test(m.text())) errs.push('console: ' + m.text()); });
await page.goto(`http://127.0.0.1:${PORT}/%E6%96%AF%E8%AF%BA%E5%BE%B7%E8%B7%91%E5%9B%A2/%E8%A7%92%E8%89%B2%E9%9D%A2%E6%9D%BF.html`);
await page.waitForTimeout(800);

const base = await page.evaluate(() => {
  const ms = SKILL_DATA['召唤师'] || [];
  return {
    skillCount: ms.length,
    styles: [...new Set(ms.map(s => s.style).filter(Boolean))],
    starting: ms.filter(s => s.type === 'starting').map(s => s.name),
    colors: Object.keys(STYLE_COLOR_MAP['召唤师'] || {}),
    override: STARTING_STYLE_OVERRIDE['召唤师'] || null,
    ref: (() => { const r = REF_CLASSES['召唤师'] || {}; return { key_attr: r.key_attr, weapons: r.weapons, saves: r.saves, specs: (r.specializations || []).map(x => x.name), starts: (r.starting_features || []).map(x => x.name) }; })(),
    creatures: (typeof CONTRACT_CREATURES !== 'undefined' ? CONTRACT_CREATURES.length : 0),
  };
});
ok('SKILL_DATA.召唤师 = 47 条', base.skillCount === 47, String(base.skillCount));
ok('风格 = 咒法/降灵', base.styles.join('、') === '咒法、降灵', base.styles.join('、'));
ok('起始特性 = 魔法飞弹/次级召唤术/唤回', base.starting.join('、') === '魔法飞弹、次级召唤术、唤回', base.starting.join('、'));
ok('风格配色 2 项', base.colors.join('、') === '咒法、降灵', base.colors.join('、'));
ok('起始特性风格映射', base.override && base.override['魔法飞弹'] === '咒法' && base.override['唤回'] === '降灵', JSON.stringify(base.override));
ok('REF_CLASSES：幸运/轻甲/17 职业', base.ref.key_attr === '幸运' && base.ref.weapons.includes('手弩') && base.ref.specs.length === 3 && base.ref.starts.length === 3, JSON.stringify(base.ref));
ok('面板加载契约生物数据 20 条', base.creatures === 20, String(base.creatures));

const card = await page.evaluate(() => {
  // 构造一个召唤师角色（职业特性里的机缘召唤带契约生物）
  state.classes[0] = { name: '召唤师', level: 1, keyAttr: '幸运', styles: ['', '', '', ''] };
  state.class_features = [
    { name: '召唤联结', desc: '与契约生物存在深层联结（召唤师）' },
    { name: '异界感知', desc: '感知周围的异界魔法效应（召唤师）' },
    { name: '机缘召唤', desc: '契约生物：烬火狐（火焰系）' },
  ];
  state.contract = null;
  state.racial_traits = state.racial_traits || [];
  renderTraits();
  const box = document.getElementById('classTraits') || document.getElementById('class-features');
  const html = box ? box.innerHTML : '';
  return {
    hasCard: /契约生物 · 烬火狐/.test(html),
    hasAC: /防御等级 13/.test(html),
    hasTrait: /火焰亲和/.test(html),
    hasLevelInput: /onchange="setContractLevel/.test(html),
    hasBondInput: /onchange="setContractBond/.test(html),
    contract: state.contract,
  };
});
ok('契约生物卡渲染（名称/AC/特性）', card.hasCard && card.hasAC && card.hasTrait, JSON.stringify(card).slice(0, 200));
ok('契约卡含等级/羁绊点数输入框', card.hasLevelInput && card.hasBondInput);
ok('契约状态初始化（等级 1 / 羁绊 0）', card.contract?.name === '烬火狐' && card.contract?.level === 1 && card.contract?.bond === 0, JSON.stringify(card.contract));

const edited = await page.evaluate(() => {
  setContractLevel('7');
  setContractBond('12');
  const html = (document.getElementById('classTraits') || document.getElementById('class-features')).innerHTML;
  return { level: state.contract.level, bond: state.contract.bond, valueLevel: /value="7"/.test(html), valueBond: /value="12"/.test(html) };
});
ok('手填等级/羁绊点数生效并回显', edited.level === 7 && edited.bond === 12 && edited.valueLevel && edited.valueBond, JSON.stringify(edited));

const dice = await page.evaluate(() => {
  const zl = (SKILL_DATA['召唤师'] || []).find(x => x.name === '咒灵召唤');
  const html = formatSkillDetailHtml(zl);
  const hh = (SKILL_DATA['召唤师'] || []).find(x => x.name === '召唤火元素');
  const unitHtml = formatSkillDetailHtml(hh).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
  return {
    rollRows: (zl.roll_tables || []).length,
    hasTable: /<table/.test(html) && html.includes('100'),
    hasIntro: html.includes('D100'),
    unitName: /召唤单位： 火元素/.test(unitHtml) || /召唤单位：火元素/.test(unitHtml),
    unitHead: /中型元素生物/.test(unitHtml) && /防御等级 10/.test(unitHtml),
  };
});
ok('面板骰表：13 行 + 100 + 施法说明', dice.hasTable && dice.rollRows === 13 && dice.hasIntro, JSON.stringify(dice));
ok('面板召唤单位卡：名称/类型/防御等级', dice.unitName && dice.unitHead, JSON.stringify(dice));

const learned = await page.evaluate(() => {
  for (const k of Object.keys(state.color_marks)) state.color_marks[k] = true;
  state.sp_points = 99;
  state.unlocked_tiers = ['一阶', '二阶', '三阶'];
  state.skills = [];
  learnSkill('召唤师', '契约指令·攻击', 0);
  autoCalcStyles();
  return state.skills.map(x => ({ n: x.n, src: x.src }));
});
ok('面板可学习召唤师技能', learned.some(x => x.n === '契约指令·攻击' && x.src === '召唤师'), JSON.stringify(learned));

await page.screenshot({ path: '_shot_summoner_m7_panel.png' });
ok('面板无 JS 错误', errs.length === 0, errs.join(' | '));

await browser.close(); server.close();
console.log(`\n召唤师面板E2E: ${pass}P ${fail}F`);
process.exit(fail > 0 ? 1 : 0);

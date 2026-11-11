// 龙裔详情 E2E：创建页龙种选择/导出文案 + 面板特性显示（速度 5 米 / 吐息 XD6 / 抗性 2 点）
import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const PORT = 8189;
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8' };
const server = http.createServer((req, res) => {
  try {
    const p = decodeURIComponent(req.url.split('?')[0]);
    const data = fs.readFileSync(path.join(ROOT, p.slice(1)));
    res.writeHead(200, { 'Content-Type': MIME[path.extname(p)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    res.end(data);
  } catch (e) { res.writeHead(404); res.end(); }
});
await new Promise(r => server.listen(PORT, '127.0.0.1', r));

const browser = await chromium.launch({ headless: true });
let pass = 0, fail = 0;
function ok(name, cond, extra) { if (cond) { pass++; console.log('PASS', name); } else { fail++; console.log('FAIL', name, extra || ''); } }

// ===== 创建页 =====
{
  const page = await browser.newPage({ viewport: { width: 1280, height: 950 } });
  const errs = [];
  page.on('pageerror', e => errs.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error' && !/audio\//.test(m.text())) errs.push('console: ' + m.text()); });
  await page.goto(`http://127.0.0.1:${PORT}/%E6%96%AF%E8%AF%BA%E5%BE%B7%E8%B7%91%E5%9B%A2/%E8%A7%92%E8%89%B2%E5%88%9B%E5%BB%BA%E9%A1%B5.html`);
  await page.waitForTimeout(700);

  // 进入「选择种族」步骤（渲染 raceDetail/raceGrid，不点击导航按钮）
  await page.evaluate(() => { CURRENT_STEP = 2; renderStep(2); });
  await page.waitForTimeout(200);
  errs.length = 0;

  const r = await page.evaluate(() => {
    const idx = RACES.findIndex(x => x.name === '龙裔');
    CHAR.raceIdx = idx; CHAR.raceName = '龙裔'; CHAR.raceData = RACES[idx];
    // 真实渲染龙种选择器（点击回调会触发 checkRv/updateOverview，需最终步骤 DOM；此处用桩避免夹具噪声）
    window.checkRv = function () {};
    window.updateOverview = function () {};
    showDragonTypeChoice(CHAR.raceData);
    const buttons = [...document.querySelectorAll('#dragonTypeArea .spec-btn')];
    const pickAndRead = (nm) => {
      const b = buttons.find(x => x.textContent.trim() === nm);
      b.click();
      const v = { breath: CHAR.dragonBreath, resistance: CHAR.dragonResistance, selected: !!b.classList.contains('selected') };
      b.click(); // 取消选择
      return v;
    };
    const picks = { 赤铜龙: pickAndRead('赤铜龙'), 金龙: pickAndRead('金龙'), 绿龙: pickAndRead('绿龙') };
    buttons.find(x => x.textContent.trim() === '赤铜龙').click();  // 固定赤铜龙
    const tmap = {};
    DRAGON_TYPES.forEach(d => { tmap[d.name] = [d.breath, d.resistance]; });
    const rd = CHAR.raceData || {};
    const traits = (rd['特性'] || []).map(t => {
      let desc = t.desc;
      if (t.name.includes('龙族血脉') && CHAR.dragonType) desc = '龙种：' + CHAR.dragonType;
      else if (t.name.includes('巨龙吐息') && CHAR.dragonBreath) desc = '吐息：' + CHAR.dragonBreath + '（XD6，X=角色等级）';
      else if (t.name.includes('传承抗性') && CHAR.dragonResistance) desc = '抗性：' + CHAR.dragonResistance;
      return { name: t.name, desc };
    });
    return {
      raceName: rd.name, speed: rd['基础移动力'], pickCount: buttons.length,
      dragonCount: DRAGON_TYPES.length, tmap,
      hint: document.querySelector('#dragonTypeArea div:nth-child(2)')?.textContent || '',
      picks, traits, languages: RACE_LANGS['龙裔'],
      raceIdx: CHAR.raceIdx, gatedBy: /龙裔/.test(String(CHAR.raceName)),
    };
  });
  ok('龙裔种族详情：基础移动力 5 米', r.speed === '5米', String(r.speed));
  ok('龙种可选 10 项', r.dragonCount === 10 && r.pickCount === 10, `${r.dragonCount}/${r.pickCount}`);
  ok('赤铜龙 → 强酸 / 强酸（2 点）', r.picks['赤铜龙']?.breath === '强酸' && r.picks['赤铜龙']?.resistance === '强酸（2 点）', JSON.stringify(r.picks['赤铜龙']));
  ok('金龙 → 火焰', r.picks['金龙']?.breath === '火焰', JSON.stringify(r.picks['金龙']));
  const expectMap = { 红龙: '火焰', 金龙: '火焰', 蓝龙: '雷电', 银龙: '奥术', 绿龙: '剧毒', 青铜龙: '雷电', 黑龙: '强酸', 黄铜龙: '火焰', 白龙: '冰冻', 赤铜龙: '强酸' };
  const badMap = Object.entries(expectMap).filter(([n, d]) => (r.tmap[n] || [])[0] !== d || (r.tmap[n] || [])[1] !== d + '（2 点）');
  ok('10 龙种伤害/抗性映射正确', badMap.length === 0, JSON.stringify(badMap));
  ok('绿龙 → 剧毒（术语对齐）', r.picks['绿龙']?.breath === '剧毒', JSON.stringify(r.picks['绿龙']));
  ok('提示说明黑龙/赤铜龙为强酸 + XD6', /强酸/.test(r.hint) && /XD6/.test(r.hint), r.hint);
  ok('导出：龙种/吐息（XD6）/抗性（2 点）', r.traits.some(t => t.desc === '龙种：赤铜龙')
    && r.traits.some(t => /吐息：强酸（XD6/.test(t.desc))
    && r.traits.some(t => t.desc === '抗性：强酸（2 点）'), JSON.stringify(r.traits.map(t => t.desc)));
  ok('语言 = 通用语 + 龙语', (r.languages || []).join('、') === '通用语、龙语', JSON.stringify(r.languages));
  ok('创建页无 JS 错误', errs.length === 0, errs.join(' | '));
  await page.close();
}

// ===== 面板 =====
{
  const page = await browser.newPage({ viewport: { width: 1280, height: 950 } });
  const errs = [];
  page.on('pageerror', e => errs.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error' && !/audio\//.test(m.text())) errs.push('console: ' + m.text()); });
  await page.goto(`http://127.0.0.1:${PORT}/%E6%96%AF%E8%AF%BA%E5%BE%B7%E8%B7%91%E5%9B%A2/%E8%A7%92%E8%89%B2%E9%9D%A2%E6%9D%BF.html`);
  await page.waitForTimeout(800);
  const r = await page.evaluate(() => {
    const ref = REF_RACES['龙裔'] || {};
    state.race = '龙裔'; state.raceSize = '中型';
    state.classes[0] = { name: '战士', level: 3, keyAttr: '力量', styles: ['斗争', '狂攻', '', ''] };
    state.dragonType = '赤铜龙'; state.dragonBreath = '强酸'; state.dragonResistance = '强酸（2 点）';
    state.racial_traits = [];
    const feats = exportRacialTraits(state).map(f => f.name + '｜' + f.desc);
    // 速度导出（面板 L9 逻辑同源）
    return { speed: ref.speed, talents: (ref.talents || []).map(t => t.name), feats };
  });
  ok('REF_RACES 速度 5 米', r.speed === '5米', String(r.speed));
  ok('面板种族特性 3 条', r.talents.join('、') === '龙族血脉、巨龙吐息、传承抗性', r.talents.join('、'));
  ok('面板吐息按等级显示 3D6', r.feats.some(f => /吐息：强酸（3D6 · X=角色等级）/.test(f)), JSON.stringify(r.feats));
  ok('面板抗性显示 2 点', r.feats.some(f => /抗性：强酸（2 点）/.test(f)), JSON.stringify(r.feats));
  ok('面板龙种显示赤铜龙', r.feats.some(f => /龙种：赤铜龙/.test(f)), JSON.stringify(r.feats));
  ok('面板无 JS 错误', errs.length === 0, errs.join(' | '));
  await page.close();
}

await browser.close(); server.close();
console.log(`\n龙裔详情E2E: ${pass}P ${fail}F`);
process.exit(fail > 0 ? 1 : 0);

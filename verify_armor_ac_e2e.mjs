// 护甲/防御等级规则 E2E：所有装备型护甲敏捷加成上限 +2，面板/导出/角色创建页一致
import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import * as XLSX from 'xlsx';

const ROOT = process.cwd();
const PORT = 8158;
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8' };
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

const PANEL_URL = 'http://127.0.0.1:' + PORT + '/%E6%96%AF%E8%AF%BA%E5%BE%B7%E8%B7%91%E5%9B%A2/%E8%A7%92%E8%89%B2%E9%9D%A2%E6%9D%BF.html';
const CHARGEN_URL = 'http://127.0.0.1:' + PORT + '/%E6%96%AF%E8%AF%BA%E5%BE%B7%E8%B7%91%E5%9B%A2/%E8%A7%92%E8%89%B2%E5%88%9B%E5%BB%BA%E9%A1%B5.html';

const browser = await chromium.launch({ headless: true });
let pass = 0, fail = 0;
function ok(name, cond, extra) {
  if (cond) { pass++; console.log('  ✅ ' + name); }
  else { fail++; console.log('  ❌ ' + name + (extra ? ' — ' + extra : '')); }
}

// 敏捷 16(+3) 与 20(+5) 的期望矩阵
const EXPECT_DEX16 = { '布衣': 13, '皮甲': 13, '兽皮甲': 14, '鳞甲': 16, '胸甲': 16, '半身板甲': 17, '链甲': 16, '板甲': 18 };
const EXPECT_DEX20 = { '布衣': 13, '皮甲': 13, '兽皮甲': 14, '鳞甲': 16, '胸甲': 16, '半身板甲': 17, '链甲': 16, '板甲': 18 };

function readL7(b64) {
  const wb = XLSX.read(Buffer.from(b64, 'base64'), { type: 'buffer' });
  const sh = wb.Sheets[wb.SheetNames[0]];
  const cell = sh && sh['L7'];
  return cell ? parseInt(cell.v, 10) : NaN;
}

// ============ 角色面板 ============
{
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const errs = [];
  page.on('pageerror', e => errs.push(String(e && e.message || e)));
  await page.goto(PANEL_URL);
  await page.waitForTimeout(600);
  ok('角色面板加载无 JS 错误', errs.length === 0, errs.join(' | ').slice(0, 300));

  const panelEval = await page.evaluate(({ exp16, exp20 }) => {
    function mkState(dex, armorItems, extra) {
      var st = {
        name: 'AC测试', race: '人类', hp: 12, fp: 8,
        attrs: { '力量': 10, '敏捷': dex, '体质': 10, '智力': 10, '感知': 10, '魅力': 10, '意志': 10, '幸运': 10 },
        classes: [{ name: '战士', level: 1, keyAttr: '力量' }, { name: '', level: 0 }, { name: '', level: 0 }],
        equipment: { '防具': armorItems.slice(), '主手武器': [], '副手武器': [], '配饰': [], '背包': [], '杂物包': [], '旅行腰包': [], '材料包': [] },
        containerItems: {}, skills: [], special_feats: [], currency: {}, unlocked_tiers: [], class_levels: {}
      };
      if (extra) for (var k in extra) st[k] = extra[k];
      return st;
    }
    var out = { caps: [], visibleDex16: {}, visibleDex20: {}, shield: {}, medium: {}, clothing: {}, unarmored: {} };
    var dexArmors = ['布衣', '皮甲', '兽皮甲', '鳞甲', '胸甲', '半身板甲'];
    for (var i = 0; i < dexArmors.length; i++) {
      var a = getArmorAC(dexArmors[i]);
      out.caps.push({ name: dexArmors[i], cap: a && a.dexCap, addDex: a && a.addDex });
    }
    out.caps.push({ name: '链甲', cap: getArmorAC('链甲').dexCap, addDex: getArmorAC('链甲').addDex });
    out.caps.push({ name: '板甲', cap: getArmorAC('板甲').dexCap, addDex: getArmorAC('板甲').addDex });
    for (var dex in { '16': exp16, '20': exp20 }) {
      var d = parseInt(dex, 10);
      for (var armor in (d === 16 ? exp16 : exp20)) {
        var st = mkState(d, [{ item: armor }]);
        window.state = st;
        var t = SB_buildTestData(st);
        var computed = t && t.battle && t.battle.ac;
        try { window.render(); } catch (e) { computed = 'RENDER_ERR:' + e.message; }
        var dom = document.getElementById('bgAc') ? document.getElementById('bgAc').textContent : '';
        if (d === 16) out.visibleDex16[armor] = { computed: computed, dom: dom };
        else out.visibleDex20[armor] = { computed: computed, dom: dom };
      }
    }
    var stWood = mkState(16, [{ item: '皮甲' }, { item: '木质盾牌' }]);
    window.state = stWood;
    out.shield.wood = { bonus: getShieldBonus(stWood), ac: SB_buildTestData(stWood).battle.ac };
    var stMetal = mkState(16, [{ item: '皮甲' }, { item: '金属盾牌' }]);
    window.state = stMetal;
    out.shield.metal = { bonus: getShieldBonus(stMetal), ac: SB_buildTestData(stMetal).battle.ac };
    var stHide = mkState(16, [{ item: '兽皮甲' }], { _feat_ac_bonus: 1 });
    window.state = stHide;
    out.medium = { isMedium: wearingMediumArmor(), acWithFeat: SB_buildTestData(stHide).battle.ac };
    var stCloth = mkState(20, [{ item: '演出戏服' }]);
    window.state = stCloth;
    out.clothing = SB_buildTestData(stCloth).battle.ac;
    var stNone = mkState(20, []);
    window.state = stNone;
    out.unarmored = SB_buildTestData(stNone).battle.ac;
    return out;
  }, { exp16: EXPECT_DEX16, exp20: EXPECT_DEX20 });

  const capBad = panelEval.caps.filter(c => c.name !== '链甲' && c.name !== '板甲' ? (c.cap !== 2 || !c.addDex) : (c.cap !== undefined || c.addDex !== false));
  ok('面板数据表：所有敏捷护甲 dexCap=2，重甲不加敏捷', capBad.length === 0, JSON.stringify(capBad));

  let matrixBad = [];
  for (const armor in EXPECT_DEX16) {
    const got = panelEval.visibleDex16[armor];
    if (!got || got.computed !== EXPECT_DEX16[armor] || String(got.dom) !== String(EXPECT_DEX16[armor])) matrixBad.push(armor + ':期望' + EXPECT_DEX16[armor] + '实际' + JSON.stringify(got));
  }
  for (const armor in EXPECT_DEX20) {
    const got = panelEval.visibleDex20[armor];
    if (!got || got.computed !== EXPECT_DEX20[armor]) matrixBad.push(armor + ':期望' + EXPECT_DEX20[armor] + '实际' + JSON.stringify(got));
  }
  ok('面板可见 AC 全护甲矩阵（敏捷16/20）正确', matrixBad.length === 0, matrixBad.slice(0, 6).join(' | '));
  ok('盾牌加成：木质+1、金属+2 且面板计入', panelEval.shield.wood.bonus === 1 && panelEval.shield.wood.ac === 14 && panelEval.shield.metal.bonus === 2 && panelEval.shield.metal.ac === 15, JSON.stringify(panelEval.shield));
  ok('兽皮甲判定为中甲并计入中甲专长', panelEval.medium.isMedium === true && panelEval.medium.acWithFeat === 15, JSON.stringify(panelEval.medium));
  ok('服装兜底：演出戏服敏捷上限+2（20敏→13）', panelEval.clothing === 13, String(panelEval.clothing));
  ok('不着甲仍为 10+全额敏捷（20敏→15）', panelEval.unarmored === 15, String(panelEval.unarmored));

  // 旧引擎 renderBattleStats 同步修正：鳞甲16 + 金属盾牌2 = 18
  const legacyAc = await page.evaluate(() => {
    var st = {
      name: 'AC测试', race: '人类', hp: 12, fp: 8,
      attrs: { '力量': 10, '敏捷': 16, '体质': 10, '智力': 10, '感知': 10, '魅力': 10, '意志': 10, '幸运': 10 },
      classes: [{ name: '战士', level: 1, keyAttr: '力量' }, { name: '', level: 0 }, { name: '', level: 0 }],
      equipment: { '防具': [{ item: '鳞甲' }, { item: '金属盾牌' }], '主手武器': [], '副手武器': [], '配饰': [], '背包': [], '杂物包': [], '旅行腰包': [], '材料包': [] },
      containerItems: {}, skills: [], special_feats: [], currency: {}, unlocked_tiers: [], class_levels: {}
    };
    window.state = st;
    try { renderBattleStats(); } catch (e) { return 'ERR:' + e.message; }
    var items = document.getElementById('stat-row').querySelectorAll('.stat-item');
    for (var i = 0; i < items.length; i++) if (items[i].innerText.indexOf('防御等级') === 0) return items[i].innerText.replace(/[^0-9]/g, '');
    return 'NOT_FOUND';
  });
  ok('旧引擎 renderBattleStats：护甲上限+盾牌 = 18', legacyAc === '18', legacyAc);

  // 面板 XLSX 导出 L7（鳞甲+金属盾牌=18）
  const panelB64 = await page.evaluate(async () => {
    var st = {
      name: 'AC测试', race: '人类', hp: 12, fp: 8,
      attrs: { '力量': 10, '敏捷': 16, '体质': 10, '智力': 10, '感知': 10, '魅力': 10, '意志': 10, '幸运': 10 },
      classes: [{ name: '战士', level: 1, keyAttr: '力量' }, { name: '', level: 0 }, { name: '', level: 0 }],
      equipment: { '防具': [{ item: '鳞甲' }, { item: '金属盾牌' }], '主手武器': [], '副手武器': [], '配饰': [], '背包': [], '杂物包': [], '旅行腰包': [], '材料包': [] },
      containerItems: {}, skills: [], special_feats: [], currency: {}, unlocked_tiers: [], class_levels: []
    };
    window.state = st;
    window.__acBlob = null;
    var oldCreate = URL.createObjectURL, oldRevoke = URL.revokeObjectURL;
    URL.createObjectURL = function (b) { window.__acBlob = b; return '#'; };
    URL.revokeObjectURL = function () {};
    try { await exportXlsxFromState(window.state); } catch (e) { return 'ERR:' + e.message; }
    if (!window.__acBlob) return 'ERR:NO_BLOB';
    var buf = new Uint8Array(await window.__acBlob.arrayBuffer());
    var s = '', chunk = 0x8000;
    for (var i = 0; i < buf.length; i += chunk) s += String.fromCharCode.apply(null, buf.subarray(i, i + chunk));
    URL.createObjectURL = oldCreate; URL.revokeObjectURL = oldRevoke;
    return btoa(s);
  });
  ok('面板 XLSX 导出 AC = 18', panelB64.indexOf('ERR:') !== 0 && readL7(panelB64) === 18, panelB64.slice(0, 80));
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

  const cg = await page.evaluate(({ exp16, exp20 }) => {
    function mkState(dex, armorItems, extra) {
      var st = {
        name: 'AC测试', race: '人类',
        attrs: { '力量': 10, '敏捷': dex, '体质': 10, '智力': 10, '感知': 10, '魅力': 10, '意志': 10, '幸运': 10 },
        classes: [{ name: '战士', level: 1, keyAttr: '力量' }, { name: '', level: 0 }, { name: '', level: 0 }],
        equipment: { '防具': armorItems.slice(), '主手武器': [], '副手武器': [], '配饰': [], '背包': [], '杂物包': [], '旅行腰包': [], '材料包': [] }
      };
      if (extra) for (var k in extra) st[k] = extra[k];
      return st;
    }
    var out = { dex16: {}, dex20: {}, shield: {}, medium: {}, clothing: {}, unarmored: {} };
    for (var dex in { '16': exp16, '20': exp20 }) {
      var d = parseInt(dex, 10);
      for (var armor in (d === 16 ? exp16 : exp20)) {
        if (d === 16) out.dex16[armor] = charCalcAC(mkState(d, [{ item: armor }]));
        else out.dex20[armor] = charCalcAC(mkState(d, [{ item: armor }]));
      }
    }
    var stWood = mkState(16, [{ item: '皮甲' }, { item: '木质盾牌' }]);
    out.shield.wood = { bonus: charGetShieldBonus(stWood), ac: charCalcAC(stWood) };
    var stMetal = mkState(16, [{ item: '皮甲' }, { item: '金属盾牌' }]);
    out.shield.metal = { bonus: charGetShieldBonus(stMetal), ac: charCalcAC(stMetal) };
    var stHide = mkState(16, [{ item: '兽皮甲' }], { _feat_ac_bonus: 1 });
    out.medium = { isMedium: charWearingMediumArmor(stHide), acWithFeat: charCalcAC(stHide) };
    out.clothing = charCalcAC(mkState(20, [{ item: '演出戏服' }]));
    out.unarmored = charCalcAC(mkState(20, []));
    return out;
  }, { exp16: EXPECT_DEX16, exp20: EXPECT_DEX20 });

  let cgBad = [];
  for (const armor in EXPECT_DEX16) if (cg.dex16[armor] !== EXPECT_DEX16[armor]) cgBad.push(armor + ':' + cg.dex16[armor]);
  for (const armor in EXPECT_DEX20) if (cg.dex20[armor] !== EXPECT_DEX20[armor]) cgBad.push(armor + ':' + cg.dex20[armor]);
  ok('创建页 AC 计算全护甲矩阵（敏捷16/20）正确', cgBad.length === 0, cgBad.join(' | '));
  ok('创建页盾牌加成：木质+1、金属+2', cg.shield.wood.bonus === 1 && cg.shield.wood.ac === 14 && cg.shield.metal.bonus === 2 && cg.shield.metal.ac === 15, JSON.stringify(cg.shield));
  ok('创建页兽皮甲中甲判定 + 专长计入', cg.medium.isMedium === true && cg.medium.acWithFeat === 15, JSON.stringify(cg.medium));
  ok('创建页服装兜底上限+2 / 不着甲全额敏捷', cg.clothing === 13 && cg.unarmored === 15, JSON.stringify({ clothing: cg.clothing, unarmored: cg.unarmored }));

  // 创建页 XLSX 导出 L7（鳞甲+金属盾牌=18）
  const cgB64 = await page.evaluate(async () => {
    var st = {
      name: 'AC测试', race: '人类',
      attrs: { '力量': 10, '敏捷': 16, '体质': 10, '智力': 10, '感知': 10, '魅力': 10, '意志': 10, '幸运': 10 },
      classes: [{ name: '战士', level: 1, keyAttr: '力量' }, { name: '', level: 0 }, { name: '', level: 0 }],
      equipment: { '防具': [{ item: '鳞甲' }, { item: '金属盾牌' }], '主手武器': [], '副手武器': [], '配饰': [], '背包': [], '杂物包': [], '旅行腰包': [], '材料包': [] }
    };
    window.state = st;
    window.__acBlob = null;
    var oldCreate = URL.createObjectURL, oldRevoke = URL.revokeObjectURL;
    URL.createObjectURL = function (b) { window.__acBlob = b; return '#'; };
    URL.revokeObjectURL = function () {};
    try { await exportXlsxFromState(window.state); } catch (e) { return 'ERR:' + e.message; }
    if (!window.__acBlob) return 'ERR:NO_BLOB';
    var buf = new Uint8Array(await window.__acBlob.arrayBuffer());
    var s = '', chunk = 0x8000;
    for (var i = 0; i < buf.length; i += chunk) s += String.fromCharCode.apply(null, buf.subarray(i, i + chunk));
    URL.createObjectURL = oldCreate; URL.revokeObjectURL = oldRevoke;
    return btoa(s);
  });
  ok('创建页 XLSX 导出 AC = 18（接入护甲/盾牌计算）', cgB64.indexOf('ERR:') !== 0 && readL7(cgB64) === 18, cgB64.slice(0, 80));
  await page.close();
}

await browser.close();
server.close();
console.log(`\n护甲AC规则验证: ${pass}P ${fail}F`);
process.exit(fail ? 1 : 0);

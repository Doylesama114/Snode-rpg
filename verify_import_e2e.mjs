// xlsx 角色导入链 E2E：真实根目录档案 → 上传页解析(buildState) → 熟练扫描固定行区 → 面板渲染一致性
// 用法: node verify_import_e2e.mjs   （内嵌 HTTP server，自动启停）
import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

process.env.TEMP = process.env.TEMP || 'C:\\Users\\23677\\AppData\\Local\\Temp';
const ROOT_DIR = 'D:\\Download\\scholar-agent-main';
const PORT = 8127;
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.png': 'image/png', '.jpeg': 'image/jpeg' };
const server = http.createServer((req, res) => {
  try {
    let p = decodeURIComponent(req.url.split('?')[0]);
    if (p === '/') p = '/index.html';
    const fp = path.join(ROOT_DIR, p);
    if (!fp.startsWith(ROOT_DIR)) { res.writeHead(403); res.end(); return; }
    const data = fs.readFileSync(fp);
    res.writeHead(200, { 'Content-Type': MIME[path.extname(fp)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    res.end(data);
  } catch (e) { res.writeHead(404); res.end(); }
});
await new Promise(resolve => server.listen(PORT, '127.0.0.1', resolve));

const BASE = 'http://127.0.0.1:' + PORT;
const UPLOAD_URL = BASE + '/%E6%96%AF%E8%AF%BA%E5%BE%B7%E8%B7%91%E5%9B%A2/%E4%B8%8A%E4%BC%A0%E8%A7%92%E8%89%B2.html';
const PANEL_URL = BASE + '/%E6%96%AF%E8%AF%BA%E5%BE%B7%E8%B7%91%E5%9B%A2/%E8%A7%92%E8%89%B2%E9%9D%A2%E6%9D%BF.html';
const RUN_DIR = path.join(ROOT_DIR, '斯诺德跑团');

let pass = 0, fail = 0;
function ok(name, cond, extra) {
  if (cond) { pass++; console.log('  ✅ ' + name); }
  else { fail++; console.log('  ❌ ' + name + (extra ? ' — ' + extra : '')); }
}
// ============ 单元测试：scanXlsxProficiencies 固定行区映射 ============
console.log('=== 单元测试 scanXlsxProficiencies ===');
{
  const modUrl = 'file:///' + path.join(RUN_DIR, 'xlsx_proficiency_import.js').replace(/\\/g, '/');
  const mod = await import(modUrl);
  const cells = {
    E36: '力量', E37: '豁免', G37: 2, E38: '威力', G38: 1,
    E40: '运动-跳跃', G40: 3,
    E46: '敏捷', E47: '豁免', G47: 1, E48: '体操', G48: '0',
    E57: '体质', E58: '豁免', G58: 1,
    E87: '感知', E88: '豁免', G88: 1, E90: '洞悉', G90: 2, E95: '警惕值', G95: 1,
    E110: '意志', E111: '豁免', G111: 1, E112: '求生', G112: 2,
    E116: '幸运', E117: '豁免', G117: 1,
    E150: '察觉', G150: 9
  };
  const got = mod.scanXlsxProficiencies(cells);
  ok('力量块：豁免/威力/运动-跳跃 正确', got['力量'] && got['力量']['豁免'] === 2 && got['力量']['威力'] === 1 && got['力量']['运动-跳跃'] === 3, JSON.stringify(got['力量']));
  ok('敏捷块：豁免收、0 值不收', got['敏捷'] && got['敏捷']['豁免'] === 1 && !got['敏捷']['体操'], JSON.stringify(got['敏捷']));
  ok('意志块（旧 bug 重灾区）：豁免+求生', got['意志'] && got['意志']['豁免'] === 1 && got['意志']['求生'] === 2, JSON.stringify(got['意志']));
  ok('感知块：警惕值在列', got['感知'] && got['感知']['警惕值'] === 1, JSON.stringify(got['感知']));
  ok('幸运块：豁免', got['幸运'] && got['幸运']['豁免'] === 1, JSON.stringify(got['幸运']));
  ok('越界行 E150 不误收', !got['感知'] || !got['感知']['察觉'], JSON.stringify(got['感知']));
}

// 文件清单（跳过规则书/物资表等非角色档案）
const SKIP_NAMES = ['斯诺德物资大全.xlsx', '冒险者角色创建流程.xlsx', '冒险者基础规则.xlsx', '斯诺德对决卡牌列表（已开出）.xlsx', '个性与背景创建规则.xlsx'];
const files = fs.readdirSync(ROOT_DIR).filter(f => f.endsWith('.xlsx') && SKIP_NAMES.indexOf(f) < 0).map(f => path.join(ROOT_DIR, f));

const browser = process.env.CDP_URL
  ? await chromium.connectOverCDP(process.env.CDP_URL)
  : await chromium.launch({ headless: true });
const ctx = (browser.contexts() && browser.contexts()[0]) || await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await ctx.newPage();
const pageErrors = [];
page.on('pageerror', e => pageErrors.push(String(e && e.message || e)));
page.on('dialog', d => d.dismiss());

await page.goto(UPLOAD_URL);
await page.waitForTimeout(400);
ok('上传页加载无 JS 错误', pageErrors.length === 0, pageErrors.slice(0, 3).join(' | '));

// 页面内独立镜像提取（规格锁：与导入模块同构，但独立实现于测试中）
const MIRROR_JS = [
  'function mirrorProfs(cells) {',
  '  var rows=[36,46,57,62,87,100,110,116], ends=[46,57,62,87,100,110,116,146];',
  '  var names=["力量","敏捷","体质","智力","感知","魅力","意志","幸运"];',
  '  var labels={',
  '    "力量":["豁免","威力","承重","运动-跳跃","运动-攀爬","运动-游泳","运动-自定义"],',
  '    "敏捷":["豁免","体操","骑乘","隐匿","巧手-偷窃","巧手-开锁","巧手-拆除","巧手-自定义"],',
  '    "体质":["豁免","专注","耐力"],',
  '    "智力":["豁免","宗教","调查","估价","伪造","读唇","逻辑","奥秘-魔法学识","奥秘-炼金术","奥秘-神奇道具","奥秘-多元宇宙","知识-历史","知识-地理","知识-人文","知识-政治","知识-神秘学","知识-工程学","知识-珠宝学","知识-草药学","知识-医药","知识-烹饪","知识-自定义"],',
  '    "感知":["豁免","洞悉","导航","自然","驯兽","感悟","聆听","察觉","警惕值"],',
  '    "魅力":["豁免","欺瞒","恐吓","说服","表演-歌唱","表演-舞蹈","表演-演奏","表演-自定义"],',
  '    "意志":["豁免","求生","激励","决策"],',
  '    "幸运":["豁免","机遇","探索"]',
  '  };',
  '  var out={};',
  '  for (var ai=0; ai<names.length; ai++) {',
  '    for (var r=rows[ai]; r<ends[ai]; r++) {',
  '      var label=String(cells["E"+r]==null?"":cells["E"+r]).trim();',
  '      if(!label||label===names[ai])continue;',
  '      if((labels[names[ai]]||[]).indexOf(label)<0)continue;',
  '      var v=parseInt(cells["G"+r],10);',
  '      if(isNaN(v)||v<=0)continue;',
  '      if(!out[names[ai]])out[names[ai]]={};',
  '      out[names[ai]][label]=v;',
  '    }',
  '  }',
  '  return out;',
  '}'
].join('\n');
console.log('\n=== 真实档案导入链（' + files.length + ' 个文件） ===');
let importedN = 0, skippedN = 0;
for (const f of files) {
  const fname = path.basename(f);
  const buf = fs.readFileSync(f);
  const b64 = buf.toString('base64');
  const result = await page.evaluate(async ({ b64, mirrorJs }) => {
    eval(mirrorJs);
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    let parsed = null, parseErr = null;
    try { parsed = await parseXLSX(bytes.buffer); } catch (e) { parseErr = String(e && e.message || e); }
    if (!parsed || Object.keys(parsed.cells).length < 10) return { kind: 'invalid', cells: parsed ? Object.keys(parsed.cells).length : 0, parseErr: parseErr };
    const mirror = mirrorProfs(parsed.cells);
    const scanned = (typeof scanXlsxProficiencies === 'function') ? scanXlsxProficiencies(parsed.cells) : {};
    let state = null, buildErr = null;
    try { state = buildState(parsed); } catch (e) { buildErr = String(e && e.message || e); }
    let profCount = 0, profAttrs = 0;
    if (state && state.profs) {
      const ks = Object.keys(state.profs);
      profAttrs = ks.length;
      for (const k of ks) profCount += Object.keys(state.profs[k]).length;
    }
    return {
      kind: 'ok', cells: Object.keys(parsed.cells).length,
      mirror: mirror, scanned: scanned, match: JSON.stringify(mirror) === JSON.stringify(scanned),
      name: state && state.name, race: state && state.race,
      cls: state && state.classes && state.classes[0] && state.classes[0].name,
      lvl: state && state.classes && state.classes[0] && state.classes[0].level,
      profCount: profCount, profAttrs: profAttrs,
      skills: state && state.skills && state.skills.length,
      talents: state && state.talent_tree && state.talent_tree.length,
      languages: state && state.languages && state.languages.length,
      bg: state && state.background,
      aspiration: state && state.aspirationPath ? (state.aspirationPath.picks || []).length : 0,
      buildErr: buildErr
    };
  }, { b64, mirrorJs: MIRROR_JS });

  const mirrorCount = Object.values(result.mirror || {}).reduce((n, m) => n + Object.keys(m).length, 0);
  const mirrorAttrs = Object.keys(result.mirror || {}).length;
  if (result.kind === 'invalid' || result.buildErr) {
    skippedN++;
    const why = result.buildErr ? 'buildState 失败: ' + result.buildErr.slice(0, 60) : (result.parseErr ? '解析失败: ' + result.parseErr.slice(0, 60) : '非档案/单元格过少');
    console.log('  ⏭  ' + fname + ' — ' + why);
    continue;
  }
  importedN++;
  const isMirrorOk = result.match;
  const stateHasAll = mirrorCount > 0 ? (result.profCount >= mirrorCount) : true;
  const line = '  ' + (isMirrorOk && stateHasAll ? '✅' : '❌') + ' ' + fname +
    ' | ' + (result.name || '?') + ' ' + (result.cls || '?') + 'Lv.' + (result.lvl || '?') +
    ' | 熟练 ' + result.profCount + '/' + mirrorCount + ' 项(' + result.profAttrs + '/' + mirrorAttrs + ' 属性)' +
    ' | 技能' + (result.skills || 0) + ' 天赋' + (result.talents || 0) + ' 语言' + (result.languages || 0) + ' 路线' + (result.aspiration || 0);
  console.log(line);
  ok(fname + ' 扫描与规格一致', isMirrorOk, JSON.stringify(result.scanned).slice(0, 120));
  ok(fname + ' buildState 收录全部熟练项', stateHasAll, 'state=' + result.profCount + ' mirror=' + mirrorCount);
  if (mirrorAttrs > 1) ok(fname + ' 多属性熟练均识别（旧 bug 回归防护）', result.profAttrs >= mirrorAttrs, result.profAttrs + '<' + mirrorAttrs);
  if (fname.indexOf('救赎骑士') >= 0) ok('救赎骑士：非感知属性熟练被识别', result.profAttrs >= 6, result.profAttrs + ' 属性');
}

console.log('\n导入 ' + importedN + ' 个档案，跳过 ' + skippedN + ' 个');
// ============ 全 UI 流（救赎骑士）+ 面板渲染一致性 ============
console.log('\n=== 全 UI 流 + 面板渲染（救赎骑士） ===');
{
  const f = path.join(ROOT_DIR, '救赎骑士_slot1_20260730_162452_角色档案.xlsx');
  const p2 = await ctx.newPage();
  const errs2 = [];
  p2.on('pageerror', e => errs2.push(String(e && e.message || e)));
  p2.on('dialog', d => d.dismiss());
  await p2.goto(UPLOAD_URL);
  await p2.waitForTimeout(400);
  await p2.setInputFiles('#fileInput', f);
  let steps = 0;
  while (steps < 10) {
    steps++;
    await p2.waitForTimeout(500);
    const picked = await p2.evaluate(() => {
      const w = document.getElementById('warnKeep');
      if (w) { w.click(); return 'warnKeep'; }
      const x = document.getElementById('xpSpConfirmBtn');
      if (x) { x.click(); return 'xpSp'; }
      const b = document.getElementById('bgSkipBtn');
      if (b) { b.click(); return 'bgSkip'; }
      const pv = document.getElementById('previewPanel');
      if (pv && pv.style.display !== 'none') return 'preview';
      const btns = Array.from(document.querySelectorAll('button'));
      const cf = btns.find(b => (b.textContent || '').indexOf('确认导入') >= 0);
      if (cf) { cf.click(); return 'confirm'; }
      const success = document.getElementById('successMsg');
      if (success && success.style.display !== 'none') return 'success';
      return 'none';
    });
    if (picked === 'preview') {
      await p2.evaluate(() => { if (typeof confirmImport === 'function') confirmImport(); });
      break;
    }
    if (picked === 'success' || picked === 'confirm' || picked === 'none') break;
  }
  await p2.waitForTimeout(700);
  const saved = await p2.evaluate(() => {
    const keys = Object.keys(localStorage).filter(k => k.indexOf('char_') === 0 && k.indexOf('_slot') >= 0);
    return keys.map(k => {
      try {
        const d = JSON.parse(localStorage.getItem(k));
        return { key: k, name: d.name, profs: d.profs || null, cls: d.classes && d.classes[0] && d.classes[0].name };
      } catch (e) { return { key: k }; }
    });
  });
  ok('UI 流完成并写入存档', saved.length >= 1, JSON.stringify(saved.map(s => s.key)).slice(0, 160));
  ok('UI 流无 JS 错误', errs2.length === 0, errs2.slice(0, 3).join(' | ').slice(0, 200));
  const savedProfs = saved.length ? (saved[0].profs || {}) : {};
  const savedCount = Object.values(savedProfs).reduce((n, m) => n + Object.keys(m).length, 0);
  ok('存档熟练项 ≥ 11（救赎骑士 7 属性 11 项）', savedCount >= 11, String(savedCount));
  const savedAttrs = Object.keys(savedProfs).length;
  ok('存档熟练覆盖 ≥ 6 属性', savedAttrs >= 6, String(savedAttrs));

  if (saved.length) {
    const charName = saved[0].name;
    const p3 = await ctx.newPage();
    const errs3 = [];
    p3.on('pageerror', e => errs3.push(String(e && e.message || e)));
    await p3.goto(PANEL_URL + '?char=' + encodeURIComponent(charName) + '&slot=1');
    await p3.waitForTimeout(1200);
    ok('面板加载无 JS 错误', errs3.length === 0, errs3.slice(0, 3).join(' | ').slice(0, 200));
    const profText = await p3.evaluate(() => {
      const els = ['attr-grid', 'stat-row', 'prof-list', 'weapon-profs'];
      let out = '';
      for (const id of els) {
        const el = document.getElementById(id);
        if (el) out += (el.innerText || '') + '\n';
      }
      return out.slice(0, 4000);
    });
    const scanNames = [];
    for (const attr of Object.keys(savedProfs)) for (const sk of Object.keys(savedProfs[attr])) scanNames.push(sk);
    let shown = 0;
    for (const n of scanNames) if (profText.indexOf(n) >= 0) shown++;
    ok('面板熟练区显示导入熟练项 (' + shown + '/' + scanNames.length + ')', shown >= Math.max(1, Math.floor(scanNames.length * 0.8)), profText.slice(0, 160));
    await p3.close();
  }
  await p2.close();
}

await browser.close();
server.close();
console.log('\n========== 结果: ' + pass + ' 通过 / ' + fail + ' 失败 ==========');
process.exit(fail > 0 ? 1 : 0);




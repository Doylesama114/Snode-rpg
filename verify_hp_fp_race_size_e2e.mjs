// 种族体型 HP 加成（翼空族/犬牙族）+ 面板 HP/FP 手动持久化 E2E
import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const PORT = 8161;
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

const PANEL_URL = `http://127.0.0.1:${PORT}/%E6%96%AF%E8%AF%BA%E5%BE%B7%E8%B7%91%E5%9B%A2/%E8%A7%92%E8%89%B2%E9%9D%A2%E6%9D%BF.html`;
const browser = await chromium.launch({ headless: true });
let pass = 0, fail = 0;
function ok(name, cond, extra) {
  if (cond) { pass++; console.log('  ✅ ' + name); }
  else { fail++; console.log('  ❌ ' + name + (extra ? ' — ' + extra : '')); }
}

const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
const errs = [];
page.on('pageerror', e => errs.push(String(e && e.message || e)));
await page.goto(PANEL_URL);
await page.waitForTimeout(700);
ok('角色面板加载无 JS 错误', errs.length === 0, errs.join(' | ').slice(0, 300));

function mkStateScript(level, raceSize) {
  return `
    state.name = 'E2E_HP_' + Date.now();
    state.classes = [
      { name: '猎人', level: ${level}, keyAttr: '敏捷', styles: ['', '', '', ''] },
      { name: '', level: 0, styles: ['', '', '', ''] },
      { name: '', level: 0, styles: ['', '', '', ''] }
    ];
    state.attrs = { '力量': 10, '敏捷': 10, '体质': 14, '智力': 10, '感知': 10, '魅力': 10, '意志': 10, '幸运': 10 };
    state.race = '翼空族';
    state.raceSize = ${JSON.stringify(raceSize)};
    state.background = '恶棍';
    state._hpManual = false; state._fpManual = false;
    state._hpCurrent = null; state._fpCurrent = null;
    state.hp = 0; state.fp = 0;
    window.render();
  `;
}

// ============ Bug3: 翼空族/中型 + 中小型 ============
{
  const r = await page.evaluate(`(() => { ${mkStateScript(1, '中型')} return { l1: state.hp, l1Max: S.hpMax }; })()`);
  ok('翼空族/中型 L1 HP=13（8+2体质+2种族+1背景）', r.l1 === 13, JSON.stringify(r));
  const r2 = await page.evaluate(`(() => { state.classes[0].level = 2; window.render(); return { l2: state.hp, cur: S.hp, rec: T.battle.hpRecover }; })()`);
  ok('翼空族/中型 升 L2 HP=18（+3职业+2体质），不是15/16', r2.l2 === 18, JSON.stringify(r2));
  ok('升 L2 后回复值=floor(18/2)', r2.rec === 9, JSON.stringify(r2));

  const r3 = await page.evaluate(`(() => { ${mkStateScript(1, '中小型')} state.classes[0].level = 2; window.render(); return { l1: null, l2: state.hp }; })()`);
  ok('翼空族/中小型 升 L2 HP=16（种族+0）', r3.l2 === 16, JSON.stringify(r3));
}

// ============ Bug4: 手动 HP/FP 回写、持久化、恢复值联动 ============
let charName = '';
{
  const r = await page.evaluate(`(() => {
    ${mkStateScript(1, '中型')}
    var name = state.name;
    adjHp(-3);
    adjFp(-2);
    var out = {
      name: name,
      hp: state.hp, fp: state.fp,
      hpCur: state._hpCurrent, fpCur: state._fpCurrent,
      hpManual: state._hpManual, fpManual: state._fpManual,
      hpRec: T.battle.hpRecover, fpRec: T.battle.fpRecover
    };
    // 非战斗铅笔编辑：应作为初始/上限值写入
    SB_editHpFp('hp');
    document.getElementById('miniInput').value = '12';
    SB_saveHpFp();
    out.pencilHp = state.hp;
    out.pencilCur = state._hpCurrent;
    out.pencilManual = state._hpManual;
    // 战斗中手动调整当前值：不改上限，只持久化当前值
    S.battle = true;
    adjHp(-6);
    out.battleCur = state._hpCurrent;
    out.battleMax = state.hp;
    S.battle = false;
    saveState(1);
    return out;
  })()`);
  charName = r.name;
  ok('非战斗 adjHp(-3) 写回 state（13→10）', r.hp === 10 && r.hpCur === 10 && r.hpManual === true, JSON.stringify(r));
  ok('非战斗 adjFp(-2) 写回 state（8→6）', r.fp === 6 && r.fpCur === 6 && r.fpManual === true, JSON.stringify(r));
  ok('恢复值跟随上限：HP=5 / FP=3', r.hpRec === 5 && r.fpRec === 3, JSON.stringify(r));
  ok('非战斗铅笔编辑初始值=12', r.pencilHp === 12 && r.pencilCur === 12 && r.pencilManual === true, JSON.stringify(r));
  ok('战斗中 adjHp(-6) 只改当前值（上限保持12）', r.battleCur === 6 && r.battleMax === 12, JSON.stringify(r));
  // 战斗当前值已保存，重开验证
  await page.goto(`${PANEL_URL}?char=${encodeURIComponent(charName)}&slot=1`);
  await page.waitForTimeout(800);
  const loaded = await page.evaluate(() => ({
    hp: S.hp, hpMax: S.hpMax, fp: S.fp, fpMax: S.fpMax,
    hpRec: T.battle.hpRecover, fpRec: T.battle.fpRecover,
    hpManual: state._hpManual, fpManual: state._fpManual
  }));
  ok('重开面板：当前HP 6/12、FP 6/6', loaded.hp === 6 && loaded.hpMax === 12 && loaded.fp === 6 && loaded.fpMax === 6, JSON.stringify(loaded));
  ok('重开面板：HP回复=6 / FP回复=3、手动标记已持久化', loaded.hpRec === 6 && loaded.fpRec === 3 && loaded.hpManual === true && loaded.fpManual === true, JSON.stringify(loaded));
}

ok('全程无 JS 错误', errs.length === 0, errs.join(' | ').slice(0, 300));
await browser.close();
server.close();
console.log(`\nHP/FP与种族体型 E2E: ${pass}P ${fail}F`);
process.exit(fail ? 1 : 0);

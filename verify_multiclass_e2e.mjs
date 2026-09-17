// 兼职表 18 职业 E2E：面板兼职候选（含召唤师、不含战舞者）+ 要求/兼容判定 + help.html 表结构
import { chromium } from 'playwright';
import fs from 'node:fs';

const root = process.cwd().split(String.fromCharCode(92)).join(String.fromCharCode(47));
const browser = await chromium.launch();
let pass = 0, fail = 0;
function ok(name, cond, extra) { if (cond) { pass++; console.log('PASS', name); } else { fail++; console.log('FAIL', name, extra || ''); } }

const page = await browser.newPage({ viewport: { width: 1400, height: 950 } });
const errs = [];
page.on('pageerror', e => errs.push('pageerror: ' + e.message));
page.on('console', m => { if (m.type() === 'error' && !/audio\//.test(m.text())) errs.push('console: ' + m.text()); });
await page.goto(`file:///${root}/斯诺德跑团/角色面板.html`, { waitUntil: 'load' });
await page.waitForTimeout(800);

const data = await page.evaluate(() => {
  const reqs = REF_SUBCLASS_REQS;
  const names = Object.keys(reqs);
  const playable = Object.keys(REF_CLASSES);
  return {
    reqCount: names.length,
    names,
    playableCount: playable.length,
    playerHasSummoner: playable.includes('召唤师'),
    playerHasDancer: playable.includes('战舞者'),
    summoner: reqs['召唤师'],
    dancer: reqs['战舞者'],
    priestMonk: { priestToMonk: reqs['牧师'].incompatible.includes('谋士'), monkToPriest: reqs['谋士'].incompatible.includes('牧师') },
  };
});
ok('REF_SUBCLASS_REQS = 18 职业', data.reqCount === 18, String(data.reqCount));
ok('REF_CLASSES 可玩 17 职业（含召唤师、不含战舞者）', data.playableCount === 17 && data.playerHasSummoner && !data.playerHasDancer,
  JSON.stringify({ n: data.playableCount, s: data.playerHasSummoner, d: data.playerHasDancer }));
ok('召唤师要求：智力13/幸运14 + 奥秘/神秘学/机遇 +4',
  data.summoner?.attrs?.['智力'] === 13 && data.summoner?.attrs?.['幸运'] === 14
  && (data.summoner?.profNames || []).join('、') === '奥秘、神秘学、机遇' && data.summoner?.profTotal === 4,
  JSON.stringify(data.summoner));
ok('战舞者要求：敏捷13/魅力13 + 体操/洞悉/表演-舞蹈 +4',
  data.dancer?.attrs?.['敏捷'] === 13 && data.dancer?.attrs?.['魅力'] === 13
  && (data.dancer?.profNames || []).join('、') === '体操、洞悉、表演-舞蹈' && data.dancer?.profTotal === 4,
  JSON.stringify(data.dancer));
ok('新图差异：牧师 ↔ 谋士 现为兼容', !data.priestMonk.priestToMonk && !data.priestMonk.monkToPriest, JSON.stringify(data.priestMonk));

// 兼职弹窗：战士(7级) 主职业
const modal = await page.evaluate(() => {
  state.classes[0] = { name: '战士', level: 7, keyAttr: '力量', styles: ['斗争', '狂攻', '', ''] };
  state.attrs = Object.assign({}, state.attrs, { 力量: 14, 敏捷: 14, 体质: 14, 智力: 14, 感知: 14, 魅力: 14, 意志: 14, 幸运: 14 });
  window.showSubclassModal();
  const box = document.querySelector('.popup-box');
  const rows = [...box.querySelectorAll('div')].filter(d => d.querySelector('span[style*="font-weight:bold"]'));
  const listNames = [...box.querySelectorAll('span')].map(s => s.textContent.trim()).filter(t => t && t.length <= 6 && /^[\u4e00-\u9fa5]+$/.test(t));
  const btnNames = [...box.querySelectorAll('.subclassSelectBtn')].map(b => b.getAttribute('data-cn'));
  const text = box.textContent.replace(/\s+/g, ' ');
  const has = (n) => text.includes(n);
  const out = { btnNames, hasSummoner: has('召唤师'), hasDancer: has('战舞者'), text: text.slice(0, 200) };
  const cancel = document.getElementById('subclassCancelBtn'); if (cancel) cancel.click();
  return out;
});
ok('兼职弹窗出现召唤师候选', (modal.btnNames.includes('召唤师') || modal.hasSummoner), JSON.stringify(modal.btnNames));
ok('兼职弹窗不出现未开放的战舞者', !modal.hasDancer, modal.text);

// help.html 表结构
const help = fs.readFileSync('斯诺德跑团/help.html', 'utf8');
const body = help.slice(help.indexOf('<!-- MULTICLASS-RULES -->'), help.indexOf('<!-- /MULTICLASS-RULES -->'));
ok('help 规则表 18 行', (body.match(/<tr><td><b>/g) || []).length === 18, String((body.match(/<tr><td><b>/g) || []).length));
ok('help 矩阵 18×18', (body.match(/<td class="mc-(no|ok|self)"/g) || []).length === 18 * 18, String((body.match(/<td class="mc-(no|ok|self)"/g) || []).length));
ok('help 标注战舞者未开放', body.includes('战舞者为未开放职业'), '');
ok('面板无 JS 错误', errs.length === 0, errs.join(' | '));

await browser.close();
console.log(`\n兼职表 18 职业 E2E: ${pass}P ${fail}F`);
process.exit(fail > 0 ? 1 : 0);

#!/usr/bin/env node
/** 术士血脉 / 猎人地形 / 萨满元素：建卡可选、可校验、可落草稿、面板可显示（2026-11-25 回归）。 */
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { chromium } from 'playwright';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const SITE = ROOT;
const fails = [];
const pass = (m) => console.log('  PASS ' + m);
const fail = (m) => { fails.push(m); console.log('  FAIL ' + m); };

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8', '.css': 'text/css; charset=utf-8', '.png': 'image/png', '.webp': 'image/webp' };
const server = http.createServer((req, res) => {
  try {
    const p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    const fp = path.join(SITE, p);
    if (!fp.startsWith(SITE) || !fs.existsSync(fp) || fs.statSync(fp).isDirectory()) { res.writeHead(404); res.end('nf'); return; }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(fp)] || 'application/octet-stream' });
    fs.createReadStream(fp).pipe(res);
  } catch (e) { res.writeHead(500); res.end('err'); }
});

await new Promise((r) => server.listen(0, '127.0.0.1', r));
const port = server.address().port;
const base = 'http://127.0.0.1:' + port + '/' + encodeURIComponent('斯诺德跑团') + '/';

const browser = await chromium.launch({ headless: true });
try {
  // ---- 1. 建卡：术士血脉 ----
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  await page.goto(base + encodeURIComponent('角色创建页.html'), { waitUntil: 'load' });
  await page.waitForFunction(() => typeof CLASSES !== 'undefined' && CLASSES.length > 0, { timeout: 15000 }).catch(() => {});
  const idx = await page.evaluate(() => CLASSES.findIndex((c) => c.name === '术士'));
  await page.evaluate((i) => selectClass(i), idx);
  await page.waitForTimeout(300);
  const before = await page.evaluate(() => ({
    disabled: document.getElementById('nextBtn').disabled,
    chips: document.querySelectorAll('#specChoiceArea .spec-btn[data-field="bloodline"]').length,
  }));
  before.disabled && before.chips === 6 ? pass('术士未选血脉时下一步禁用，6 个经脉芯片') : fail('术士初始状态异常 ' + JSON.stringify(before));
  await page.click('#specChoiceArea .spec-btn[data-val="火焰"]');
  await page.waitForTimeout(300);
  const after = await page.evaluate(() => ({
    bloodline: (CHAR.specOpts || {}).bloodline || '',
    selected: Array.from(document.querySelectorAll('#specChoiceArea .spec-btn.selected')).map((e) => e.textContent),
    disabled: document.getElementById('nextBtn').disabled,
    snap: (typeof buildCreationSnapshot === 'function') ? ((buildCreationSnapshot().specOpts || {}).bloodline || '') : 'n/a',
  }));
  after.bloodline === '火焰' && after.selected.indexOf('火焰') >= 0 ? pass('点击后 CHAR.specOpts.bloodline=火焰 且高亮') : fail('点击未生效 ' + JSON.stringify(after));
  after.disabled === false ? pass('选择后下一步解锁') : fail('选择后下一步仍禁用');
  after.snap === '火焰' ? pass('草稿快照包含 specOpts') : fail('草稿快照缺少 specOpts: ' + after.snap);

  // ---- 2. 猎人 / 萨满 ----
  for (const [cls, field, opt] of [['猎人', 'terrain', '极地'], ['萨满祭司', 'element', '火焰']]) {
    const i2 = await page.evaluate((c) => CLASSES.findIndex((x) => x.name === c), cls);
    await page.evaluate((i) => selectClass(i), i2);
    await page.waitForTimeout(250);
    const d0 = await page.evaluate(() => document.getElementById('nextBtn').disabled);
    await page.click('#specChoiceArea .spec-btn[data-val="' + opt + '"]');
    await page.waitForTimeout(250);
    const r = await page.evaluate((f) => ({ disabled: document.getElementById('nextBtn').disabled, val: (CHAR.specOpts || {})[f] || '' }), field);
    d0 === true && r.disabled === false && r.val === opt ? pass(cls + ' ' + field + ' 可选且解锁') : fail(cls + ' 回归失败 ' + JSON.stringify({ d0, r }));
  }

  // ---- 3. 面板显示 ----
  const panel = await browser.newPage();
  await panel.goto(base + encodeURIComponent('角色面板.html') + '?char=' + encodeURIComponent('测试术士') + '&slot=1', { waitUntil: 'load' });
  await panel.waitForTimeout(500);
  await panel.evaluate(() => {
    const ch = { name: '测试术士', _charName: '测试术士', classes: [{ name: '术士', level: 1 }], attrs: {}, hp: 8, hpMax: 8, fp: 8, fpMax: 8, skills: [],
      classChoices: { specOpts: { bloodline: '火焰' } }, class_features: [{ name: '魔力血脉', desc: '根据血脉力量附加额外伤害' }] };
    localStorage.setItem('char_测试术士_slot1', JSON.stringify(ch));
  });
  await panel.reload({ waitUntil: 'load' });
  await panel.waitForTimeout(1200);
  const text = await panel.evaluate(() => document.body.innerText);
  text.indexOf('伤害类型：火焰') >= 0 ? pass('面板起始特性显示「伤害类型：火焰」') : fail('面板未显示血脉');

  // ---- 4. 静态：最终存档字段 ----
  const chargen = fs.readFileSync(path.join(SITE, '斯诺德跑团', '角色创建页.html'), 'utf8');
  /classChoices:[\s\S]{0,400}?specOpts/.test(chargen) ? pass('saveCharacter 的 classChoices 写入 specOpts') : fail('classChoices 未写入 specOpts');
  /SPEC_OPT_CHOICES\[clsName\]/.test(chargen) ? pass('checkSpecDone 校验 specOpts') : fail('checkSpecDone 未校验 specOpts');
} catch (e) {
  fail('执行异常: ' + (e && e.message ? e.message : e));
} finally {
  await browser.close();
  server.close();
}

if (fails.length) { console.log('血脉/地形/元素选择回归失败：' + fails.length + ' 项'); process.exit(1); }
console.log('血脉/地形/元素选择回归通过');

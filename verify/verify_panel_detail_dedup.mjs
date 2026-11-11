// v1.0.8095 回归：面板技能详情不得出现重复段落，且升级行必须完整
import { chromium } from 'playwright';
import path from 'node:path';

const root = process.cwd();
const url = 'file:///' + path.join(root, '斯诺德跑团', '角色面板.html').replace(/\\/g, '/');
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
const errs = [];
page.on('pageerror', e => errs.push(e.message));
await page.goto(url, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(1500);

const res = await page.evaluate(() => {
  const norm = s => (typeof normUnitText === 'function') ? normUnitText(s) : String(s || '').replace(/\s+/g, '');
  const bad = [], missing = [];
  let snapshot = {};
  let skills = 0, withUps = 0;
  for (const cls of Object.keys(SKILL_DATA)) {
    for (const row of (SKILL_DATA[cls] || [])) {
      skills++;
      const html = (typeof formatSkillDetailHtml === 'function') ? formatSkillDetailHtml(row) : '';
      const paras = html.split('</p>').map(s => s.replace(/<[^>]+>/g, '').trim()).filter(Boolean);
      const ups = row.level_upgrades || [];
      if (ups.length) withUps++;
      // 1) section 段落最多出现一次
      const seenSec = {};
      for (const u of ups) {
        const sec = (u.section || '').trim();
        if (!sec) continue;
        const k = norm(sec);
        if (seenSec[k]) continue;
        seenSec[k] = true;
        const cnt = paras.filter(p => norm(p) === k).length;
        if (cnt > 1) bad.push({ cls, id: row.id, name: row.name, sec: sec.slice(0, 26), cnt });
      }
      // 2) 相邻段落不得完全相同
      for (let i = 1; i < paras.length; i++) {
        if (norm(paras[i]) && norm(paras[i]) === norm(paras[i - 1])) {
          bad.push({ cls, id: row.id, name: row.name, sec: 'adjacent:' + paras[i].slice(0, 20), cnt: 2 });
          break;
        }
      }
      // 3) 每条升级的 label 必须出现
      for (const u of ups) {
        const label = u.label || ('你的' + (u.class || '') + '等级到达' + u.level + '级时：');
        if (label && html.indexOf(label) === -1) missing.push({ cls, id: row.id, name: row.name, label });
      }
      if (row.name === '奇械师特性') {
        const target = '你获得奇械师职业的初始专长.脑力强化';
        snapshot = {
          text: paras.join(' | ').slice(0, 600),
          sectionCount: paras.filter(p => p.indexOf(target) !== -1).length,
          has6: html.indexOf('你的主职业等级到达6级时：') !== -1,
          has10: html.indexOf('你的主职业等级到达10级时：') !== -1,
        };
      }
    }
  }
  return { skills, withUps, badCount: bad.length, missingCount: missing.length, badSample: bad.slice(0, 8), missingSample: missing.slice(0, 5), snapshot };
});

let pass = 0, fail = 0;
const ok = (n, c, e) => { if (c) { pass++; console.log('  PASS ' + n + (e ? '  ' + e : '')); } else { fail++; console.log('  FAIL ' + n + (e ? '  ' + e : '')); } };
ok('技能详情无重复 section 段落', res.badCount === 0, '命中 ' + res.badCount + ' 条');
ok('升级 label 全部出现', res.missingCount === 0, '缺失 ' + res.missingCount + ' 条');
ok('奇械师特性 描述句只出现一次', res.snapshot.sectionCount === 1, '出现 ' + res.snapshot.sectionCount + ' 次');
ok('奇械师特性 保留 6 级升级行', res.snapshot.has6 === true);
ok('奇械师特性 保留 10 级升级行', res.snapshot.has10 === true);
ok('页面无 JS 错误', errs.length === 0, errs.slice(0, 2).join(' | '));
console.log('  扫描技能: ' + res.skills + '（含升级 ' + res.withUps + '）');
if (res.badSample.length) console.log('  重复样例: ' + JSON.stringify(res.badSample));
if (res.missingSample.length) console.log('  缺失样例: ' + JSON.stringify(res.missingSample));
console.log('');
console.log('面板详情去重校验: ' + pass + 'P ' + fail + 'F');
await browser.close();
process.exit(fail ? 1 : 0);

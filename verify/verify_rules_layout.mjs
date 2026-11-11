/**
 * 规则手册表格几何验收（v1.0.8011）：边框 / 铺满宽度 / 最小列宽
 * 用法：node verify_rules_layout.mjs
 */
import { chromium } from 'playwright';
const ROOT = process.cwd().replace(/\\/g, '/');
let pass = 0, fail = 0;
const ok = (n, c, extra) => { if (c) { pass++; console.log('  ✓ ' + n); } else { fail++; console.log('  ✗ ' + n + (extra ? ' → ' + extra : '')); } };
const b = await chromium.launch({ headless: true });
const p = await b.newPage({ viewport: { width: 1440, height: 1000 } });
await p.goto('file:///' + ROOT + '/斯诺德跑团/help.html', { waitUntil: 'load' });
await p.waitForTimeout(2000);
const data = await p.evaluate(() => {
  const sections = { s1: '检定规则', s2: '战斗规则', 's-adventure': '冒险规则', s10: '其他规则', s3: '升级规则(对照)' };
  const out = {};
  for (const [sid, name] of Object.entries(sections)) {
    const s = document.getElementById(sid);
    if (!s) { out[name] = null; continue; }
    const content = document.querySelector('.help-content').getBoundingClientRect().width;
    out[name] = [].slice.call(s.querySelectorAll('table')).map(function (t) {
      const wrap = t.closest('.wrap');
      const firstTh = t.querySelector('th');
      const cs = firstTh ? getComputedStyle(firstTh) : (t.querySelector('td') ? getComputedStyle(t.querySelector('td')) : null);
      const cols = [].slice.call((t.querySelector('tr') || { children: [] }).children)
        .map(c => Math.round(c.getBoundingClientRect().width));
      return {
        w: Math.round(t.getBoundingClientRect().width),
        wrapW: wrap ? Math.round(wrap.getBoundingClientRect().width) : 0,
        border: cs ? parseFloat(cs.borderTopWidth) : 0,
        minCol: cols.length ? Math.min(...cols) : 0,
        cols: cols.length,
        hasTh: !!firstTh,
        contentW: Math.round(content),
      };
    });
  }
  return out;
});
for (const [name, tables] of Object.entries(data)) {
  if (!tables) { ok(name + ' 章节存在', false); continue; }
  const bad = { wrap: 0, border: 0, width: 0, mincol: 0, th: 0 };
  tables.forEach(t => {
    if (!t.wrapW) bad.wrap++;
    if (t.border < 1) bad.border++;
    if (t.wrapW && t.w / t.wrapW < 0.95) bad.width++;
    if (t.cols > 1 && t.minCol < 40) bad.mincol++;
    if (!t.hasTh) bad.th++;
  });
  console.log('▌' + name + '（' + tables.length + ' 张表）');
  ok('每张表都在 .wrap 容器内', bad.wrap === 0, bad.wrap + ' 张缺失');
  ok('每张表都有边框（≥1px）', bad.border === 0, bad.border + ' 张无边框');
  ok('表格铺满 .wrap 容器（≥95%）', bad.width === 0, bad.width + ' 张过窄');
  ok('最小列宽 ≥40px', bad.mincol === 0, bad.mincol + ' 张有窄列');
  ok('每张表首行有表头 <th>', bad.th === 0, bad.th + ' 张缺表头');
  if (tables.length) console.log('    宽度样本: ' + tables.map(t => t.w + '/' + t.contentW + ' 列' + t.cols + ' 最小列' + t.minCol).join(' | '));
}
await b.close();
console.log('\n' + '─'.repeat(50));
console.log((fail === 0 ? '✅ 表格几何验收通过' : '❌ 有失败项') + '  ' + pass + 'P / ' + fail + 'F');
process.exit(fail === 0 ? 0 : 1);

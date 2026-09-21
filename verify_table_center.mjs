/**
 * 表格居中断言（v1.0.8014）：短内容居中 / 长段落左对齐 / 表头居中 / 懒渲染后仍生效 / 布局不被误改
 * 用法：node verify_table_center.mjs
 */
import { chromium } from 'playwright';
const ROOT = process.cwd().replace(/\\/g, '/');
const URL = (p) => 'file:///' + ROOT + '/' + encodeURI(p);
let pass = 0, fail = 0;
const ok = (n, c, extra) => { if (c) { pass++; console.log('  ✓ ' + n); } else { fail++; console.log('  ✗ ' + n + (extra ? ' → ' + extra : '')); } };
const b = await chromium.launch({ headless: true });

/* ① 规则手册：短内容 / 长段落 / 表头 */
{
  const p = await b.newPage({ viewport: { width: 1440, height: 1000 } });
  await p.goto(URL('斯诺德跑团/help.html'), { waitUntil: 'load' });
  await p.waitForTimeout(1800);
  const r = await p.evaluate(() => {
    const s9 = document.getElementById('s9');
    const idxCell = s9.querySelector('.wrap table td.col-idx');
    const longCell = [].slice.call(s9.querySelectorAll('.wrap table td')).find(td => { const rg = document.createRange(); rg.selectNodeContents(td); return rg.getClientRects().length >= 3; });
    const th = s9.querySelector('.wrap table th');
    const s1 = document.getElementById('s1');
    const shortCell = [].slice.call(s1.querySelectorAll('.wrap table td')).find(td => /^\d+$/.test(td.textContent.trim()));
    return {
      idx: idxCell ? getComputedStyle(idxCell).textAlign : '',
      long: longCell ? getComputedStyle(longCell).textAlign : '',
      longClass: longCell ? longCell.className : '',
      th: th ? getComputedStyle(th).textAlign : '',
      short: shortCell ? getComputedStyle(shortCell).textAlign : '',
    };
  });
  ok('名望 # 列（短内容）居中', r.idx === 'center', r.idx);
  ok('名望 要点（长段落）左对齐', r.long === 'left', r.long + ' / ' + r.longClass);
  ok('表头居中', r.th === 'center', r.th);
  ok('检定规则 难度值居中', r.short === 'center', r.short);
  await p.close();
}

/* ② 技能卡（懒渲染）：滚动触发后再判定 */
{
  const p = await b.newPage({ viewport: { width: 1440, height: 1000 } });
  await p.goto(URL('职业页/法师.html'), { waitUntil: 'load' });
  await p.waitForTimeout(1500);
  await p.evaluate(() => window.scrollBy(0, 1200));
  await p.waitForTimeout(1500);
  const r = await p.evaluate(() => {
    const val = document.querySelector('.attr-table .attr-val');
    const name = document.querySelector('.attr-table .attr-name');
    return {
      hydrated: !!(val && val.getBoundingClientRect().width > 0),
      val: val ? getComputedStyle(val).textAlign : '',
      name: name ? getComputedStyle(name).textAlign : '',
      valClass: val ? val.className : '',
    };
  });
  ok('技能卡已懒渲染', r.hydrated);
  ok('技能卡「字段名」居中', r.name === 'center', r.name);
  ok('技能卡「值」居中（短值）', r.val === 'center', r.val + ' / ' + r.valClass);
  await p.close();
}

/* ③ 角色面板 / 资料库：短值居中 + 布局 grid 未被误改 */
{
  const p = await b.newPage({ viewport: { width: 1440, height: 1000 } });
  await p.addInitScript(() => localStorage.setItem('char_测试勇者_slot1', JSON.stringify({ name: '测试勇者' })));
  await p.goto(URL('斯诺德跑团/角色面板.html') + '?char=%E6%B5%8B%E8%AF%95%E5%8B%87%E8%80%85&slot=1', { waitUntil: 'load' });
  await p.waitForTimeout(2200);
  const r = await p.evaluate(() => {
    const tables = [].slice.call(document.querySelectorAll('table'));
    const th = tables.length ? tables[0].querySelector('th') : null;
    const grid = [].slice.call(document.querySelectorAll('*')).find(e => getComputedStyle(e).display === 'grid' && e.getBoundingClientRect().width > 200);
    return { tables: tables.length, th: th ? getComputedStyle(th).textAlign : '', gridDisplay: grid ? getComputedStyle(grid).display : '' };
  });
  ok('角色面板表格表头居中', r.tables > 0 && r.th === 'center', r.th + ' / tables=' + r.tables);
  ok('布局 grid 未被误改', r.gridDisplay === 'grid', r.gridDisplay);
  await p.close();
}
{
  const p = await b.newPage({ viewport: { width: 1440, height: 1000 } });
  await p.goto(URL('斯诺德跑团/物资大全.html'), { waitUntil: 'load' });
  await p.waitForTimeout(2000);
  await p.evaluate(() => { const t = [].slice.call(document.querySelectorAll('.tab, .sheetTab')).find(x => /创建流程|NO\.1/.test(x.textContent)); if (t) t.click(); });
  await p.waitForTimeout(1200);
  const r = await p.evaluate(() => {
    const t = document.querySelector('table');
    if (!t) return { none: true };
    const th = t.querySelector('th, td');
    return { th: th ? getComputedStyle(th).textAlign : '' };
  });
  ok('物资大全表格表头居中', !r.none && r.th === 'center', JSON.stringify(r));
  await p.close();
}

await b.close();
console.log('\n' + '─'.repeat(50));
console.log((fail === 0 ? '✅ 表格居中验收通过' : '❌ 有失败项') + '  ' + pass + 'P / ' + fail + 'F');
process.exit(fail === 0 ? 0 : 1);

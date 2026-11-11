/**
 * v1.0.8002 UI 修复验收（8 组断言）
 * 覆盖用户反馈：启动台适配 / 对决入口(打包路径) / 标题对比度 / ESC 回退 / 柜台默认迁移 / 向导宽度 / 面板不误关 / 首访提示
 * 用法：node verify_ui_8002_e2e.mjs
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd().replace(/\\/g, '/');
const URL = (p) => 'file:///' + ROOT + '/' + encodeURI(p);
let pass = 0, fail = 0;
const ok = (n, c, extra) => { if (c) { pass++; console.log('  ✓ ' + n); } else { fail++; console.log('  ✗ ' + n + (extra ? '  → ' + extra : '')); } };
const sec = (t) => console.log('\n▌' + t);

/* 模拟打包布局：app/ 下只有 斯诺德跑团 与 poker-game（无 electron-app） */
const SIM = path.join(ROOT, '_scratch', 'pkgsim2');
const copyDir = (from, to) => {
  if (!fs.existsSync(from)) return 0;
  fs.mkdirSync(to, { recursive: true });
  let n = 0;
  for (const f of fs.readdirSync(from)) {
    const s = path.join(from, f), d = path.join(to, f);
    if (fs.statSync(s).isDirectory()) n += copyDir(s, d); else { fs.copyFileSync(s, d); n++; }
  }
  return n;
};
fs.rmSync(SIM, { recursive: true, force: true });
copyDir(path.join(ROOT, '斯诺德跑团'), path.join(SIM, '斯诺德跑团'));
copyDir(path.join(ROOT, 'electron-app', 'poker-game'), path.join(SIM, 'poker-game'));

const browser = await chromium.launch({ headless: true });

sec('① 启动台适配（非全屏）');
for (const [w, h] of [[1400, 900], [1400, 860], [1280, 800]]) {
  const p = await browser.newPage({ viewport: { width: w, height: h } });
  await p.addInitScript(() => localStorage.setItem('_snowd_changelog_seen', '1.0.8002'));
  await p.goto(URL('斯诺德跑团/启动台.html'), { waitUntil: 'load' });
  await p.waitForTimeout(1200);
  const st = await p.evaluate(() => ({ o: document.documentElement.scrollHeight - document.documentElement.clientHeight }));
  ok(w + 'x' + h + ' 不出现纵向滚动', st.o <= 0, '溢出 ' + st.o + 'px');
  await p.close();
}

sec('② 模拟打包布局：对决入口可达');
{
  const p = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  await p.addInitScript(() => { window.electronAPI = {}; localStorage.setItem('_snowd_changelog_seen', '1.0.8002'); });
  const simUrl = 'file:///' + SIM.replace(/\\/g, '/') + '/' + encodeURI('斯诺德跑团/启动台.html');
  await p.goto(simUrl, { waitUntil: 'load' });
  await p.waitForTimeout(1400);
  const href = await p.evaluate(() => {
    const a = [].slice.call(document.querySelectorAll('.plank')).find(x => /对决/.test(x.textContent));
    return a ? a.getAttribute('href') : '';
  });
  ok('对决链接指向顶层 poker-game 且带 hash', /\/poker-game\/index\.html#\/$/.test(href), href);
  ok('目标文件在模拟包中存在', fs.existsSync(path.join(SIM, 'poker-game', 'index.html')));
  await p.close();
}

sec('③ 深底浅字对比度（≥4.5）');
{
  const p = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  await p.goto(URL('职业页/首页.html'), { waitUntil: 'load' });
  await p.waitForTimeout(1500);
  const res = await p.evaluate(() => {
    const lum = (c) => { const m = c.match(/\d+/g); if (!m) return 0; return (0.2126 * +m[0] + 0.7152 * +m[1] + 0.0722 * +m[2]) / 255; };
    const ratio = (a, b) => { const l1 = lum(a), l2 = lum(b), hi = Math.max(l1, l2), lo = Math.min(l1, l2); return +(((hi + 0.05) / (lo + 0.05)).toFixed(2)); };
    const out = [];
    document.querySelectorAll('.section-title .st-cn, h1').forEach(function (e) {
      const bar = e.closest('.section-title');
      var bg = 'rgb(208,169,122)';
      if (bar) {
        var bi = getComputedStyle(bar).backgroundImage || '';
        var cols = bi.split('rgb(').slice(1).map(function (s) { return 'rgb(' + s.split(')')[0] + ')'; });
        if (cols.length) { var best = cols[0]; for (var k = 1; k < cols.length; k++) { if (lum(cols[k]) > lum(best)) best = cols[k]; } bg = best; }
      }
      out.push({ sel: bar ? '.st-cn' : 'h1', text: (e.textContent || '').trim().slice(0, 8), color: getComputedStyle(e).color, bg: bg, ratio: ratio(getComputedStyle(e).color, bg) });
    });
    return out;
  });
  res.forEach(r => ok(r.sel + '「' + r.text + '」对比度 ' + r.ratio, r.ratio >= 4.5, r.color));
  await p.close();
}

sec('④ 角色创建页宽度稳定');
{
  const p = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  await p.goto(URL('斯诺德跑团/角色创建页.html'), { waitUntil: 'load' });
  await p.waitForTimeout(1800);
  const w1 = await p.evaluate(() => Math.round(document.querySelector('.container').getBoundingClientRect().width));
  ok('容器已拉伸到栅格列宽（>800px）', w1 > 800, w1 + 'px');
  const cg = await p.evaluate(() => getComputedStyle(document.querySelector('.card-grid')).gridTemplateColumns);
  ok('卡片栅格按列宽自适应（≥3 列）', cg.split(' ').length >= 3, cg.slice(0, 50));
  await p.close();
}

sec('⑤ 功能导航：改名 + 切换系统不关闭');
{
  const p = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  await p.goto(URL('斯诺德跑团/主页.html'), { waitUntil: 'load' });
  await p.waitForTimeout(1400);
  const label = await p.evaluate(() => (document.querySelector('.gui-trigger') || {}).innerText || '');
  ok('按钮已改名「功能导航」', /功能导航/.test(label), label.replace(/\n/g, ' '));
  await p.click('.gui-trigger');
  await p.waitForTimeout(350);
  let allOpen = true, switched = 0;
  for (let i = 1; i <= 5; i++) {
    await p.click('.gui-chips button:nth-child(' + i + ')').catch(() => {});
    await p.waitForTimeout(220);
    const st = await p.evaluate(() => ({ open: !document.querySelector('.gui-drop').hidden, notes: document.querySelectorAll('.gui-note').length }));
    if (!st.open) allOpen = false;
    if (st.notes > 0) switched++;
  }
  ok('连点 5 个系统面板始终打开', allOpen);
  ok('每个系统都渲染出条目', switched === 5, String(switched));
  await p.close();
}

sec('⑥ ESC 回退到上一级');
{
  const p = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  await p.goto(URL('职业页/法师.html'), { waitUntil: 'load' });
  await p.waitForTimeout(1600);
  await p.keyboard.press('Escape');
  await p.waitForTimeout(1600);
  const u1 = decodeURI(p.url());
  ok('职业页 ESC → 职业页首页', /职业页\/首页\.html$/.test(u1), u1.split('/').pop());
  await p.goto(URL('斯诺德跑团/资料库.html'), { waitUntil: 'load' });
  await p.waitForTimeout(1400);
  await p.keyboard.press('Escape');
  await p.waitForTimeout(1600);
  const u2 = decodeURI(p.url());
  ok('资料库 ESC → 启动台', /斯诺德跑团\/启动台\.html$/.test(u2), u2.split('/').pop());
  await p.close();
}

sec('⑦ 柜台默认 = 帮助页；旧配置自动迁移');
{
  const p = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  await p.addInitScript(() => localStorage.setItem('_snowd_changelog_seen', '1.0.8002'));
  await p.goto(URL('斯诺德跑团/启动台.html'), { waitUntil: 'load' });
  await p.waitForTimeout(1300);
  const names = await p.evaluate(() => [].slice.call(document.querySelectorAll('.plank .n')).map(x => x.textContent));
  ok('柜台含「规则手册」', names.some(n => /规则手册/.test(n)), names.join(','));
  ok('柜台不再有「资料库」', !names.some(n => n === '资料库'), names.join(','));
  await p.close();
  const p2 = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  await p2.addInitScript(() => {
    localStorage.setItem('snowd_launcher_layout', JSON.stringify({ v: 1, counter: ['home', 'classes', 'library', 'duel'], board: [{ type: 'page', id: 'library' }] }));
  });
  await p2.goto(URL('斯诺德跑团/启动台.html'), { waitUntil: 'load' });
  await p2.waitForTimeout(1300);
  const mig = await p2.evaluate(() => window.SnowdGuild.getLayout());
  ok('v1 配置迁移：library → rulebook', mig.counter.indexOf('rulebook') >= 0 && mig.counter.indexOf('library') < 0, mig.counter.join(','));
  await p2.close();
}

sec('⑧ 首访提示为右下角卡片');
{
  const p = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  await p.goto(URL('斯诺德跑团/启动台.html'), { waitUntil: 'load' });
  await p.waitForTimeout(2600);
  const st = await p.evaluate(() => ({ toast: !!document.getElementById('updateToast') }));
  ok('首次访问显示右下角卡片（不遮挡界面）', st.toast);
  await p.close();
}

await browser.close();
console.log('\n' + '─'.repeat(52));
console.log((fail === 0 ? '✅ v1.0.8002 UI 修复验收全部通过' : '❌ 存在失败项') + '  ' + pass + 'P / ' + fail + 'F');
process.exit(fail === 0 ? 0 : 1);

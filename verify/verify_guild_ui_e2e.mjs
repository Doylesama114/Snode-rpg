/**
 * 工会 UI 共享层（guild-ui.js）端到端验收
 * 覆盖：阶段 A（上下文感知跳转 / 无角色不产生死链 / 返回语义 / 懒挂载）
 *       阶段 B（启动台布局配置 / 上限 / 坏数据回退 / 导入导出 / 角色固定）
 * 用法：node verify_guild_ui_e2e.mjs
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd().replace(/\\/g, '/');
const APP = 'file:///' + ROOT + '/斯诺德跑团/';
const CLS = 'file:///' + ROOT + '/职业页/';

let pass = 0, fail = 0;
const ok = (name, cond, extra) => {
  if (cond) { pass++; console.log('  ✓ ' + name); }
  else { fail++; console.log('  ✗ ' + name + (extra ? '  → ' + extra : '')); }
};
const section = (t) => console.log('\n▌' + t);

const browser = await chromium.launch({ headless: true });

/* ---------- A. 无角色场景 ---------- */
section('A1 无角色：导航面板不产生死链');
{
  const p = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto(APP + '主页.html', { waitUntil: 'load' });
  await p.waitForTimeout(1200);
  await p.click('.gui-trigger');
  await p.waitForTimeout(350);
  const st = await p.evaluate(() => {
    var off = document.querySelector('.gui-note.gui-off');
    return { off: !!off, offHref: off ? off.getAttribute('href') : '', notes: document.querySelectorAll('.gui-note').length };
  });
  ok('无角色时「角色面板」为置灰态', st.off, JSON.stringify(st));
  ok('置灰项 href 为 #（不是死链）', st.offHref === '#', st.offHref);
  ok('页面无 JS 错误', errs.length === 0, errs.join(';'));
  /* 懒挂载：未点击前不应存在面板 DOM */
  const p2 = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await p2.goto(APP + '主页.html', { waitUntil: 'load' });
  await p2.waitForTimeout(1000);
  const lazy = await p2.evaluate(() => !!document.getElementById('guiRoot'));
  ok('懒挂载：未点击时无面板 DOM', lazy === false);
  await p.close(); await p2.close();
}

/* ---------- A2. 有角色场景 ---------- */
section('A2 有角色：出现直达链接并带来源标记');
{
  const p = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await p.addInitScript(() => {
    localStorage.setItem('char_测试勇者_slot1', JSON.stringify({ name: '测试勇者' }));
    localStorage.setItem('_snowd_recent_char', JSON.stringify({ name: '测试勇者', slot: 1, at: Date.now() }));
  });
  await p.goto(APP + '主页.html', { waitUntil: 'load' });
  await p.waitForTimeout(1200);
  await p.click('.gui-trigger');
  await p.waitForTimeout(350);
  const st = await p.evaluate(() => {
    var a = [].slice.call(document.querySelectorAll('.gui-note')).filter(function (x) { return /角色面板/.test(x.textContent); })[0];
    return { has: !!a, href: a ? a.getAttribute('href') : '', off: a ? a.classList.contains('gui-off') : null };
  });
  let decoded = ''; try { decoded = decodeURIComponent(st.href); } catch (e) { decoded = st.href; }
  ok('出现「角色面板 · 测试勇者」入口', st.has && /测试勇者/.test(decoded), JSON.stringify(st));
  ok('链接带 char/slot/from=launcher', /char=%E6%B5%8B%E8%AF%95%E5%8B%87%E8%80%85/.test(st.href) && /slot=1/.test(st.href) && /from=launcher/.test(st.href), st.href);
  ok('该项不是置灰态', st.off === false);
  await p.close();
}

/* ---------- A3. 返回语义 ---------- */
section('A3 from=launcher 时「← 返回」回启动台');
{
  const p = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await p.goto(CLS + '法师.html?from=launcher', { waitUntil: 'load' });
  await p.waitForTimeout(1400);
  const back = await p.evaluate(() => {
    var a = document.querySelector('.back-btn');
    return { exists: !!a, href: a ? a.getAttribute('href') : '', text: a ? a.textContent.trim() : '' };
  });
  ok('职业页存在返回按钮', back.exists);
  ok('返回按钮指向启动台', /启动台\.html$/.test(back.href), back.href);
  ok('按钮文案已改为「返回启动台」', /启动台/.test(back.text), back.text);
  await p.close();
}

/* ---------- B1. 默认布局 ---------- */
section('B1 默认布局（柜台 4 / 告示板 8）');
{
  const p = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  await p.goto(APP + '启动台.html', { waitUntil: 'load' });
  await p.waitForTimeout(1200);
  const st = await p.evaluate(() => {
    var l = window.SnowdGuild.getLayout();
    return { counter: l.counter.length, board: l.board.length, planks: document.querySelectorAll('.plank').length, notes: document.querySelectorAll('a.note:not(.addnew)').length };
  });
  ok('柜台 4 项', st.counter === 4, String(st.counter));
  ok('告示板 8 项', st.board === 8, String(st.board));
  ok('柜台渲染出 4 个木牌', st.planks === 4, String(st.planks));
  ok('告示板渲染出 8 张纸条', st.notes === 8, String(st.notes));
  await p.close();
}

/* ---------- B2. 自定义 + 固定角色 + 上限 + 坏数据 ---------- */
section('B2 自定义配置 / 固定角色 / 上限 12 / 坏数据回退');
{
  const p = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  await p.addInitScript(() => {
    localStorage.setItem('char_阿尔法_slot2', '{}');
    var many = []; for (var i = 0; i < 20; i++) many.push({ type: 'page', id: 'library' });
    localStorage.setItem('snowd_launcher_layout', JSON.stringify({
      v: 1, counter: ['classes', 'duel'],
      board: [{ type: 'char', id: '阿尔法#2', label: '我的阿尔法' }, { type: 'url', id: 'https://example.com', label: '外部资料' }].concat(many),
    }));
  });
  await p.goto(APP + '启动台.html', { waitUntil: 'load' });
  await p.waitForTimeout(1200);
  const st = await p.evaluate(() => {
    var l = window.SnowdGuild.getLayout();
    var notes = [].slice.call(document.querySelectorAll('a.note:not(.addnew)'));
    var charNote = notes.filter(function (a) { return /我的阿尔法/.test(a.textContent); })[0];
    var urlNote = notes.filter(function (a) { return /外部资料/.test(a.textContent); })[0];
    return {
      counter: l.counter, board: l.board.length, notes: notes.length,
      charHref: charNote ? charNote.getAttribute('href') : '', urlHref: urlNote ? urlNote.getAttribute('href') : '',
      counterNames: [].slice.call(document.querySelectorAll('.plank .n')).map(function (x) { return x.textContent; }),
    };
  });
  ok('柜台按配置渲染（职业/对决在前）', st.counterNames[0] === '全部职业' && st.counterNames[1] === '斯诺德对决', st.counterNames.join(','));
  ok('告示板上限截断为 12', st.board === 12 && st.notes === 12, st.board + '/' + st.notes);
  ok('固定角色条目生成正确直达链接', /char=%E9%98%BF%E5%B0%94%E6%B3%95/.test(st.charHref) && /slot=2/.test(st.charHref) && /from=launcher/.test(st.charHref), st.charHref);
  ok('自定义链接条目保留', st.urlHref === 'https://example.com', st.urlHref);
  await p.close();

  /* 坏数据回退 */
  const p2 = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await p2.addInitScript(() => { localStorage.setItem('snowd_launcher_layout', '{坏 JSON'); });
  await p2.goto(APP + '启动台.html', { waitUntil: 'load' });
  await p2.waitForTimeout(1000);
  const bad = await p2.evaluate(() => window.SnowdGuild.getLayout());
  ok('坏 JSON 回退默认布局', bad.counter.length === 4 && bad.board.length === 8, JSON.stringify(bad.counter));
  await p2.close();

  /* 版本不符回退 */
  const p3 = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await p3.addInitScript(() => { localStorage.setItem('snowd_launcher_layout', JSON.stringify({ v: 99, counter: ['duel'], board: [] })); });
  await p3.goto(APP + '启动台.html', { waitUntil: 'load' });
  await p3.waitForTimeout(1000);
  const ver = await p3.evaluate(() => window.SnowdGuild.getLayout());
  ok('版本号不符回退默认布局', ver.board.length === 8);
  await p3.close();

  /* 失效角色引用 */
  const p4 = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await p4.addInitScript(() => {
    localStorage.setItem('snowd_launcher_layout', JSON.stringify({ v: 1, counter: ['home', 'classes', 'library', 'duel'], board: [{ type: 'char', id: '不存在的人#1', label: '幽灵角色' }] }));
  });
  await p4.goto(APP + '启动台.html', { waitUntil: 'load' });
  await p4.waitForTimeout(1000);
  const ghost = await p4.evaluate(() => {
    var a = document.querySelector('a.note.off');
    return { off: !!a, text: a ? a.textContent : '' };
  });
  ok('引用不存在的角色 → 置灰并提示', ghost.off && /不存在/.test(ghost.text), ghost.text.slice(0, 40));
  await p4.close();
}

/* ---------- B3. 导入导出往返 ---------- */
section('B3 配置导入导出往返一致');
{
  const p = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await p.goto(APP + '设置.html', { waitUntil: 'load' });
  await p.waitForTimeout(1000);
  const r = await p.evaluate(() => {
    var G = window.SnowdGuild;
    G.setLayout({ v: 1, counter: ['duel', 'classes', 'items', home = 'home'], board: [{ type: 'char', id: '甲#1', label: '甲' }] });
    var exp = G.exportLayout();
    G.resetLayout();
    var imp = G.importLayout(exp);
    var after = G.getLayout();
    return { ok: imp.ok, counter: after.counter.join(','), board: after.board.length, dup: (after.counter.join(',').split('home').length - 1) };
  });
  ok('导出→重置→导入成功', r.ok, JSON.stringify(r));
  ok('导入后柜台保留顺序', r.counter === 'duel,classes,items,home', r.counter);
  ok('导入后告示板保留 1 条', r.board === 1, String(r.board));
  await p.close();
}

/* ---------- D. 主题与音量键位兼容 ---------- */
section('D1 主题/音量复用既有键');
{
  const p = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await p.goto(APP + '主页.html', { waitUntil: 'load' });
  await p.waitForTimeout(900);
  const r = await p.evaluate(() => {
    var G = window.SnowdGuild;
    G.toggleTheme();
    var dark = document.documentElement.classList.contains('dark');
    var key = localStorage.getItem('_snowd_theme');
    G.setTheme('light');
    var back = localStorage.getItem('_snowd_theme');
    return { dark: dark, key: key, back: back, muted: typeof G.isMuted() === 'boolean' };
  });
  ok('切换主题写入 _snowd_theme=dark 并加 html.dark', r.dark && r.key === 'dark', JSON.stringify(r));
  ok('切回浅色写入 light', r.back === 'light');
  ok('静音状态可读', r.muted);
  await p.close();
}

await browser.close();
console.log('\n' + '─'.repeat(52));
console.log((fail === 0 ? '✅ 工会 UI 验收全部通过' : '❌ 存在失败项') + '  ' + pass + 'P / ' + fail + 'F');
process.exit(fail === 0 ? 0 : 1);

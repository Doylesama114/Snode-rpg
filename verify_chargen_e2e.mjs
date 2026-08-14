// 角色创建页 BG3 式重构 E2E 验证
// 用法: node verify_chargen_e2e.mjs   （内嵌 HTTP server，自动启停）
import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const ROOT_DIR = 'D:\\Download\\scholar-agent-main';
const PORT = 8125;
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.png': 'image/png' };
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
const CHARGEN_URL = BASE + '/%E6%96%AF%E8%AF%BA%E5%BE%B7%E8%B7%91%E5%9B%A2/%E8%A7%92%E8%89%B2%E5%88%9B%E5%BB%BA%E9%A1%B5.html';
const DRAFT_KEY = 'snowd_chargen_draft_v1';

let pass = 0, fail = 0;
function ok(name, cond, extra) {
  if (cond) { pass++; console.log('  ✅ ' + name); }
  else { fail++; console.log('  ❌ ' + name + (extra ? ' — ' + extra : '')); }
}

const browser = await chromium.launch({ headless: true });

// ============ 桌面 1280×900 ============
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  const pageErrors = [];
  page.on('pageerror', e => pageErrors.push(String(e && e.message || e)));

  await page.goto(CHARGEN_URL);
  await page.waitForTimeout(500);
  ok('创建页加载无 JS 错误', pageErrors.length === 0, pageErrors.join(' | ').slice(0, 300));

  // 1. 双栏布局
  const layout = await page.evaluate(() => {
    const main = document.querySelector('.container').getBoundingClientRect();
    const ov = document.getElementById('charOverview').getBoundingClientRect();
    const pos = getComputedStyle(document.getElementById('charOverview')).position;
    return { mainRight: Math.round(main.right), ovLeft: Math.round(ov.left), pos: pos, ovVisible: ov.width > 200 };
  });
  ok('桌面双栏：右侧状态卡在正文右侧', layout.ovLeft >= layout.mainRight - 1 && layout.ovVisible, JSON.stringify(layout));
  ok('右侧状态卡为常驻（sticky，非悬浮抽屉）', layout.pos === 'sticky', layout.pos);

  // 2. 选中法师 → 概览 + 预览按钮
  await page.evaluate(() => {
    const cards = document.querySelectorAll('#classGrid .card');
    for (const c of cards) { if (c.querySelector('.card-name').textContent.trim() === '法师') { c.click(); break; } }
  });
  await page.waitForTimeout(200);
  const afterClass = await page.evaluate(() => {
    const ovText = document.getElementById('ovContent').textContent;
    const btns = Array.from(document.querySelectorAll('#ovJump button')).map(b => b.textContent.trim());
    return { hasMage: ovText.indexOf('法师') >= 0, hasHP: /HP:\s*\d+/.test(ovText), btns: btns };
  });
  ok('选中职业后概览实时显示职业', afterClass.hasMage, JSON.stringify(afterClass));
  ok('概览实时显示 HP/FP', afterClass.hasHP, JSON.stringify(afterClass));
  ok('出现「查看技能树/进阶职业」按钮', afterClass.btns.length === 2 && afterClass.btns[0].indexOf('技能树') >= 0 && afterClass.btns[1].indexOf('进阶') >= 0, JSON.stringify(afterClass.btns));

  // 3. 全屏浮层预览：打开 → iframe 渲染 → 返回后状态不丢
  const beforeOpen = await page.evaluate(() => ({ ov: document.getElementById('ovContent').innerHTML, step: CURRENT_STEP, cls: CHAR.className }));
  await page.evaluate(() => { document.querySelectorAll('#ovJump button')[0].click(); });
  await page.waitForTimeout(900);
  const viewerOpen = await page.evaluate(() => {
    const v = document.getElementById('ovViewer');
    const f = document.getElementById('ovViewerFrame');
    return { show: v.classList.contains('show'), src: f.getAttribute('src'), locked: document.body.classList.contains('ov-viewer-open') };
  });
  const mageFrame = page.frames().find(f => decodeURIComponent(f.url()).indexOf('法师') >= 0);
  const frameInfo = mageFrame ? await mageFrame.evaluate(() => ({ title: document.title, hasContent: document.body && document.body.textContent.length > 1000 })) : null;
  ok('预览浮层打开且锁定页面滚动', viewerOpen.show && viewerOpen.src.indexOf('%E6%B3%95%E5%B8%88.html') >= 0 && viewerOpen.locked, JSON.stringify(viewerOpen));
  ok('浮层内职业页完整渲染', !!frameInfo && frameInfo.title.indexOf('法师') >= 0 && frameInfo.hasContent, JSON.stringify(frameInfo));
  await page.evaluate(() => { closeOvViewer(); });
  await page.waitForTimeout(200);
  const afterClose = await page.evaluate(() => ({ show: document.getElementById('ovViewer').classList.contains('show'), ov: document.getElementById('ovContent').innerHTML, step: CURRENT_STEP, cls: CHAR.className }));
  ok('返回创建后浮层关闭且创建状态原封不动', !afterClose.show && afterClose.ov === beforeOpen.ov && afterClose.step === beforeOpen.step && afterClose.cls === beforeOpen.cls, JSON.stringify(afterClose));

  // 4. ESC 关闭 + ↗ 新标签页
  await page.evaluate(() => { document.querySelectorAll('#ovJump button')[0].click(); });
  await page.waitForTimeout(500);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(150);
  const escClosed = await page.evaluate(() => !document.getElementById('ovViewer').classList.contains('show'));
  ok('ESC 关闭预览浮层', escClosed);
  await page.evaluate(() => { document.querySelectorAll('#ovJump button')[0].click(); });
  await page.waitForTimeout(500);
  const popupPromise = ctx.waitForEvent('page', { timeout: 8000 });
  await page.evaluate(() => { document.getElementById('ovViewerExt').click(); });
  const popup = await popupPromise;
  await popup.waitForLoadState('domcontentloaded').catch(() => {});
  ok('「↗ 新标签页打开」弹出独立页面', decodeURIComponent(popup.url()).indexOf('法师') >= 0, popup.url());
  await popup.close();
  await page.evaluate(() => { closeOvViewer(); });

  // 5. 属性实时更新
  await page.evaluate(() => { goToStep(3); });
  await page.waitForTimeout(100);
  const attrLive = await page.evaluate(() => {
    const before = document.getElementById('ovContent').textContent;
    document.getElementById('inc_力量').click();
    const after = document.getElementById('ovContent').textContent;
    return { before: /力:8/.test(before), after: /力:9/.test(after) };
  });
  ok('加点后右侧属性实时更新（力:8 → 力:9）', attrLive.before && attrLive.after, JSON.stringify(attrLive));

  // 6. 期望进阶路线
  const asp = await page.evaluate(() => {
    const chips = document.querySelectorAll('#aspPicks .asp-chip');
    if (chips.length === 0) return { chips: 0 };
    chips[0].click();
    const ta = document.getElementById('aspText');
    ta.value = '计划走火焰法师，13 级前点出六阶天赋';
    ta.dispatchEvent(new Event('input', { bubbles: true }));
    return { chips: chips.length, picks: CHAR.aspiration.picks.length, text: CHAR.aspiration.text };
  });
  ok('期望路线：职业进阶途径 chips 渲染', asp.chips >= 3, JSON.stringify(asp));
  ok('点选途径 + 输入文本写入状态', asp.picks === 1 && asp.text.indexOf('火焰法师') >= 0, JSON.stringify(asp));

  // 7. 草稿自动保存
  const draft = await page.evaluate((key) => {
    const raw = localStorage.getItem(key);
    if (!raw) return { saved: false };
    const d = JSON.parse(raw);
    return { saved: true, className: d.className, step: d._step, aspPicks: (d.aspiration && d.aspiration.picks || []).length };
  }, DRAFT_KEY);
  ok('草稿自动保存（含职业/步骤/期望路线）', draft.saved && draft.className === '法师' && draft.step === 3 && draft.aspPicks === 1, JSON.stringify(draft));

  // 8. 刷新后恢复
  await page.reload();
  await page.waitForTimeout(500);
  const restored = await page.evaluate(() => ({
    cls: CHAR.className, step: CURRENT_STEP,
    ovMage: document.getElementById('ovContent').textContent.indexOf('法师') >= 0,
    picks: CHAR.aspiration.picks.length,
    text: CHAR.aspiration.text
  }));
  ok('刷新后自动恢复草稿（职业/步骤/概览/期望路线）', restored.cls === '法师' && restored.step === 3 && restored.ovMage && restored.picks === 1 && restored.text.indexOf('火焰法师') >= 0, JSON.stringify(restored));

  // 9. 完整保存 → payload 数值一致性 + 期望路线落档 + 草稿清除
  await page.evaluate((key) => { localStorage.removeItem(key); }, DRAFT_KEY);
  await page.reload();
  await page.waitForTimeout(500);
  const saveFlow = await page.evaluate(() => {
    let wIdx = -1;
    for (let i = 0; i < CLASSES.length; i++) if (CLASSES[i].name === '战士') { wIdx = i; break; }
    CHAR.classIdx = wIdx; CHAR.className = '战士'; CHAR.classData = CLASSES[wIdx];
    CHAR.keyAttr = '力量';
    CHAR.selectedFeatures = ['猛击', '冲锋'];
    CHAR.raceIdx = 0; CHAR.raceName = RACES[0].name; CHAR.raceData = RACES[0];
    CHAR.bgIdx = 0; CHAR.bgName = BACKGROUNDS[0].name; CHAR.bgData = BACKGROUNDS[0];
    CHAR.charName = 'E2E建卡侠' + Date.now();
    CHAR.aspiration = { text: '期望走武器大师路线', picks: ['武器大师', '斗士'] };
    updateOverview();
    const ovText = document.getElementById('ovContent').textContent;
    const m = ovText.match(/HP: (\d+)/);
    return { previewHp: m ? parseInt(m[1]) : -1, charName: CHAR.charName, wIdx: wIdx, raceName: CHAR.raceName };
  });
  ok('保存前概览可算出 HP', saveFlow.previewHp > 0, JSON.stringify(saveFlow));
  await page.evaluate(() => { saveCharacter(); });
  await page.waitForTimeout(800);
  const payload = await page.evaluate((name) => {
    const raw = localStorage.getItem('char_' + name + '_slot1');
    if (!raw) return { saved: false };
    const d = JSON.parse(raw);
    return { saved: true, hp: d.hp, aspiration: d.aspirationPath || null, draftCleared: !localStorage.getItem('snowd_chargen_draft_v1') };
  }, saveFlow.charName);
  ok('保存成功写入存档', payload.saved, JSON.stringify(payload));
  ok('预览 HP == 存档 HP（数值一致性）', payload.saved && payload.hp === saveFlow.previewHp, 'preview=' + saveFlow.previewHp + ' saved=' + (payload.saved ? payload.hp : '?'));
  ok('期望进阶路线落档', payload.saved && payload.aspiration && payload.aspiration.picks.join(',') === '武器大师,斗士' && payload.aspiration.text.indexOf('武器大师') >= 0, JSON.stringify(payload.aspiration));
  ok('保存后草稿自动清除', payload.draftCleared === true, JSON.stringify(payload));

  // 10. 角色面板显示期望路线卡
  const panelUrl = BASE + '/%E6%96%AF%E8%AF%BA%E5%BE%B7%E8%B7%91%E5%9B%A2/%E8%A7%92%E8%89%B2%E9%9D%A2%E6%9D%BF.html?char=' + encodeURIComponent(saveFlow.charName) + '&slot=1';
  const panelErrors = [];
  page.on('pageerror', e => panelErrors.push(String(e && e.message || e)));
  await page.goto(panelUrl);
  await page.waitForTimeout(800);
  const panelCard = await page.evaluate(() => {
    const card = document.getElementById('aspirationCard');
    let parsed = null;
    try { parsed = JSON.parse(localStorage.getItem('_snowd_adv_last_snapshot') || 'null'); } catch (e) {}
    return {
      cardGone: !card,
      snapOk: !!(parsed && parsed.classes && parsed.aspirationPath && (parsed.aspirationPath.picks || []).length),
      snapPicks: parsed && parsed.aspirationPath ? parsed.aspirationPath.picks : null,
      snapText: parsed && parsed.aspirationPath ? (parsed.aspirationPath.text || '') : '',
      snapCls: parsed && parsed.classes ? (parsed.classes[0] && parsed.classes[0].name) : ''
    };
  });
  ok('面板加载无 JS 错误', panelErrors.length === 0, panelErrors.join(' | ').slice(0, 300));
  ok('面板不再显示期望路线卡（数据转入顾问上下文）', panelCard.cardGone, JSON.stringify(panelCard));
  ok('面板移交顾问快照（含职业与期望路线）', panelCard.snapOk && panelCard.snapPicks.join(',') === '武器大师,斗士' && panelCard.snapText.indexOf('武器大师') >= 0 && panelCard.snapCls === '战士', JSON.stringify(panelCard));

  await ctx.close();
}

// ============ 移动端 375×667 ============
{
  const ctx = await browser.newContext({ viewport: { width: 375, height: 667 } });
  const page = await ctx.newPage();
  const pageErrors = [];
  page.on('pageerror', e => pageErrors.push(String(e && e.message || e)));

  await page.goto(CHARGEN_URL);
  await page.waitForTimeout(500);
  ok('移动端无 JS 错误', pageErrors.length === 0, pageErrors.join(' | ').slice(0, 300));

  // 初始：状态抽屉收起、遮罩隐藏、无横向溢出
  const initState = await page.evaluate(() => {
    const ov = document.getElementById('charOverview');
    const bd = getComputedStyle(document.getElementById('ovSheetBackdrop')).display;
    return { open: ov.classList.contains('panel-open'), backdrop: bd, overflow: document.documentElement.scrollWidth <= window.innerWidth + 1 };
  });
  ok('移动端初始抽屉收起 + 遮罩隐藏', !initState.open && initState.backdrop === 'none', JSON.stringify(initState));
  ok('移动端无横向溢出', initState.overflow, JSON.stringify(initState));

  // 选中法师 → 吸顶状态条实时显示
  await page.evaluate(() => {
    const cards = document.querySelectorAll('#classGrid .card');
    for (const c of cards) { if (c.querySelector('.card-name').textContent.trim() === '法师') { c.click(); break; } }
  });
  await page.waitForTimeout(200);
  const strip = await page.evaluate(() => ({
    cls: document.getElementById('ccStripCls').textContent,
    hp: document.getElementById('ccStripHp').textContent,
    fp: document.getElementById('ccStripFp').textContent,
    stripDisplay: getComputedStyle(document.getElementById('ccStrip')).display
  }));
  ok('吸顶状态条显示职业与 HP/FP', strip.stripDisplay !== 'none' && strip.cls === '法师' && /\d+/.test(strip.hp) && /\d+/.test(strip.fp), JSON.stringify(strip));

  // 步骤胶囊：8 个 + 前进门禁
  const pills = await page.evaluate(() => {
    const dots = document.querySelectorAll('#stepIndicator .step-dot');
    if (dots.length !== 8) return { count: dots.length };
    // 未到达的步骤不可跳
    dots[3].click();
    const blocked = CURRENT_STEP === 0;
    // 合法前进到 1 后，可回 0、可到 1
    goToStep(1);
    dots[0].click();
    const backOk = CURRENT_STEP === 0;
    dots[1].click();
    const fwdOk = CURRENT_STEP === 1;
    return { count: dots.length, blocked, backOk, fwdOk, label: dots[0].querySelector('.step-pill-label').textContent };
  });
  ok('步骤胶囊渲染 8 个且带文字', pills.count === 8 && pills.label.length > 0, JSON.stringify(pills));
  ok('步骤胶囊前进门禁 + 往返跳转正常', pills.blocked && pills.backOk && pills.fwdOk, JSON.stringify(pills));

  // 状态条点开抽屉 → 遮罩出现 → 再点收起
  const sheetFlow = await page.evaluate(() => {
    document.getElementById('ccStrip').click();
    const opened = document.getElementById('charOverview').classList.contains('panel-open');
    const bdShown = getComputedStyle(document.getElementById('ovSheetBackdrop')).display === 'block';
    toggleOverview();
    const closed = !document.getElementById('charOverview').classList.contains('panel-open');
    const bdGone = getComputedStyle(document.getElementById('ovSheetBackdrop')).display === 'none';
    return { opened, bdShown, closed, bdGone };
  });
  ok('点状态条展开抽屉并显示遮罩，再点收起', sheetFlow.opened && sheetFlow.bdShown && sheetFlow.closed && sheetFlow.bdGone, JSON.stringify(sheetFlow));

  // 概览按钮：醒目悬浮胶囊 + 文案切换 + 不遮挡底部导航按钮
  const btnVis = await page.evaluate(() => {
    const b = document.getElementById('overviewToggle');
    const r = b.getBoundingClientRect();
    return { visible: r.top >= 0 && r.bottom <= window.innerHeight + 1 && r.width >= 100, pos: getComputedStyle(b).position, label: b.textContent.trim() };
  });
  ok('移动端角色概览按钮为醒目悬浮胶囊', btnVis.visible && btnVis.pos === 'fixed', JSON.stringify(btnVis));
  const btnLabelFlow = await page.evaluate(() => {
    document.getElementById('ccStrip').click();
    const openLabel = document.getElementById('overviewToggle').textContent.trim();
    toggleOverview();
    const closedLabel = document.getElementById('overviewToggle').textContent.trim();
    return { openLabel, closedLabel };
  });
  ok('概览按钮文案随开合切换', btnLabelFlow.openLabel.indexOf('收起') >= 0 && btnLabelFlow.closedLabel.indexOf('角色概览') >= 0, JSON.stringify(btnLabelFlow));
  const noCover = await page.evaluate(() => {
    goToStep(3);
    window.scrollTo(0, document.body.scrollHeight);
    const toggle = document.getElementById('overviewToggle').getBoundingClientRect();
    const navs = document.querySelectorAll('.nav-buttons button');
    let clear = true, detail = '';
    for (const n of navs) {
      const r = n.getBoundingClientRect();
      if (r.bottom > toggle.top + 1 && r.top < toggle.bottom - 1) { clear = false; detail = '覆盖: ' + n.textContent; break; }
    }
    return { clear, detail, toggleTop: Math.round(toggle.top), navBottom: navs.length ? Math.round(navs[navs.length - 1].getBoundingClientRect().bottom) : -1 };
  });
  ok('概览按钮不遮挡底部导航按钮', noCover.clear, JSON.stringify(noCover));

  // 预览浮层在移动端也可用
  await page.evaluate(() => {
    document.getElementById('ccStrip').click();
    const btns = document.querySelectorAll('#ovJump button');
    if (btns[0]) btns[0].click();
  });
  await page.waitForTimeout(800);
  const mViewer = await page.evaluate(() => {
    const v = document.getElementById('ovViewer');
    const r = v.getBoundingClientRect();
    return { show: v.classList.contains('show'), fits: r.left >= -1 && r.right <= window.innerWidth + 1 && r.top >= -1 };
  });
  ok('移动端预览浮层可用且不溢出', mViewer.show && mViewer.fits, JSON.stringify(mViewer));
  await page.evaluate(() => { closeOvViewer(); });

  await ctx.close();
}

await browser.close();
server.close();

console.log('\n========================');
console.log('PASS: ' + pass + '  FAIL: ' + fail);
process.exit(fail > 0 ? 1 : 0);

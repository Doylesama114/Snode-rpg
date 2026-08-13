// 商店系统 E2E 验证（v1.0.7227）
// 用法: node verify_store_e2e.mjs   （内嵌 HTTP server，自动启停）
import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

// ---- 内嵌静态服务器 ----
const ROOT_DIR = 'D:\\Download\\scholar-agent-main';
const PORT = 8124;
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.png': 'image/png', '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' };
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
const CHAR = 'E2E商店侠';
const URL = BASE + '/%E6%96%AF%E8%AF%BA%E5%BE%B7%E8%B7%91%E5%9B%A2/%E8%A7%92%E8%89%B2%E9%9D%A2%E6%9D%BF.html?char=' + encodeURIComponent(CHAR) + '&slot=1';

function buildChar() {
  const bags = ['烹饪材料包','垂钓材料包','医用材料包','草药材料包','裁缝材料包','矿石材料包','珠宝材料包','炼金材料包','铭文材料包'];
  const matPack = bags.map(t => ({ type: t, items: [] }));
  const eq = {
    '主手武器': [], '副手武器': [], '防具': [], '配饰': [], '背包': [], '杂物包': [], '旅行腰包': [], '材料包': matPack
  };
  const ci = { '背包': '已解锁', '旅行腰包': '已解锁' };
  for (const b of bags) ci[b] = '';
  return {
    name: CHAR, race: '人类', background: '侍僧', hp: 20, fp: 10, xp: 0,
    classes: [{ name: '战士', level: 3, styles: ['斗争', '', '', ''], keyAttr: '力量' }, { name: '', level: 0, styles: ['', '', '', ''] }, { name: '', level: 0, styles: ['', '', '', ''] }],
    attrs: { '力量': 16, '敏捷': 14, '体质': 14, '智力': 10, '感知': 12, '魅力': 10, '幸运': 10, '意志': 10 },
    skills: [], special_feats: [], feats: [], currency: { '金币': 1000, '银币': 0, '铜币': 0, '其他': '' },
    equipment: eq, racial_traits: [], class_features: [], languages: ['通用语'], professionals: [],
    talent_tree: [], blueprints: [], blueprint_bonus_slots: 0, forbidden_skills: [], unlocked_tiers: ['一阶', '二阶'],
    containerItems: ci, custom_items: []
  };
}

let pass = 0, fail = 0;
function ok(name, cond, extra) {
  if (cond) { pass++; console.log('  ✅ ' + name); }
  else { fail++; console.log('  ❌ ' + name + (extra ? ' — ' + extra : '')); }
}

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext();
await ctx.addInitScript((charJSON) => {
  try { localStorage.setItem('char_E2E商店侠_slot1', charJSON); } catch (e) { console.log('LS ERROR', e.message); }
}, JSON.stringify(buildChar()));

const page = await ctx.newPage();
const errors = [];
page.on('pageerror', e => errors.push(e.message));
await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 15000 });
await page.waitForTimeout(800);
ok('页面加载无 JS 错误', errors.length === 0, errors.join(' | '));

// ===== 0.5 页头与装备栏按钮 =====
const btnCheck = await page.evaluate(() => {
  const headBtns = Array.from(document.querySelectorAll('.head-actions button, header button')).map(b => (b.textContent || '').trim());
  const equipCard = document.querySelector('.equip-host-card');
  const equipBtns = equipCard ? Array.from(equipCard.querySelectorAll('button')).map(b => (b.textContent || '').trim()) : [];
  return { headCustom: headBtns.includes('➕ 自定义'), equipCustom: equipBtns.some(t => t.includes('自定义')) };
});
ok('页头不再有自定义按钮', !btnCheck.headCustom);
ok('装备栏卡片有自定义按钮', btnCheck.equipCustom);

// 1. 打开商店
await page.evaluate(() => window.openStore());
await page.waitForTimeout(200);
const catBtns = await page.$$eval('#storeCats .store-cat', els => els.map(e => e.textContent.trim()));
console.log('  分类按钮:', catBtns.join(', '));
ok('商店分类含 9 大类+容器', catBtns.length >= 10);
ok('持有金币显示 1000金币', (await page.textContent('#storeGold')).includes('1000金币'));

// 2. 小类分组
const groups0 = await page.$$eval('#storeList .store-group', els => els.map(e => e.querySelector('.store-group-head').textContent.trim()));
console.log('  杂物小类:', groups0.join(' | '));
ok('小类分组渲染（≥4 组）', groups0.length >= 4);
ok('分组默认收起（新语义）', await page.$$eval('#storeList .store-group', els => els.every(e => e.classList.contains('collapsed'))));
await page.evaluate(() => { const el = document.querySelector('#storeList .store-group-head'); toggleStoreGroup(el); });
await page.waitForTimeout(100);
const collapsed = await page.$eval('#storeList .store-group >> nth=0', e => e.classList.contains('collapsed'));
ok('点击小类头可展开（收起→展开）', !collapsed);
// 搜索时自动展开
await page.fill('#storeSearch', '长剑');
await page.waitForTimeout(150);
const searchExpanded = await page.$$eval('#storeList .store-group', els => els.every(e => !e.classList.contains('collapsed')));
ok('搜索时自动展开全部小组', searchExpanded);
// 跨大类搜索（P4-2）：杂物分类下搜武器
const crossNames = await page.$$eval('#storeList .si-name', els => els.map(e => e.textContent.trim()));
ok('搜索跨大类（杂物分类下搜到长剑）', crossNames.some(n => n.includes('长剑')), crossNames.slice(0, 3).join(','));
const crossGroups = await page.$$eval('#storeList .store-group-head', els => els.map(e => e.textContent.trim()));
console.log('  跨大类搜索分组:', crossGroups.slice(0, 6).join(' | '));
ok('跨大类搜索分组带大类名', crossGroups.some(g => g.includes('武器 · ')));
await page.fill('#storeSearch', '');
await page.waitForTimeout(150);

// ===== 2.5 商店滚动与物品可见性（修复：flex 压缩） =====
const scrollOK = await page.evaluate(() => {
  const list = document.getElementById('storeList');
  const items = Array.from(document.querySelectorAll('#storeList .store-item'));
  const sample = items.slice(0, 5).map(el => el.getBoundingClientRect().height);
  const before = list.scrollTop;
  list.scrollTop = 500;
  const changed = list.scrollTop !== before;
  list.scrollTop = 0;
  return {
    scrollable: list.scrollHeight > list.clientHeight,
    changed: changed,
    sampleHeights: sample
  };
});
ok('商店列表可滚动（修复 flex 压缩）', scrollOK.scrollable && scrollOK.changed, JSON.stringify(scrollOK));
ok('物品卡高度正常（>40px）', scrollOK.sampleHeights.every(h => h > 40), JSON.stringify(scrollOK.sampleHeights));

// ===== 2.7 商店物品卡点击详情预览（M1） =====
await page.evaluate(() => { STORE_CAT = '杂物'; renderStore(); });
await page.waitForTimeout(150);
await page.evaluate(() => storePreview('粉笔'));
await page.waitForTimeout(200);
const spv = await page.evaluate(() => {
  const vis = document.getElementById('storePreviewOverlay').classList.contains('show');
  const rows = Array.from(document.querySelectorAll('#spvBody tr')).map(e => e.textContent.trim());
  return { vis: vis, rows: rows };
});
ok('商店物品卡详情预览打开', spv.vis);
ok('预览含价格/载重行', spv.rows.some(r => r.startsWith('价格')) && spv.rows.some(r => r.startsWith('载重')), JSON.stringify(spv.rows));
await page.evaluate(() => closeOverlay('storePreviewOverlay'));

// 3. 搜索（武器分类）
await page.evaluate(() => { STORE_CAT = '武器'; renderStore(); });
await page.waitForTimeout(150);
await page.fill('#storeSearch', '长剑');
await page.waitForTimeout(150);
const searchNames = await page.$$eval('#storeList .si-name', els => els.map(e => e.textContent.trim()));
console.log('  搜索「长剑」结果:', searchNames.slice(0, 5).join(', '));
ok('搜索「长剑」有结果', searchNames.some(n => n.includes('长剑')));
ok('搜索过滤生效（结果 ≤3）', searchNames.length <= 3);
await page.fill('#storeSearch', '');
await page.waitForTimeout(150);

// 4. 购买普通物品（粉笔 1铜币）
await page.evaluate(() => { STORE_CAT = '杂物'; renderStore(); });
await page.waitForTimeout(150);
await page.evaluate(() => buyItem('粉笔'));
await page.waitForTimeout(150);
const gold1 = await page.evaluate(() => stateCopper());
ok('购买粉笔扣 1 铜币 (99999)', gold1 === 99999, 'got ' + gold1);
const heldChalk = await page.evaluate(() => countHeldItem('粉笔'));
ok('粉笔进入装备栏', heldChalk === 1, 'held=' + heldChalk);

// 5. 购买草药材料包（解锁独立槽位）
await page.evaluate(() => buyItem('草药材料包'));
await page.waitForTimeout(150);
const ciHerb = await page.evaluate(() => state.containerItems['草药材料包']);
ok('草药材料包解锁', ciHerb === '已解锁', 'got ' + ciHerb);

// 6. 买银叶草（草药）→ 自动进草药材料包
await page.evaluate(() => buyItem('银叶草'));
await page.waitForTimeout(150);
const herbSlot = await page.evaluate(() => {
  for (const s of BAG_SLOTS) {
    const arr = EQUIP[s] || [];
    for (let i = 0; i < arr.length; i++) if (arr[i] && arr[i].item === '银叶草') return s;
  }
  return null;
});
ok('银叶草自动放入草药材料包', herbSlot === '草药材料包', 'slot=' + herbSlot);

// 7. 买绷带（医用）→ 应进杂物包
await page.evaluate(() => buyItem('绷带'));
await page.waitForTimeout(150);
const bandageSlot = await page.evaluate(() => {
  const arr = EQUIP['杂物包'] || [];
  for (let i = 0; i < arr.length; i++) if (arr[i] && arr[i].item === '绷带') return '杂物包';
  return null;
});
ok('绷带（医用）进入杂物包而非草药材料包', bandageSlot === '杂物包');

// 8. 裁缝材料包 + 毛线团（缝纫）
await page.evaluate(() => buyItem('裁缝材料包'));
await page.waitForTimeout(150);
ok('裁缝材料包解锁', await page.evaluate(() => state.containerItems['裁缝材料包'] === '已解锁'));
await page.evaluate(() => buyItem('毛线团'));
await page.waitForTimeout(150);
const yarnSlot = await page.evaluate(() => {
  for (const s of BAG_SLOTS) {
    const arr = EQUIP[s] || [];
    for (let i = 0; i < arr.length; i++) if (arr[i] && arr[i].item === '毛线团') return s;
  }
  return null;
});
ok('毛线团（缝纫）放入裁缝材料包', yarnSlot === '裁缝材料包', 'slot=' + yarnSlot);

// 9. 退货
const goldBeforeRefund = await page.evaluate(() => stateCopper());
await page.evaluate(() => refundItem('粉笔'));
await page.waitForTimeout(150);
ok('退货后金币 +1 铜币', await page.evaluate(() => stateCopper()) === goldBeforeRefund + 1);
ok('退货后粉笔不在装备栏', await page.evaluate(() => countHeldItem('粉笔')) === 0);
await page.evaluate(() => refundItem('草药材料包'));
await page.waitForTimeout(150);
ok('草药材料包退货解除装备', await page.evaluate(() => state.containerItems['草药材料包'] === ''));
await page.evaluate(() => buyItem('草药材料包'));
await page.waitForTimeout(100);

// 10. 自定义物品：从商店添加
await page.evaluate(() => openStorePick());
await page.waitForTimeout(200);
await page.evaluate(() => { STORE_PICK_CAT = '武器'; renderStorePick(); });
await page.waitForTimeout(100);
// U1: 选择器小类分组
const pickGroups = await page.$$eval('#spList .store-group-head', els => els.map(e => e.textContent.trim()));
console.log('  选择器小类分组:', pickGroups.slice(0, 6).join(' | '));
ok('选择器按小类分组（武器分类）', pickGroups.some(g => g.includes('近战武器')) && pickGroups.some(g => g.includes('远程武器')), JSON.stringify(pickGroups));
// 选择器默认收起
ok('选择器分组默认收起', await page.$$eval('#spList .store-group', els => els.every(e => e.classList.contains('collapsed'))));
await page.fill('#spSearch', '长剑');
await page.waitForTimeout(150);
const pickSearchExpanded = await page.$$eval('#spList .store-group', els => els.every(e => !e.classList.contains('collapsed')));
ok('选择器搜索时自动展开', pickSearchExpanded);
await page.click('#spList .pk-item');
await page.waitForTimeout(200);
const formName = await page.inputValue('#cfName');
ok('从商店添加预填名称「长剑」', formName === '长剑', 'got ' + formName);
const formG = await page.inputValue('#cfG');
ok('价格预填 15 金币', formG === '15', 'got ' + formG);
await page.fill('#cfEffect', '测试效果：命中+1');
await page.click('#customFormOverlay .ok');
await page.waitForTimeout(200);
const customExists = await page.evaluate(() => !!customItemByName('长剑'));
ok('自定义「长剑」已保存', customExists);
const customEffect = await page.evaluate(() => (customItemByName('长剑') || {}).effect);
ok('自定义物品效果字段已保存', customEffect === '测试效果：命中+1', 'got ' + customEffect);

await page.evaluate(() => openCustomForm());
await page.waitForTimeout(100);
await page.fill('#cfName', '测试神剑');
await page.fill('#cfEffect', '挥砍造成2D6伤害');
await page.click('#customFormOverlay .ok');
await page.waitForTimeout(200);
ok('全新自定义「测试神剑」已保存', await page.evaluate(() => !!customItemByName('测试神剑')));

// P4-1: 编辑自定义物品
const editOK = await page.evaluate(() => {
  const idx = state.custom_items.findIndex(c => c.name === '测试神剑');
  if (idx < 0) return 'no item';
  editCustomItem(idx);
  // 表单应预填
  const nameVal = document.getElementById('cfName').value;
  const effVal = document.getElementById('cfEffect').value;
  document.getElementById('cfName').value = '测试神剑改';
  document.getElementById('cfEffect').value = '挥砍造成2D6伤害+1';
  saveCustomItem();
  const updated = state.custom_items.find(c => c.name === '测试神剑改');
  return { prefill: (nameVal === '测试神剑' && effVal === '挥砍造成2D6伤害'), updated: !!(updated && updated.effect === '挥砍造成2D6伤害+1') };
});
ok('编辑预填表单', editOK.prefill, JSON.stringify(editOK));
ok('编辑保存生效（改名+改效果）', editOK.updated, JSON.stringify(editOK));

// ===== 10.5 材料包按购买显示 =====
const bagDisp0 = await page.evaluate(() => {
  if (state.containerItems['裁缝材料包']) refundItem('裁缝材料包');
  renderEquip();
  const titles = Array.from(document.querySelectorAll('#equipGrid .equip-slot h3')).map(h => h.textContent);
  return { titles: titles, bagTitles: titles.filter(t => t.includes('材料包')), hintVisible: (document.getElementById('equipHint').style.display !== 'none') };
});
ok('未购买材料包不显示（仅草药材料包）', bagDisp0.bagTitles.length === 1 && bagDisp0.bagTitles[0].includes('草药材料包'), JSON.stringify(bagDisp0.titles));
ok('材料包提示行可见', bagDisp0.hintVisible);
const bagDisp1 = await page.evaluate(() => {
  for (const b of BAG_SLOTS) state.containerItems[b] = '已解锁';
  renderEquip();
  const titles = Array.from(document.querySelectorAll('#equipGrid .equip-slot h3')).map(h => h.textContent);
  return { bagTitles: titles.filter(t => t.includes('材料包')), hintHidden: (document.getElementById('equipHint').style.display === 'none'), total: titles.length };
});
ok('全部购买后 9 个材料包槽位全显示', bagDisp1.bagTitles.length === 9, JSON.stringify(bagDisp1));
ok('全购买后提示行隐藏', bagDisp1.hintHidden);
await page.evaluate(() => {
  for (const b of BAG_SLOTS) if (b !== '草药材料包') state.containerItems[b] = '';
  renderEquip();
});
await page.waitForTimeout(100);

// 11. 单击物品 → 详情表格
await page.evaluate(() => { window.renderEquip(); });
await page.waitForTimeout(150);
await page.evaluate(() => {
  for (const s of BAG_SLOTS) {
    const arr = EQUIP[s] || [];
    for (let i = 0; i < arr.length; i++) {
      if (arr[i] && arr[i].item === '银叶草') {
        const el = document.querySelector('.eq[data-slot="' + s + '"][data-idx="' + i + '"]');
        if (el) { el.click(); return true; }
      }
    }
  }
  return false;
});
await page.waitForTimeout(250);
const detailVisible = await page.evaluate(() => document.getElementById('itemOverlay').classList.contains('show'));
ok('单击物品弹出详情表格', detailVisible);
const detailRows = await page.$$eval('#itBody tr', els => els.map(e => e.textContent.trim()));
console.log('  详情行:', detailRows.join(' | '));
ok('详情表格含小类行', detailRows.some(r => r.startsWith('小类')));
ok('详情表格含价格行', detailRows.some(r => r.startsWith('价格')));

await page.evaluate(() => { closeOverlay('itemOverlay'); });
await page.evaluate(() => {
  const arr = EQUIP['杂物包'];
  const idx = arr.findIndex(x => !x);
  if (idx >= 0) arr[idx] = { item: '测试神剑改', cnt: 1, w: '' };
  renderEquip();
  const el = document.querySelector('.eq[data-slot="杂物包"][data-idx="' + idx + '"]');
  if (el) el.click();
});
await page.waitForTimeout(250);
const custRows = await page.$$eval('#itBody tr', els => els.map(e => e.textContent.trim()));
console.log('  自定义详情行:', custRows.join(' | '));
ok('自定义详情含效果行', custRows.some(r => r.startsWith('效果') && r.includes('2D6伤害+1')), JSON.stringify(custRows));
// M4: 从商店添加的自定义物品详情含小类行
const catRowOK = await page.evaluate(() => {
  closeOverlay('itemOverlay');
  const arr = EQUIP['杂物包'];
  const idx = arr.findIndex(x => !x);
  if (idx < 0) return 'no slot';
  arr[idx] = { item: '长剑', cnt: 1, w: '' };
  renderEquip();
  const el = document.querySelector('.eq[data-slot="杂物包"][data-idx="' + idx + '"]');
  el.click();
  return true;
});
await page.waitForTimeout(250);
const catRows = await page.$$eval('#itBody tr', els => els.map(e => e.textContent.trim()));
ok('商店来源自定义物品详情含小类行', catRows.some(r => r.startsWith('小类') && r.includes('近战武器')), JSON.stringify(catRows));
await page.evaluate(() => closeOverlay('itemOverlay'));

// 12. 拖拽移动
await page.evaluate(() => { closeOverlay('itemOverlay'); });
await page.waitForTimeout(100);
const dragOK = await page.evaluate(() => {
  let srcEl = null;
  for (const s of BAG_SLOTS) {
    const arr = EQUIP[s] || [];
    for (let i = 0; i < arr.length; i++) {
      if (arr[i] && arr[i].item === '银叶草') { srcEl = document.querySelector('.eq[data-slot="' + s + '"][data-idx="' + i + '"]'); break; }
    }
    if (srcEl) break;
  }
  const dst = EQUIP['杂物包'].findIndex(x => !x);
  const dstEl = document.querySelector('.eq[data-slot="杂物包"][data-idx="' + dst + '"], .eq-empty[data-slot="杂物包"][data-idx="' + dst + '"]');
  if (!srcEl || !dstEl) return 'missing el';
  const dt = new DataTransfer();
  srcEl.dispatchEvent(new DragEvent('dragstart', { bubbles: true, dataTransfer: dt }));
  dstEl.dispatchEvent(new DragEvent('dragover', { bubbles: true, cancelable: true, dataTransfer: dt }));
  dstEl.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: dt }));
  let inDst = false, inSrc = false;
  (EQUIP['杂物包'] || []).forEach(x => { if (x && x.item === '银叶草') inDst = true; });
  const srcArr = EQUIP[srcEl.getAttribute('data-slot')] || [];
  srcArr.forEach(x => { if (x && x.item === '银叶草') inSrc = true; });
  return inDst && !inSrc ? 'moved' : 'not moved (dst=' + inDst + ' src=' + inSrc + ')';
});
ok('拖拽移动物品（草药包→杂物包）', dragOK === 'moved', dragOK);

// M2: 锁定槽位拒绝拖入（退货背包后）
const lockTest = await page.evaluate(() => {
  // 退货背包（锁定背包槽）
  refundItem('背包');
  renderEquip();
  // 尝试把银叶草拖入背包空位
  let srcEl = null, dstEl = null;
  for (const s of BAG_SLOTS.concat(['杂物包'])) {
    const arr = EQUIP[s] || [];
    for (let i = 0; i < arr.length; i++) {
      if (arr[i] && arr[i].item === '银叶草') { srcEl = document.querySelector('.eq[data-slot="' + s + '"][data-idx="' + i + '"]'); break; }
    }
    if (srcEl) break;
  }
  const dstIdx = EQUIP['背包'].findIndex(x => !x);
  dstEl = document.querySelector('.eq-empty[data-slot="背包"][data-idx="' + dstIdx + '"], .eq[data-slot="背包"][data-idx="' + dstIdx + '"]');
  if (!srcEl || !dstEl) return 'missing el';
  const dt = new DataTransfer();
  srcEl.dispatchEvent(new DragEvent('dragstart', { bubbles: true, dataTransfer: dt }));
  dstEl.dispatchEvent(new DragEvent('dragover', { bubbles: true, cancelable: true, dataTransfer: dt }));
  dstEl.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: dt }));
  let inBag = false;
  (EQUIP['背包'] || []).forEach(x => { if (x && x.item === '银叶草') inBag = true; });
  // 背包槽位无 + 号按钮
  const bagSlot = Array.from(document.querySelectorAll('.equip-slot')).find(sl => (sl.querySelector('h3') || {}).textContent && sl.querySelector('h3').textContent.indexOf('背包') === 0);
  const addBtn = bagSlot ? bagSlot.querySelector('.eq-add-btn') : null;
  // 重新买回背包
  buyItem('背包');
  return { inBag: inBag, addBtnHidden: !addBtn };
});
ok('锁定背包槽拒绝拖入', lockTest.inBag === false, JSON.stringify(lockTest));
ok('锁定背包槽隐藏添加按钮', lockTest.addBtnHidden, JSON.stringify(lockTest));

// 13. 详情「移动」按钮模式
const moveModeOK = await page.evaluate(() => {
  // 银叶草现在应在草药材料包（若拖拽成功则在杂物包）
  let srcSlot = null, srcIdx = -1;
  for (const s of BAG_SLOTS.concat(['杂物包'])) {
    const arr = EQUIP[s] || [];
    const i = arr.findIndex(x => x && x.item === '银叶草');
    if (i >= 0) { srcSlot = s; srcIdx = i; break; }
  }
  if (srcSlot === null) return 'no item';
  startMoveFromDetail(srcSlot, srcIdx);
  const dstSlot = srcSlot === '杂物包' ? '草药材料包' : '杂物包';
  const dstIdx = EQUIP[dstSlot].findIndex(x => !x);
  if (dstIdx < 0) return 'no dst';
  const el = document.querySelector('.eq[data-slot="' + dstSlot + '"][data-idx="' + dstIdx + '"], .eq-empty[data-slot="' + dstSlot + '"][data-idx="' + dstIdx + '"]');
  el.click();
  let inDst = false;
  (EQUIP[dstSlot] || []).forEach(x => { if (x && x.item === '银叶草') inDst = true; });
  return inDst ? 'moved' : 'not moved';
});
ok('详情「移动」按钮模式移动成功', moveModeOK === 'moved', moveModeOK);

// 14. 持久化
await page.evaluate(() => { state._dirty = true; saveState(1); });
const persisted = await page.evaluate(() => {
  const raw = localStorage.getItem('char_E2E商店侠_slot1');
  if (!raw) return 'no save';
  const st = JSON.parse(raw);
  return (st.containerItems['草药材料包'] === '已解锁' && (st.custom_items || []).length >= 2) ? 'ok' : 'mismatch';
});
ok('存档持久化（解锁+自定义物品）', persisted === 'ok', persisted);

// ===== 14.5 风格判断与同名技能效果（v1.0.7230） =====
const styleTest = await page.evaluate(() => {
  const out = {};
  // 1) 起始技能 + 起始天赋 → 不计入风格
  state = JSON.parse(JSON.stringify(state));
  state.classes = [{ name: '法师', level: 1, styles: ['', '', '', ''], keyAttr: '智力' }, { name: '', level: 0, styles: ['', '', '', ''] }, { name: '', level: 0, styles: ['', '', '', ''] }];
  state.skills = [{ n: '塑能箭', src: '法师', sub: '' }];
  state.talent_tree = [{ n: '塑能箭', cls: '法师', tier: '一阶' }];
  autoCalcStyles();
  out.startingOnly = JSON.stringify(state.classes[0].styles);
  // 2) 起始技能 + 真实风格技能 → 正确风格
  state.skills = [{ n: '塑能箭', src: '法师', sub: '' }, { n: '火球术', src: '法师', sub: '' }];
  state.talent_tree = [];
  autoCalcStyles();
  out.withNormal = JSON.stringify(state.classes[0].styles);
  // 3) 非起始同名天赋保留计入（导入场景）
  state.skills = [];
  state.talent_tree = [{ n: '火球术', cls: '法师', tier: '一阶' }];
  autoCalcStyles();
  out.nonStartingTalent = JSON.stringify(state.classes[0].styles);
  // 4) 同名技能效果按 src 精确取：奇械师魔法武器 vs 法师魔法武器
  const mageMeta = SB_findSkillMeta('魔法武器', '法师');
  const artiMeta = SB_findSkillMeta('魔法武器', '奇械师');
  out.mageDesc = (mageMeta && mageMeta.description || []).join(' ').slice(0, 30);
  out.artiDesc = (artiMeta && artiMeta.description || []).join(' ').slice(0, 30);
  out.same = out.mageDesc === out.artiDesc;
  // 5) fallback：无 src 时全局查仍可用
  out.fallback = !!SB_findSkillMeta('魔法武器');
  return out;
});
ok('起始技能+起始天赋不计入风格（styles 全空）', styleTest.startingOnly === '["","","",""]', styleTest.startingOnly);
ok('起始技能+真实风格技能推断正确', styleTest.withNormal.includes('塑能'), styleTest.withNormal);
ok('非起始同名天赋保留计入', styleTest.nonStartingTalent.includes('塑能'), styleTest.nonStartingTalent);
ok('同名技能按 src 精确取效果（奇械师≠法师）', !styleTest.same, JSON.stringify({ 法师: styleTest.mageDesc, 奇械师: styleTest.artiDesc }));
ok('无 src 时全局 fallback 正常', styleTest.fallback);

// // ===== 14.8 立绘等比显示（修复压扁） =====
const portraitOK = await page.evaluate(async () => {
  const cv = document.createElement('canvas');
  cv.width = 200; cv.height = 400; // 竖版 1:2
  const ctx = cv.getContext('2d');
  ctx.fillStyle = '#4a90d9'; ctx.fillRect(0, 0, 200, 400);
  state.portrait = cv.toDataURL('image/png');
  await new Promise(res => SB_loadPortraitRatio(res));
  const el = document.createElement('div');
  el.style.width = '140px'; el.style.height = '140px';
  el.style.backgroundImage = 'url("' + state.portrait + '")';
  avatarStyle(el);
  const vertical = { ratio: AV.imgRatio, size: el.style.backgroundSize };
  cv.width = 400; cv.height = 200; // 横版 2:1
  ctx.fillStyle = '#d94a4a'; ctx.fillRect(0, 0, 400, 200);
  state.portrait = cv.toDataURL('image/png');
  await new Promise(res => SB_loadPortraitRatio(res));
  avatarStyle(el);
  const horizontal = { ratio: AV.imgRatio, size: el.style.backgroundSize };
  return { vertical: vertical, horizontal: horizontal };
});
ok('竖版立绘按宽等比缩放（非 160% 160% 压扁）', portraitOK.vertical.ratio === 0.5 && portraitOK.vertical.size === '160%', JSON.stringify(portraitOK.vertical));
ok('横版立绘按高等比缩放', portraitOK.horizontal.ratio === 2 && portraitOK.horizontal.size === 'auto 160%', JSON.stringify(portraitOK.horizontal));

// // 15. 旧存档迁移（页面内构造旧格式 state 直接验证迁移函数）
const migrated = await page.evaluate(() => {
  const oldState = {
    name: 'E2E商店侠', containerItems: { '背包': '已解锁', '旅行腰包': '已解锁', '材料包A': '烹饪材料包', '材料包B': '草药材料包' },
    equipment: {
      '材料包': [
        { type: '烹饪材料包', items: [{ item: '面粉', count: 2, w: '' }, null] },
        { type: '草药材料包', items: [{ item: '银叶草', count: 1, w: '' }] }
      ]
    }
  };
  state = oldState;
  migrateContainerState();
  const c = state.containerItems;
  const mp = state.equipment['材料包'];
  return {
    c1: c['烹饪材料包'], c2: c['草药材料包'],
    hasOld: ('材料包A' in c) || ('材料包B' in c),
    len: mp.length,
    first: mp[0] && mp[0].type, last: mp[8] && mp[8].type,
    flour: (mp[0].items || []).filter(x => x && x.item === '面粉').length
  };
});
ok('旧存档迁移：容器键转换', migrated.c1 === '已解锁' && migrated.c2 === '已解锁' && !migrated.hasOld, JSON.stringify(migrated));
ok('旧存档迁移：材料包数组 9 元素', migrated.len === 9 && migrated.first === '烹饪材料包' && migrated.last === '铭文材料包', JSON.stringify(migrated));
ok('旧存档迁移：物品保留', migrated.flour === 1, 'flour=' + migrated.flour);
ok('迁移后无 JS 错误', errors.length === 0, errors.join(' | '));

// 失败时自动截图存档（配合视觉审核）
if (fail > 0) {
  try {
    const shotDir = 'D:\\Download\\scholar-agent-main\\screenshots';
    fs.mkdirSync(shotDir, { recursive: true });
    const shotPath = shotDir + '\\store-fail-' + new Date().toISOString().replace(/[:.]/g, '-') + '.png';
    await page.screenshot({ path: shotPath, fullPage: false });
    console.log('\n📸 失败截图已保存: ' + shotPath);
  } catch (e) {
    console.log('截图失败:', e.message);
  }
}
await browser.close();
await new Promise(resolve => server.close(resolve));
console.log('\n========================');
console.log('PASS: ' + pass + '  FAIL: ' + fail);
process.exit(fail === 0 ? 0 : 1);

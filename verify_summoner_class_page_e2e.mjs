// 召唤师职业页 E2E：47 技能卡 / 2 风格 / 3 专长 / 3 抉择 / 契约生物切换区（20 系别）
import { chromium } from 'playwright';
import fs from 'node:fs';

const root = process.cwd().split('\\').join('/');
const browser = await chromium.launch();
let pass = 0, fail = 0;
function ok(name, cond, extra) { if (cond) { pass++; console.log('PASS', name); } else { fail++; console.log('FAIL', name, extra || ''); } }

const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const errs = [];
page.on('pageerror', e => errs.push('pageerror: ' + e.message));
page.on('console', m => { if (m.type() === 'error' && !/audio\//.test(m.text())) errs.push('console: ' + m.text()); });
await page.goto('file:///' + root + '/职业页/召唤师.html', { waitUntil: 'load' });
await page.waitForTimeout(900);

const info = await page.evaluate(() => {
  const cards = [...document.querySelectorAll('article.skill')];
  const sec = document.getElementById('sm-contract-creatures');
  const chips = sec ? [...sec.querySelectorAll('.class-feature-chip')] : [];
  const panels = sec ? [...sec.querySelectorAll('.class-feature-panel')] : [];
  return {
    cards: cards.length,
    styles: [...new Set([...document.querySelectorAll('h3[id^="sm-style-"]')].map(h => h.textContent.trim()))],
    featureChips: [...document.querySelectorAll('#sm-class-features .class-feature-chip')].map(c => c.textContent.trim()),
    choiceNotes: document.querySelectorAll('.choice-note').length,
    navChoices: [...document.querySelectorAll('nav .nav-choice')].map(a => a.textContent.trim()),
    advHref: !!document.querySelector('nav a[href="召唤师·进阶.html"]') || /召唤师·进阶\.html/.test(document.documentElement.innerHTML),
    contractChips: chips.length,
    contractPanels: panels.length,
    activePanels: panels.filter(p => p.classList.contains('active')).length,
    firstChip: chips[0]?.textContent.trim(),
    firstPanelText: (panels[0]?.textContent || '').replace(/\s+/g, ' ').slice(0, 600),
    starting: [...document.querySelectorAll('nav .tier-list a')].map(a => a.textContent.trim()),
  };
});
ok('技能卡 47 张', info.cards === 47, String(info.cards));
ok('风格 2 个（咒法/降灵）', info.styles.length === 2 && info.styles.join('、').includes('咒法'), info.styles.join('、'));
ok('职业专长 3 条', info.featureChips.join('、') === '召唤联结、异界感知、机缘召唤', info.featureChips.join('、'));
ok('起始特性 3 条', info.starting.join('、') === '魔法飞弹、次级召唤术、唤回', info.starting.join('、'));
ok('3 组抉择（nav-choice）', info.navChoices.length === 3 && info.choiceNotes === 3, JSON.stringify({ nav: info.navChoices, notes: info.choiceNotes }));
ok('进阶入口存在', info.advHref);
ok('契约生物区 20 chip / 20 面板', info.contractChips === 20 && info.contractPanels === 20, `${info.contractChips}/${info.contractPanels}`);
ok('契约生物首个默认为火焰系·烬火狐', info.firstChip === '火焰系·烬火狐' && info.activePanels === 1, info.firstChip);
ok('契约卡含 AC/HP/属性/特性', /防御等级 13/.test(info.firstPanelText) && /力量/.test(info.firstPanelText) && /火焰亲和/.test(info.firstPanelText), info.firstPanelText);

// 切换测试：点击第 20 个 chip（通用系·棕纹狼）与第 5 个（水源系·潮汐龟）
const sw = await page.evaluate(() => {
  const sec = document.getElementById('sm-contract-creatures');
  const chips = [...sec.querySelectorAll('.class-feature-chip')];
  const panels = [...sec.querySelectorAll('.class-feature-panel')];
  const out = [];
  for (const idx of [4, 19]) {
    chips[idx].click();
    const active = panels.find(p => p.classList.contains('active'));
    out.push({ chip: chips[idx].textContent.trim(), id: active.id, txt: active.textContent.replace(/\s+/g, ' ').slice(0, 600) });
  }
  return out;
});
ok('切换到水源系·潮汐龟', sw[0].id === 'sm-contract-潮汐龟' && /防御等级 16/.test(sw[0].txt), JSON.stringify(sw[0]));
ok('切换到通用系·棕纹狼', sw[1].id === 'sm-contract-棕纹狼' && /啃咬/.test(sw[1].txt), JSON.stringify(sw[1]));

// 搜索只做高亮（不隐藏），契约区不受影响
await page.fill('#sm-search', '蓝焰术');
await page.waitForTimeout(600);
const search = await page.evaluate(() => {
  const sec = document.getElementById('sm-contract-creatures');
  return {
    visible: !!sec,
    highlights: document.querySelectorAll('.search-highlight').length,
    highlightsInContract: sec ? sec.querySelectorAll('.search-highlight').length : -1,
    contractPanels: sec ? sec.querySelectorAll('.class-feature-panel').length : 0,
  };
});
ok('搜索高亮生效且不影响契约区', search.visible && search.highlights > 0 && search.highlightsInContract === 0 && search.contractPanels === 20, JSON.stringify(search));

ok('职业页无 JS 错误', errs.length === 0, errs.join(' | '));
await browser.close();
console.log(`\n召唤师职业页E2E: ${pass}P ${fail}F`);
process.exit(fail > 0 ? 1 : 0);

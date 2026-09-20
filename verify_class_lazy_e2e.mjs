// 职业页懒渲染与首屏性能 E2E（26.09.20）
// 把桌面端性能修复的硬指标固化为回归门禁：
//   · 技能卡 detail 必须已搬入 <template class="skill-body">（scripts/apply_lazy_skill_cards.mjs 生效）
//   · 首屏 DOM 规模与最长长任务不得超过上限
//   · 滚动后必须能实例化出 detail（懒渲染不能把内容弄丢）
//   · 站内搜索必须命中且有防抖（同步阻塞 < 5ms）
//   · 页面无 JS 错误
import { chromium } from 'playwright';
import { join } from 'path';

const BASE = 'D:\\Download\\scholar-agent-main';
const PAGES = [
  ['法师', '法师.html'],
  ['牧师', '牧师.html'],
  ['通用天赋树', '通用天赋树.html'],
  ['召唤师', '召唤师.html'],
];
const DOM_LIMIT = 15000;        // 首屏活跃 DOM 上限（改造前法师页 27,051）
const LONG_TASK_LIMIT = 1000;   // 首屏最长长任务上限 ms（改造前 1,614）
const SEARCH_SYNC_LIMIT = 5;    // 单次输入同步阻塞上限 ms（防抖前 24~46）

const INIT = 'window.__lt=0;window.__ltMax=0;try{new PerformanceObserver(function(l){var e=l.getEntries();for(var i=0;i<e.length;i++){window.__lt++;if(e[i].duration>window.__ltMax)window.__ltMax=e[i].duration;}}).observe({entryTypes:["longtask"]});}catch(e){}';

let pass = 0, fail = 0;
const ok = (name, cond, extra) => {
  if (cond) { pass++; console.log('PASS ' + name + (extra ? ' — ' + extra : '')); }
  else { fail++; console.log('FAIL ' + name + (extra ? ' — ' + extra : '')); }
};

const browser = await chromium.launch({ headless: true });
for (const [label, file] of PAGES) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errs = [];
  page.on('pageerror', (e) => errs.push(e.message));
  await page.addInitScript(INIT);
  const t0 = Date.now();
  await page.goto('file:///' + join(BASE, '职业页', file).replace(/\\/g, '/'), { waitUntil: 'load', timeout: 40000 });
  const loadMs = Date.now() - t0;
  await page.waitForTimeout(1200);

  const before = await page.evaluate(() => ({
    live: document.getElementsByTagName('*').length,
    cards: document.querySelectorAll('article.skill').length,
    templates: document.querySelectorAll('template.skill-body').length,
    details: document.querySelectorAll('div.detail').length,
    ltMax: Math.round(window.__ltMax || 0),
    hasApi: !!window.__snowdLazySkills,
  }));
  ok(label + ' 卡片已改造为 template', before.templates > 0, 'templates=' + before.templates + '/' + before.cards);
  ok(label + ' 首屏 DOM 规模', before.live < DOM_LIMIT, 'live=' + before.live + ' (limit ' + DOM_LIMIT + ')');
  ok(label + ' 首屏最长长任务', before.ltMax < LONG_TASK_LIMIT, before.ltMax + 'ms (limit ' + LONG_TASK_LIMIT + ')');
  ok(label + ' 懒渲染 API 已加载', before.hasApi);

  // 滚动到底：应当实例化出 detail（内容不丢）
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(2000);
  const after = await page.evaluate(() => ({
    hydrated: document.querySelectorAll('article.skill[data-hydrated]').length,
    details: document.querySelectorAll('div.detail').length,
  }));
  ok(label + ' 滚动后实例化出详情', after.details > 0, 'hydrated=' + after.hydrated + ' details=' + after.details);

  // 站内搜索：同步开销（防抖后应接近 0）与命中
  const search = await page.evaluate(() => {
    const el = document.querySelector('input[type="search"]');
    if (!el) return null;
    // 取词必须来自 data-search（h4 里可能含 SP 徽章等子元素，textContent 会混入非文本标记）
    const art = document.querySelector('article.skill');
    const ds = art ? (art.getAttribute('data-search') || '') : '';
    const term = (ds.trim().split(/\s+/)[0] || '火').slice(0, 2);
    const t = performance.now();
    el.value = term;
    el.dispatchEvent(new Event('input', { bubbles: true }));
    return { syncMs: +(performance.now() - t).toFixed(2), term: term };
  });
  if (!search) { ok(label + ' 站内搜索输入框存在', false); }
  else {
    ok(label + ' 搜索输入同步阻塞', search.syncMs < SEARCH_SYNC_LIMIT, search.syncMs + 'ms (limit ' + SEARCH_SYNC_LIMIT + ')');
    await page.waitForTimeout(700);
    // 懒渲染下高亮只作用于已实例化的可见卡片：把首个命中卡片滚入视口后再断言
    await page.evaluate(() => {
      const el = document.querySelector('article.skill:not(.hidden)');
      if (el) el.scrollIntoView({ block: 'center' });
    });
    await page.waitForTimeout(900);
    const res = await page.evaluate(() => ({
      visible: document.querySelectorAll('article.skill:not(.hidden)').length,
      highlights: document.querySelectorAll('.search-highlight').length,
    }));
    ok(label + ' 搜索命中且滚动后高亮', res.visible > 0 && res.highlights > 0, 'visible=' + res.visible + ' highlights=' + res.highlights);
  }
  ok(label + ' 页面无 JS 错误', errs.length === 0, errs.slice(0, 2).join(' | '));
  await page.close();
}
await browser.close();
console.log('\n职业页懒渲染 E2E: ' + pass + 'P ' + fail + 'F');
process.exit(fail > 0 ? 1 : 0);

import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1280, height: 900 });
  
  const url = 'https://snode-rpg.pages.dev/%E8%81%8C%E4%B8%9A%E9%A1%B5/%E6%B8%B8%E8%8D%A1%E8%80%85.html';
  await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(2000);

  let ok = true;
  const check = (label, pass, detail) => {
    console.log((pass ? '✅' : '❌') + ' ' + label + (detail ? ' | ' + detail : ''));
    if (!pass) ok = false;
  };

  // === Expand ALL nav groups before testing ===
  console.log('--- Expanding nav ---');
  const summaries = page.locator('nav details summary');
  const sumCount = await summaries.count();
  console.log('Nav summaries:', sumCount);
  for (let i = 0; i < sumCount; i++) {
    try {
      await summaries.nth(i).dispatchEvent('click');
      await page.waitForTimeout(100);
    } catch(e) {}
  }
  await page.waitForTimeout(500);

  // === 1. Click nav links and verify scroll ===
  console.log('\n--- Nav Click + Scroll Tests ---');
  
  const targets = [
    { href: '#r-tier-1-2', id: 'r-tier-1-2', label: '二阶 (奇袭)' },
    { href: '#r-tier-奇袭风格-四阶', id: 'r-tier-奇袭风格-四阶', label: '四阶奇袭 (was orphan)' },
    { href: '#r-tier-妙手风格-四阶', id: 'r-tier-妙手风格-四阶', label: '四阶妙手 (was orphan)' },
    { href: '#r-tier-魅影风格-四阶', id: 'r-tier-魅影风格-四阶', label: '四阶魅影 (was orphan)' },
    { href: '#r-tier-狂妄风格-四阶', id: 'r-tier-狂妄风格-四阶', label: '四阶狂妄 (was orphan)' },
    { href: '#r-tier-魔药风格-三阶', id: 'r-tier-魔药风格-三阶', label: '三阶魔药 (was orphan)' },
  ];

  for (const t of targets) {
    const link = page.locator('nav a[href="' + t.href + '"]');
    const linkCount = await link.count();
    if (linkCount === 0) {
      check(t.label + ' nav link', false, 'NOT FOUND');
      continue;
    }
    
    // Force click (even if inside collapsed details)
    await link.first().click({ force: true });
    await page.waitForTimeout(500);
    
    const targetEl = page.locator('#' + t.id);
    const elCount = await targetEl.count();
    if (elCount === 0) {
      check(t.label + ' target exists', false, 'MISSING');
      continue;
    }
    
    const info = await targetEl.evaluate(el => {
      const rect = el.getBoundingClientRect();
      return {
        top: Math.round(rect.top),
        inView: rect.top > -100 && rect.top < window.innerHeight + 100,
      };
    });
    
    check(t.label + ' in viewport', info.inView, 'top=' + info.top);
  }

  // === 2. Content behind nav check ===
  console.log('\n--- Content Behind Nav Check ---');
  
  const testSkills = [
    { id: 'r-skill-58', name: '死亡印记' },
    { id: 'r-skill-66', name: '杂耍打击' },
    { id: 'r-skill-70', name: '鬼魅攻击' },
    { id: 'r-skill-78', name: '胆大妄为' },
    { id: 'r-skill-79', name: '菊花茶' },
  ];

  for (const s of testSkills) {
    const el = page.locator('#' + s.id);
    if (await el.count() === 0) { check(s.name, false, 'NOT FOUND'); continue; }
    
    await el.scrollIntoViewIfNeeded();
    await page.waitForTimeout(200);
    
    const info = await el.evaluate((el, navW) => {
      const rect = el.getBoundingClientRect();
      return {
        visible: rect.width > 0 && rect.height > 0,
        left: Math.round(rect.left),
        top: Math.round(rect.top),
        behindNav: rect.left < navW,
      };
    }, 300);
    
    check(s.name, info.visible && !info.behindNav,
      `left=${info.left} top=${info.top}${info.behindNav ? ' BEHIND NAV!' : ''}`);
  }

  // === 3. Field boldness (interactive) ===
  console.log('\n--- Field Boldness ---');
  await page.locator('#r-skill-21').scrollIntoViewIfNeeded();
  await page.waitForTimeout(300);
  
  const fields = page.locator('#r-skill-21 .detail .field');
  const fc = await fields.count();
  let boldCount = 0;
  for (let i = 0; i < fc; i++) {
    const f = fields.nth(i);
    const text = await f.textContent();
    const fw = await f.evaluate(el => window.getComputedStyle(el).fontWeight);
    if (text && text.includes('级时') && (fw === '700' || parseInt(fw) >= 600)) boldCount++;
  }
  check('窃贼的交易 level fields bold', boldCount > 0, boldCount + ' fields');

  // === 4. JS errors ===
  const errors = [];
  page.on('pageerror', err => errors.push(err.message));
  await page.waitForTimeout(500);
  check('JS errors: none', errors.length === 0, errors[0] || '');

  // === 5. Style sections rendered correctly ===
  console.log('\n--- Style Sections ---');
  const sections = ['r-style-1','r-style-2','r-style-3','r-style-4','r-style-5'];
  let sectionOk = true;
  for (const sec of sections) {
    const s = page.locator('#' + sec);
    if (await s.count() === 0) { check(sec, false, 'MISSING'); sectionOk = false; }
  }
  if (sectionOk) check('All 5 style sections exist', true);

  console.log('\n' + (ok ? '=== ✅ ALL PASS ===' : '=== ❌ SOME FAILED ==='));
  await browser.close();
  process.exit(ok ? 0 : 1);
})().catch(e => { console.error(e.message); process.exit(1); });

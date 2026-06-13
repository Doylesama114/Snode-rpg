import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1280, height: 900 });
  
  const url = 'https://snode-rpg.pages.dev/%E8%81%8C%E4%B8%9A%E9%A1%B5/%E6%B8%B8%E8%8D%A1%E8%80%85.html';
  console.log('Opening:', url);
  await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(2000);

  let ok = true;
  const check = (label, pass, detail) => {
    console.log((pass ? '✅' : '❌') + ' ' + label + (detail ? ' | ' + detail : ''));
    if (!pass) ok = false;
  };

  // === 1. Click through nav links and verify content scrolls into view ===
  console.log('\n--- Nav Click Tests ---');
  
  // Expand 奇袭 nav group
  const qixiGroup = page.locator('nav .nav-group').first();
  const summary = qixiGroup.locator('summary').first();
  await summary.click();
  await page.waitForTimeout(300);
  
  // Click 二阶 link
  const tier2Link = page.locator('nav a[href="#r-tier-1-2"]');
  const tier2Exists = await tier2Link.count();
  check('二阶 nav link exists', tier2Exists > 0);
  
  if (tier2Exists > 0) {
    await tier2Link.first().click();
    await page.waitForTimeout(500);
    
    const tier2Visible = await page.locator('#r-tier-1-2').evaluate(el => {
      const rect = el.getBoundingClientRect();
      return rect.top >= 0 && rect.top < window.innerHeight;
    });
    check('二阶 scrolls into view', tier2Visible, tier2Visible ? '' : 'NOT scrolled');
  }

  // Click 四阶 link (was an orphan section)
  const tier4Link = page.locator('nav a[href="#r-tier-奇袭风格-四阶"]');
  if (await tier4Link.count() > 0) {
    await tier4Link.first().click();
    await page.waitForTimeout(500);
    
    const tier4Visible = await page.locator('#r-tier-奇袭风格-四阶').evaluate(el => {
      const rect = el.getBoundingClientRect();
      return rect.top >= 0 && rect.top < window.innerHeight;
    });
    check('四阶 scrolls into view (was orphan)', tier4Visible, tier4Visible ? '' : 'NOT scrolled');
  }

  // === 2. Verify content is NOT hidden behind nav ===
  console.log('\n--- Content Visibility Tests ---');
  
  // Check several skills are visible and not overlapped
  const skills = [
    { id: 'r-skill-16', name: '抛沙' },
    { id: 'r-skill-58', name: '死亡印记 (orphan四阶)' },
    { id: 'r-skill-66', name: '杂耍打击 (orphan妙手四阶)' },
    { id: 'r-skill-70', name: '鬼魅攻击 (orphan魅影四阶)' },
    { id: 'r-skill-78', name: '胆大妄为 (orphan狂妄四阶)' },
    { id: 'r-skill-79', name: '菊花茶 (orphan魔药三阶)' },
  ];

  for (const s of skills) {
    const el = page.locator('#' + s.id);
    const cnt = await el.count();
    if (cnt === 0) {
      check(s.name + ' exists', false, 'NOT FOUND');
      continue;
    }
    await el.scrollIntoViewIfNeeded();
    await page.waitForTimeout(200);
    
    const info = await el.evaluate(el => {
      const rect = el.getBoundingClientRect();
      const style = window.getComputedStyle(el);
      return {
        visible: rect.width > 0 && rect.height > 0,
        top: Math.round(rect.top),
        left: Math.round(rect.left),
        display: style.display,
        visibility: style.visibility,
        opacity: style.opacity,
        zIndex: style.zIndex,
      };
    });
    
    const navWidth = 300; // nav sidebar ~300px
    const isBehindNav = info.visible && info.left < navWidth && info.top < 700;
    check(s.name, info.visible && !isBehindNav,
      `top=${info.top} left=${info.left} ${isBehindNav ? 'BEHIND NAV!' : 'clear'}`);
  }

  // === 3. Verify field spans are actually bold (interactive check) ===
  console.log('\n--- Field Boldness Test ---');
  
  // Scroll to a specific skill with level upgrades
  await page.locator('#r-skill-21').scrollIntoViewIfNeeded();
  await page.waitForTimeout(300);
  
  const fields = page.locator('#r-skill-21 .detail .field');
  const fieldCount = await fields.count();
  let boldCount = 0;
  for (let i = 0; i < fieldCount; i++) {
    const f = fields.nth(i);
    const text = await f.textContent();
    const fw = await f.evaluate(el => window.getComputedStyle(el).fontWeight);
    if (text && text.includes('级时') && (fw === '700' || parseInt(fw) >= 600)) {
      boldCount++;
    }
  }
  check('窃贼的交易 level fields bold', boldCount > 0, boldCount + ' bold fields');

  // === 4. JS errors ===
  console.log('\n--- JS Errors ---');
  const errors = [];
  page.on('pageerror', err => errors.push(err.message));
  await page.waitForTimeout(500);
  check('No JS errors', errors.length === 0, errors.length ? errors[0] : '');

  // === 5. Skill count sanity ===
  console.log('\n--- Skill Counts ---');
  const totalSkills = await page.locator('article.skill').count();
  check('Total skills: ' + totalSkills, totalSkills > 75, '');

  console.log('\n' + (ok ? '=== ✅ ALL PASS ===' : '=== ❌ SOME FAILED ==='));
  await browser.close();
  process.exit(ok ? 0 : 1);
})().catch(e => { console.error(e); process.exit(1); });

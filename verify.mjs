import { chromium } from 'playwright';

async function main() {
  const browser = await chromium.launch({ headless: true });
  let allPassed = true;

  try {
    // ====== TEST 1: 角色面板 smoke ======
    console.log('=== TEST 1: 角色面板.html ===');
    const p1 = await browser.newPage();
    const e1 = [];
    p1.on('pageerror', e => e1.push(e.message));
    await p1.goto('http://localhost:8765/角色面板.html', { waitUntil: 'networkidle', timeout: 15000 });
    await p1.waitForTimeout(2000);
    if (e1.length === 0) console.log('✅ No console errors');
    else { console.log('❌ ' + e1.length + ' errors'); e1.forEach(e => console.log('   ', e)); allPassed = false; }
    await p1.close();

    // ====== TEST 2: tests.html ======
    console.log('\n=== TEST 2: tests.html ===');
    const p2 = await browser.newPage();
    const e2 = [];
    p2.on('pageerror', e => e2.push(e.message));
    await p2.goto('http://localhost:8765/tests.html', { waitUntil: 'networkidle', timeout: 15000 });
    await p2.waitForSelector('.summary', { timeout: 10000 });
    await p2.waitForTimeout(500);

    const sum = await p2.textContent('.summary');
    console.log(sum.trim());
    
    const pass = await p2.evaluate(() => document.querySelectorAll('.pass').length);
    const fail = await p2.evaluate(() => document.querySelectorAll('.fail').length);
    console.log(`Pass: ${pass}, Fail: ${fail}`);
    if (fail > 0) {
      const fails = await p2.evaluate(() => 
        Array.from(document.querySelectorAll('.fail')).map(el => {
          var p = el.parentNode;
          return p.textContent || el.textContent;
        })
      );
      console.log('Failing:'); fails.forEach(t => console.log('  ', t.substring(0, 200)));
      allPassed = false;
    }
    if (e2.length > 0) { console.log('Console errors:'); e2.forEach(e => console.log('  ', e)); }
    await p2.close();

    console.log(allPassed ? '\n✅ ALL PASSED' : '\n❌ FAILURES');
    process.exit(allPassed ? 0 : 1);
  } finally { await browser.close(); }
}
main().catch(e => { console.error('FATAL:', e); process.exit(1); });

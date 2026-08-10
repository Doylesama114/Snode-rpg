import { chromium } from 'playwright';
import { readdirSync } from 'fs';
import { join } from 'path';
import { spawnSync } from 'child_process';

const BASE = 'D:\\Download\\scholar-agent-main';
const RUN_DIRS = ['斯诺德跑团', '职业页'];

let pages = [];
for (let dir of RUN_DIRS) {
  let dp = join(BASE, dir);
  for (let f of readdirSync(dp)) {
    if (f.endsWith('.html') && !f.includes('_backup_') && f !== 'verify.html') {
      pages.push({ dir, file: f, path: 'file:///' + join(dp, f).replace(/\\/g, '/') });
    }
  }
}

console.log(`Total: ${pages.length} pages\n`);
const browser = await chromium.launch({ headless: true });
let results = [], totalErrors = 0;

for (let i = 0; i < pages.length; i++) {
  let p = pages[i];
  let page = await browser.newPage();
  let errors = [];
  page.on('pageerror', e => errors.push(e.message));
  try {
    await page.goto(p.path, { waitUntil: 'domcontentloaded', timeout: 10000 });
    await page.waitForTimeout(300);
  } catch (e) { errors.push('LOAD FAILED: ' + e.message); }
  totalErrors += errors.length;
  console.log(`${errors.length ? '❌' : '✅'} ${p.dir}/${p.file}${errors.length ? ' ('+errors.length+' err)' : ''}`);
  if (errors.length) errors.forEach(e => console.log(`     ${e}`));
  results.push({ name: p.file, errors: errors.length });
  await page.close();
}

// tests.html assertions
console.log('\n=== tests.html ===');
let tp = await browser.newPage();
let te = [];
tp.on('pageerror', e => te.push(e.message));
await tp.goto('file:///' + join(BASE, '斯诺德跑团', 'tests.html').replace(/\\/g, '/'), { waitUntil: 'networkidle', timeout: 12000 });
await tp.waitForSelector('.summary', { timeout: 10000 }).catch(() => {});
await tp.waitForTimeout(500);
let sum = await tp.textContent('.summary').catch(() => 'NO SUMMARY');
console.log(sum.trim());
let pass = await tp.evaluate(() => document.querySelectorAll('.pass').length).catch(() => 0);
let fail = await tp.evaluate(() => document.querySelectorAll('.fail').length).catch(() => 0);
console.log(`Pass: ${pass}, Fail: ${fail}`);
if (te.length) { console.log('Console errors:'); te.forEach(e => console.log('  '+e)); }
await tp.close();
await browser.close();

// 数据一致性校验（职业页 JSON vs SKILL_DATA vs skill_effects）
console.log('\n=== 数据一致性 ===');
let dataCheck = spawnSync('python', [join(BASE, 'scripts', 'verify_panel_data_sync.py')], { encoding: 'utf-8' });
if (dataCheck.stdout) console.log(dataCheck.stdout.trim());
if (dataCheck.stderr) console.error(dataCheck.stderr.trim());
let dataOK = dataCheck.status === 0;
console.log(dataOK ? '✅ 三数据源一致' : '❌ 数据一致性校验失败');
totalErrors += dataOK ? 0 : 1;

let clean = results.filter(r => r.errors === 0).length;
console.log('\n========================');
console.log(`Clean: ${clean}/${pages.length}  |  Errors: ${totalErrors}  |  Tests: ${pass}P ${fail}F`);
console.log(clean === pages.length && fail === 0 && dataOK ? '✅ ALL CLEAN' : '❌ ISSUES');
process.exit(clean === pages.length && fail === 0 && dataOK ? 0 : 1);

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

// 视觉层检查（截图 → 视觉模型，免费优先降级百炼；VERIFY_VISUAL=0 可跳过）
console.log('\n=== 视觉检查（免费模型优先 → 百炼降级） ===');
let visOK = true;
if (process.env.VERIFY_VISUAL === '0') {
  console.log('✅ 视觉检查跳过（VERIFY_VISUAL=0）');
} else {
  let visOut = null;
  try {
    visOut = spawnSync('node', [join(BASE, 'verify_visual.mjs')], { encoding: 'utf-8', timeout: 600000, maxBuffer: 32 * 1024 * 1024 });
  } catch (e) {
    visOK = false;
    console.log('❌ 视觉检查执行失败: ' + e.message.split('\n')[0]);
  }
  if (visOut) {
    if (visOut.stdout) console.log(visOut.stdout.trim().slice(0, 3000));
    if (visOut.status !== 0) visOK = false;
  }
  console.log(visOK ? '✅ 视觉检查通过' : '❌ 视觉检查发现问题（见上方报告）');
  totalErrors += visOK ? 0 : 1;
}

// 同名技能冲突校验（同名不同效果应人工核对；同职业重名报警）
console.log('\n=== 同名技能校验 ===');
let dupeOK = true;
try {
  let dupeOut = spawnSync('node', [join(BASE, 'scripts', 'verify_skill_dupes.mjs')], { encoding: 'utf-8', timeout: 60000 });
  if (dupeOut.stdout) console.log(dupeOut.stdout.trim().slice(0, 2500));
  if (dupeOut.status !== 0) dupeOK = false;
} catch (e) {
  dupeOK = false;
  console.log('❌ 同名技能校验执行失败: ' + e.message.split('\n')[0]);
}
console.log(dupeOK ? '✅ 同名技能校验通过' : '❌ 同名技能校验发现问题');
totalErrors += dupeOK ? 0 : 1;

let clean = results.filter(r => r.errors === 0).length;
console.log('\n========================');
console.log(`Clean: ${clean}/${pages.length}  |  Errors: ${totalErrors}  |  Tests: ${pass}P ${fail}F`);
console.log(clean === pages.length && fail === 0 && dataOK && visOK ? '✅ ALL CLEAN' : '❌ ISSUES');
process.exit(clean === pages.length && fail === 0 && dataOK && visOK ? 0 : 1);

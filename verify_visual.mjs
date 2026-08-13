// 视觉层发版检查：截图角色面板关键视图 → 视觉模型分析（免费优先，失败降级百炼）
// 高严重度布局问题 → exit 1（阻断发版）；工具不可用 → 警告不阻断
// 用法: node verify_visual.mjs [--shots N] [--skip]   （verify_all.mjs 自动调用）
import { chromium } from 'playwright';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const BASE = 'D:\\Download\\scholar-agent-main';
const PANEL = 'file:///' + path.join(BASE, '斯诺德跑团', '角色面板.html').replace(/\\/g, '/');
const SHOT_DIR = path.join(BASE, 'screenshots');
const DESCRIBE = path.join(BASE, 'describe_screenshot.mjs');

const args = process.argv.slice(2);
if (args.includes('--skip')) { console.log('✅ 视觉检查跳过（--skip）'); process.exit(0); }
const maxShots = (() => {
  const i = args.indexOf('--shots');
  return i >= 0 ? parseInt(args[i + 1], 10) || 3 : 3;
})();

fs.mkdirSync(SHOT_DIR, { recursive: true });
const ts = new Date().toISOString().replace(/[:.]/g, '-');

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
const errs = [];
page.on('pageerror', e => errs.push(e.message));
await page.goto(PANEL, { waitUntil: 'domcontentloaded', timeout: 15000 });
await page.waitForTimeout(800);

// 强制显示滚动条（无头浏览器默认隐藏，会导致视觉模型误报）
await page.evaluate(() => {
  const st = document.createElement('style');
  st.textContent = '*::-webkit-scrollbar{width:12px!important;height:12px!important;display:block!important;background:#ddd!important}*::-webkit-scrollbar-thumb{background:#999!important;border-radius:6px!important}*{scrollbar-width:auto!important;scrollbar-color:#999 #ddd!important}';
  document.head.appendChild(st);
});
const shots = [];
// 1) 商店弹层顶部（物品卡/分组布局）
await page.evaluate(() => { try { window.openStore(); } catch (e) {} });
await page.waitForTimeout(400);
const s1 = path.join(SHOT_DIR, 'visual-store-top-' + ts + '.png');
await page.screenshot({ path: s1 });
shots.push({ name: '商店弹层（顶部）', path: s1 });

// 2) 商店列表滚动中部（滚动/内容完整性）
if (shots.length < maxShots) {
  await page.evaluate(() => { const l = document.getElementById('storeList'); if (l) l.scrollTop = 600; });
  await page.waitForTimeout(300);
  const s2 = path.join(SHOT_DIR, 'visual-store-mid-' + ts + '.png');
  await page.screenshot({ path: s2 });
  shots.push({ name: '商店列表（滚动中部）', path: s2 });
}

// 3) 商店武器分类（分类切换）
if (shots.length < maxShots) {
  await page.evaluate(() => { try { STORE_CAT = '武器'; renderStore(); } catch (e) {} });
  await page.waitForTimeout(300);
  const s3 = path.join(SHOT_DIR, 'visual-store-weapon-' + ts + '.png');
  await page.screenshot({ path: s3 });
  shots.push({ name: '商店（武器分类）', path: s3 });
}

// 4) 装备栏（初始布局）
if (shots.length < maxShots) {
  await page.evaluate(() => { try { closeOverlay('storeOverlay'); } catch (e) {} });
  await page.waitForTimeout(200);
  const s4 = path.join(SHOT_DIR, 'visual-equip-' + ts + '.png');
  await page.screenshot({ path: s4 });
  shots.push({ name: '装备栏（初始）', path: s4 });
}

await browser.close();

console.log('截图 ' + shots.length + ' 张，开始视觉分析（免费模型优先，失败自动降级百炼）...');
let highTotal = 0;
let toolFailures = 0;

for (const shot of shots) {
  console.log('\n--- ' + shot.name + ' ---');
  const r = spawnSync('node', [DESCRIBE, shot.path, '--backend', 'auto'], {
    encoding: 'utf8', timeout: 300000, maxBuffer: 16 * 1024 * 1024
  });
  const out = String(r.stdout || '') + String(r.stderr || '');
  if (r.status !== 0) {
    toolFailures++;
    console.log('⚠️ 视觉工具失败: ' + out.split('\n').slice(-3).join('\n'));
    continue;
  }
  const report = out.replace(/^[\s\S]*?===== 视觉检查报告[^:]*:/m, '').trim();
  console.log(report.slice(0, 1200));
  const highs = (report.match(/\[严重度:\s*高\]/g) || []).length;
  highTotal += highs;
}

console.log('\n========================');
console.log('视觉检查: 高严重度问题 ' + highTotal + ' 个' + (toolFailures ? '，工具失败 ' + toolFailures + ' 次（不阻断）' : ''));
console.log('截图目录: ' + SHOT_DIR);
if (highTotal > 0) {
  console.log('❌ 发现高严重度视觉问题，请修复后重新检查');
  process.exit(1);
}
console.log('✅ 视觉检查通过');
process.exit(0);

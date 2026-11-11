/**
 * 手机系统返回键 = 回上一级（__guiBack）验收
 * 用法：node verify_back_key_e2e.mjs
 */
import { chromium } from 'playwright';
const ROOT = process.cwd().replace(/\\/g, '/');
const URL = (p) => 'file:///' + ROOT + '/' + encodeURI(p);
let pass = 0, fail = 0;
const ok = (n, c, extra) => { if (c) { pass++; console.log('  ✓ ' + n); } else { fail++; console.log('  ✗ ' + n + (extra ? ' → ' + extra : '')); } };
const b = await chromium.launch({ headless: true });
const cases = [
  ['职业页/法师.html', '职业页/首页.html', '职业页 → 职业页首页'],
  ['职业页/法师·进阶.html', '职业页/法师.html', '进阶页 → 所属职业页'],
  ['职业页/首页.html', '../斯诺德跑团/启动台.html', '职业页首页 → 启动台'],
  ['斯诺德跑团/资料库.html', '启动台.html', '资料库 → 启动台'],
  ['斯诺德跑团/角色创建页.html', '主页.html', '创建页 → 主页'],
];
for (const [page, expect, label] of cases) {
  const p = await b.newPage({ viewport: { width: 390, height: 844 } });
  await p.goto(URL(page), { waitUntil: 'load' });
  await p.waitForTimeout(1500);
  const r = await p.evaluate(() => {
    if (typeof window.__guiBack !== 'function') return { missing: true };
    const before = location.href;
    const handled = window.__guiBack();       // 会触发跳转
    return { handled: handled, before: before };
  });
  ok(label + '：__guiBack 返回 true 并跳转', r.handled === true, JSON.stringify(r));
  await p.waitForTimeout(1600);
  const after = decodeURI(p.url());
  ok(label + '：落到 ' + expect, after.endsWith(expect) || after.includes(expect.replace('../', '')), after.split('/').slice(-2).join('/'));
  await p.close();
}
/* 无父级页面：返回 false（交给系统退出） */
for (const page of ['斯诺德跑团/启动台.html']) {
  const p = await b.newPage({ viewport: { width: 390, height: 844 } });
  await p.addInitScript(() => localStorage.setItem('_snowd_changelog_seen', '9.9.9'));
  await p.goto(URL(page), { waitUntil: 'load' });
  await p.waitForTimeout(1500);
  const handled = await p.evaluate(() => (typeof window.__guiBack === 'function' ? window.__guiBack() : 'missing'));
  ok(page.split('/').pop() + ' 无父级 → __guiBack false（不劫持返回键）', handled === false, String(handled));
  await p.close();
}
/* 设置页：父级为启动台（可回上一级） */
{
  const p = await b.newPage({ viewport: { width: 390, height: 844 } });
  await p.goto(URL('斯诺德跑团/设置.html'), { waitUntil: 'load' });
  await p.waitForTimeout(1500);
  const handled = await p.evaluate(() => window.__guiBack());
  await p.waitForTimeout(1500);
  ok('设置页 → 启动台', handled === true && decodeURI(p.url()).includes('启动台.html'), decodeURI(p.url()).split('/').slice(-1)[0]);
  await p.close();
}

await b.close();
console.log('\n' + '─'.repeat(50));
console.log((fail === 0 ? '✅ 返回键「回上一级」验收通过' : '❌ 有失败项') + '  ' + pass + 'P / ' + fail + 'F');
process.exit(fail === 0 ? 0 : 1);

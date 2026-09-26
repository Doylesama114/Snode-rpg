/** 页面加载性能基线：node verify_perf.mjs [--save]
 * 本地 HTTP + Chromium（禁用缓存）：测 DCL / load / 资源体积 / 资源数 / 二次加载
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';
const ROOT = process.cwd();
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8', '.css': 'text/css; charset=utf-8', '.png': 'image/png' };
const server = http.createServer((req, res) => {
  const p = decodeURIComponent(req.url.split('?')[0]);
  const f = path.join(ROOT, p);
  if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end('nf'); return; }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const PORT = server.address().port;
const PAGES = [
  ['启动台', '斯诺德跑团/启动台.html'],
  ['角色面板', '斯诺德跑团/角色面板.html'],
  ['角色创建页', '斯诺德跑团/角色创建页.html'],
  ['职业页首页', '职业页/首页.html'],
  ['法师职业页', '职业页/法师.html'],
  ['规则手册', '斯诺德跑团/help.html'],
];
const b = await chromium.launch({ headless: true });
const rows = [];
for (const [label, rel] of PAGES) {
  const ctx = await b.newContext();
  const p = await ctx.newPage();
  const t0 = Date.now();
  await p.goto('http://127.0.0.1:' + PORT + '/' + encodeURI(rel), { waitUntil: 'load', timeout: 60000 }).catch(() => {});
  const wall = Date.now() - t0;
  const m = await p.evaluate(() => {
    const nav = performance.getEntriesByType('navigation')[0] || {};
    const res = performance.getEntriesByType('resource') || [];
    const bytes = res.reduce((a, r) => a + (r.transferSize || r.decodedBodySize || 0), 0);
    const js = res.filter(r => /\.js(\?|$)/.test(r.name));
    return {
      dcl: Math.round(nav.domContentLoadedEventEnd || 0),
      load: Math.round(nav.loadEventEnd || 0),
      resCount: res.length,
      kb: Math.round(bytes / 1024),
      jsKb: Math.round(js.reduce((a, r) => a + (r.transferSize || r.decodedBodySize || 0), 0) / 1024),
      jsCount: js.length,
      domNodes: document.getElementsByTagName('*').length,
    };
  });
  rows.push({ label, wall, ...m });
  console.log('── ' + label.padEnd(12) + ' 挂载 ' + String(m.dcl).padStart(5) + 'ms | load ' + String(m.load).padStart(5) + 'ms | 墙钟 ' + String(wall).padStart(5) + 'ms | 资源 ' + String(m.resCount).padStart(3) + ' 个 ' + String(m.kb).padStart(5) + 'KB（JS ' + m.jsCount + ' 个 ' + m.jsKb + 'KB）| DOM ' + m.domNodes);
  await ctx.close();
}
await b.close();
server.close();
const dir = '_scratch/perf';
fs.mkdirSync(dir, { recursive: true });
const name = process.argv.includes('--save') ? 'baseline.json' : 'latest.json';
fs.writeFileSync(dir + '/' + name, JSON.stringify(rows, null, 2), 'utf8');
if (!process.argv.includes('--save') && fs.existsSync(dir + '/baseline.json')) {
  const base = JSON.parse(fs.readFileSync(dir + '/baseline.json', 'utf8'));
  console.log('\n=== 对比基线 ===');
  for (const r of rows) {
    const o = base.find(x => x.label === r.label);
    if (!o) continue;
    console.log('  ' + r.label.padEnd(12) + ' DCL ' + o.dcl + '→' + r.dcl + 'ms | 体积 ' + o.kb + '→' + r.kb + 'KB | 资源 ' + o.resCount + '→' + r.resCount);
  }
}
console.log('\n（已保存 ' + dir + '/' + name + '）');

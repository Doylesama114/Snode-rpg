#!/usr/bin/env node
/** PWA 静态检查（2026-11-19）：清单、图标、SW、安装页、meta。 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const SITE = path.join(ROOT, '斯诺德跑团');
const fails = [];
const ok = (name, cond, detail) => { if (!cond) fails.push(name + (detail ? ' (' + detail + ')' : '')); };

const manifestPath = path.join(SITE, 'manifest.webmanifest');
ok('manifest 存在', fs.existsSync(manifestPath));
let manifest = null;
try { manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8')); } catch (e) { fails.push('manifest 不是合法 JSON'); }
if (manifest) {
  ok('name', !!manifest.name);
  ok('short_name', !!manifest.short_name);
  ok('start_url', !!manifest.start_url);
  ok('display=standalone', manifest.display === 'standalone');
  ok('theme_color', !!manifest.theme_color);
  ok('icons 数量 >= 2', Array.isArray(manifest.icons) && manifest.icons.length >= 2);
  for (const icon of (manifest.icons || [])) {
    ok('图标存在: ' + icon.src, fs.existsSync(path.join(SITE, icon.src)), icon.src);
  }
}

const swPath = path.join(SITE, 'sw.js');
ok('sw.js 存在', fs.existsSync(swPath));
const sw = fs.existsSync(swPath) ? fs.readFileSync(swPath, 'utf8') : '';
ok('sw 含 install/fetch 监听', /addEventListener\('install'/.test(sw) && /addEventListener\('fetch'/.test(sw));
ok('sw 版本常量', /VERSION\s*=/.test(sw));

ok('pwa.js 存在', fs.existsSync(path.join(SITE, 'pwa.js')));
ok('安装引导页存在', fs.existsSync(path.join(SITE, '安装到主屏幕.html')));

for (const page of ['启动台.html', '主页.html']) {
  const p = path.join(SITE, page);
  const html = fs.readFileSync(p, 'utf8');
  ok(page + ' 引用 manifest', /rel="manifest"/.test(html));
  ok(page + ' 有 apple-touch-icon', /apple-touch-icon/.test(html));
  ok(page + ' 有 pwa.js', /pwa\.js/.test(html));
  ok(page + ' viewport-fit=cover', /viewport-fit=cover/.test(html));
}

if (fails.length) {
  console.log('PWA 检查失败（' + fails.length + ' 项）：');
  fails.forEach((f) => console.log('  - ' + f));
  process.exit(1);
}
console.log('PWA 检查通过：manifest / 图标 / SW / 引导页 / meta');

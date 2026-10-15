// 布局健康检查（视觉回归的几何代理）：检测 flex 压缩/重叠/高度异常/截断/溢出
// 用法: node verify_layout.mjs [url...]   （缺省检查角色面板）
import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const ROOT_DIR = 'D:\\Download\\scholar-agent-main';
const PORT = 8125;
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.png': 'image/png' };
const server = http.createServer((req, res) => {
  try {
    const p = decodeURIComponent(req.url.split('?')[0]);
    const fp = path.join(ROOT_DIR, p === '/' ? '/index.html' : p);
    if (!fp.startsWith(ROOT_DIR)) { res.writeHead(403); res.end(); return; }
    const data = fs.readFileSync(fp);
    res.writeHead(200, { 'Content-Type': MIME[path.extname(fp)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    res.end(data);
  } catch { res.writeHead(404); res.end(); }
});
await new Promise(r => server.listen(PORT, '127.0.0.1', r));

const pages = process.argv.slice(2).length
  ? process.argv.slice(2)
  : ['/%E6%96%AF%E8%AF%BA%E5%BE%B7%E8%B7%91%E5%9B%A2/%E8%A7%92%E8%89%B2%E9%9D%A2%E6%9D%BF.html'];

const browser = await chromium.launch({ headless: true });
let totalIssues = 0;

for (const p of pages) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const errs = [];
  page.on('pageerror', e => errs.push(e.message));
  await page.goto('http://127.0.0.1:' + PORT + p, { waitUntil: 'domcontentloaded', timeout: 15000 });
  await page.waitForTimeout(700);
  // 打开商店弹层以便检查商店布局
  await page.evaluate(() => { try { window.openStore(); } catch (e) {} }).catch(() => {});
  await page.waitForTimeout(300);

  const issues = await page.evaluate(() => {
    const out = [];
    const vw = window.innerWidth, vh = window.innerHeight;
    const isVisible = el => {
      const r = el.getBoundingClientRect();
      const st = getComputedStyle(el);
      return st.display !== 'none' && st.visibility !== 'hidden' && r.width > 0 && r.height > 0;
    };
    const desc = el => {
      let s = el.tagName.toLowerCase();
      if (el.id) s += '#' + el.id;
      if (el.className && typeof el.className === 'string') s += '.' + el.className.split(' ').slice(0, 2).join('.');
      return s;
    };
    const all = Array.from(document.querySelectorAll('body *')).filter(isVisible);

    // 1) flex 压缩检测：flex 容器内，子项总内容高 >> 容器可视高，且容器 scrollHeight ≈ clientHeight（无法滚动 = 被压）
    for (const el of all) {
      const st = getComputedStyle(el);
      if (st.display !== 'flex' && st.display !== 'inline-flex') continue;
      // 只检测纵向 flex（横向 flex 子项并排，高度相加无意义）
      if (st.flexDirection !== 'column' && st.flexDirection !== 'column-reverse') continue;
      const r = el.getBoundingClientRect();
      if (r.height < 30) continue;
      const children = Array.from(el.children).filter(isVisible);
      if (!children.length) continue;
      // 子项内容真实高度用 scrollHeight（rect 高度会被 flex 压缩缩小，测不到）
      const contentH = children.reduce((s, c) => s + c.scrollHeight, 0);
      const scrollable = el.scrollHeight > el.clientHeight + 4;
      if (contentH > r.height * 1.8 && !scrollable) {
        out.push('[flex压缩] ' + desc(el) + ' 子内容真实高 ' + Math.round(contentH) + ' vs 可视高 ' + Math.round(r.height) + ' 且不可滚动');
      }
    }

    // 2) 高度异常：可见元素被压扁到 <6px（非 hr/分隔线）
    for (const el of all) {
      const r = el.getBoundingClientRect();
      if (r.height > 0 && r.height < 6 && el.tagName !== 'HR') {
        out.push('[高度异常] ' + desc(el) + ' 高度 ' + r.height.toFixed(1) + 'px（疑似被压缩）');
      }
    }

    // 3) 文本横向截断：overflow hidden 且内容超宽
    for (const el of all) {
      const st = getComputedStyle(el);
      if ((st.overflowX === 'hidden' || st.overflowX === 'clip') && el.scrollWidth > el.clientWidth + 6) {
        out.push('[横向截断] ' + desc(el) + ' 内容宽 ' + el.scrollWidth + ' vs 可视 ' + el.clientWidth);
      }
    }

    // 4) 兄弟元素重叠（同父、均可见、非嵌套、相交面积 > 40% 较小者）
    const seen = new Set();
    for (const el of all) {
      const parent = el.parentElement;
      if (!parent) continue;
      const sibs = Array.from(parent.children).filter(isVisible);
      for (const sib of sibs) {
        if (sib === el) continue;
        // SVG 图形元素（进度环/图标路径/文字）天然层叠，跳过
        if (el.ownerSVGElement || sib.ownerSVGElement || /^(svg|circle|path|text|line|rect|polygon|g)$/i.test(el.tagName) || /^(svg|circle|path|text|line|rect|polygon|g)$/i.test(sib.tagName)) continue;
        // 任一悬浮/绝对/弹层元素（浮动按钮、overlay）视为设计，跳过
        const ep = getComputedStyle(el), sp2 = getComputedStyle(sib);
        if (ep.position === 'fixed' || ep.position === 'absolute' || ep.position === 'sticky') continue;
        if (sp2.position === 'fixed' || sp2.position === 'absolute' || sp2.position === 'sticky') continue;
        if (el.classList.contains('overlay') || sib.classList.contains('overlay')) continue;
        const key = el === sib ? '' : (desc(el) + '|' + desc(sib));
        if (seen.has(key)) continue;
        seen.add(key);
        const a = el.getBoundingClientRect(), b = sib.getBoundingClientRect();
        const ix = Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left));
        const iy = Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
        const inter = ix * iy;
        const minArea = Math.min(a.width * a.height, b.width * b.height);
        if (inter > 0 && minArea > 0 && inter > minArea * 0.4 && a.width > 20 && b.width > 20) {
          out.push('[重叠] ' + desc(el) + ' 与 ' + desc(sib) + ' 相交 ' + Math.round(inter) + 'px²');
        }
      }
    }

    // 5) 视口溢出：fixed 元素超出视口（排除 transform 滑出式隐藏的抽屉/通知）
    for (const el of all) {
      const st5 = getComputedStyle(el);
      if (st5.position !== 'fixed') continue;
      const r = el.getBoundingClientRect();
      // 完全在视口外 = 滑出式隐藏（抽屉/通知），跳过
      const fullyOff = r.right < 0 || r.bottom < 0 || r.left > vw || r.top > vh;
      if (fullyOff) continue;
      if (r.left < -5 || r.top < -5 || r.right > vw + 5 || r.bottom > vh + 5) {
        out.push('[溢出视口] ' + desc(el) + ' (' + Math.round(r.left) + ',' + Math.round(r.top) + ' ' + Math.round(r.width) + 'x' + Math.round(r.height) + ')');
      }
    }
    return out;
  });

  const jserr = errs.length ? ' JS错误: ' + errs.slice(0, 3).join(' | ') : '';
  console.log((issues.length ? '❌' : '✅') + ' ' + p + (issues.length ? ' — ' + issues.length + ' 个布局问题' : '') + jserr);
  for (const it of issues.slice(0, 15)) console.log('   ' + it);
  totalIssues += issues.length + errs.length;
  await page.close();
}

await browser.close();
await new Promise(r => server.close(r));
console.log('\n布局问题总数: ' + totalIssues);
process.exit(totalIssues ? 1 : 0);

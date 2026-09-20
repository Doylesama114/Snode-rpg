// 职业页技能卡懒渲染改造（P0-1）
//
// 把每张技能卡里最重的 div.detail 移入 <template class="skill-body">：
//   · 解析阶段仍然在文件里（不影响任何静态分析/门禁），但不进入渲染树、不参与布局
//   · 运行时由 common.js 在卡片接近视口时实例化（hydration）
//   · article 上的 data-search / data-tags / data-marks 保留，搜索与筛选无需实例化即可命中
//
// 幂等：已含 <template class="skill-body"> 的卡片直接跳过。
// 用法：node scripts/apply_lazy_skill_cards.mjs [--check]

import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..');
const DIR = path.join(ROOT, '职业页');
const CHECK = process.argv.includes('--check');
const SKIP = new Set(['_monk_test_top.html']);
const KEEP = new Set(['H4']);   // 顶层保留的标签

/** 把一张卡片的内容拆成「保留段」与「搬进 template 的段」 */
function splitCard(inner) {
  const segs = [];
  let i = 0, depth = 0, segStart = 0, rootTag = null, rootCls = '';
  const VOID = new Set(['BR', 'HR', 'IMG', 'INPUT', 'META', 'LINK', 'SOURCE']);
  const re = /<(\/?)([a-zA-Z][\w-]*)((?:[^>"']|"[^"]*"|'[^']*')*?)(\/?)>/g;
  let m;
  while ((m = re.exec(inner))) {
    const closing = m[1] === '/';
    const tag = m[2].toUpperCase();
    const attrs = m[3] || '';
    const selfClose = m[4] === '/';
    if (!closing) {
      if (depth === 0) {
        segStart = m.index;
        rootTag = tag;
        rootCls = ((attrs.match(/class="([^"]*)"/) || [])[1] || '');
      }
      if (!VOID.has(tag) && !selfClose) depth++;
      if (depth === 0) { segs.push({ tag: rootTag, cls: rootCls, text: inner.slice(segStart, re.lastIndex) }); rootTag = null; }
    } else {
      depth--;
      if (depth === 0 && rootTag) { segs.push({ tag: rootTag, cls: rootCls, text: inner.slice(segStart, re.lastIndex) }); rootTag = null; }
    }
  }
  if (rootTag) segs.push({ tag: rootTag, cls: rootCls, text: inner.slice(segStart) });   // 未闭合兜底
  const kept = [], moved = [];
  for (const s of segs) {
    const isChips = s.tag === 'DIV' && /(^|\s)chips(\s|$)/.test(s.cls);
    if (KEEP.has(s.tag) || isChips) kept.push(s.text); else moved.push(s.text);
  }
  return { kept, moved, count: segs.length };
}

let changed = 0, cards = 0, totalMoved = 0;
for (const file of fs.readdirSync(DIR)) {
  if (!file.endsWith('.html') || SKIP.has(file)) continue;
  const full = path.join(DIR, file);
  const html = fs.readFileSync(full, 'utf8');
  if (!html.includes('<article class="skill"')) continue;
  const cardRe = /(<article class="skill"[^>]*>)([\s\S]*?)(<\/article>)/g;
  let out = '', last = 0, m, n = 0, movedHere = 0;
  while ((m = cardRe.exec(html))) {
    const [whole, open, inner, close] = m;
    if (inner.includes('<template class="skill-body">')) { continue; }   // 已改造
    const { kept, moved } = splitCard(inner);
    if (!moved.length) continue;
    const replaced = open + kept.join('') + '<template class="skill-body">' + moved.join('') + '</template>' + close;
    out += html.slice(last, m.index) + replaced;
    last = m.index + whole.length;
    n++; movedHere += moved.length;
  }
  if (!n) continue;
  out += html.slice(last);
  cards += n; totalMoved += movedHere;
  if (CHECK) { console.log('[check] ' + file + ' 需改造 ' + n + ' 张卡'); continue; }
  fs.writeFileSync(full, out, 'utf8');
  changed++;
  console.log('改造 ' + file + '：' + n + ' 张卡，搬入 detail 段 ' + movedHere + ' 个（' + (html.length / 1024 | 0) + ' KB → ' + (out.length / 1024 | 0) + ' KB）');
}
console.log((CHECK ? '[check] 待改造文件 ' : '已改造文件 ') + (CHECK ? 0 : changed) + ' 个，卡片 ' + cards + '，段 ' + totalMoved);

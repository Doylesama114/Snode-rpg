#!/usr/bin/env node
/**
 * Verify nav skill-link href targets match article.skill id + h4 name.
 * Soft-ok: nav text "名 · 学派" when article h4 is "名" (战士/法师起始技能).
 *
 * Usage: node scripts/verify_class_nav_links.mjs
 * Exit 1 if any hard mismatch.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const CLASS_DIR = path.join(ROOT, '职业页');

const PAGES = [
  '战士', '圣骑士', '猎人', '游荡者', '武僧', '法师', '术士', '牧师',
  '德鲁伊', '吟游诗人', '萨满祭司', '蛮斗士', '奇械师', '魔契师', '守望者',
  '通用天赋树', '特殊专长'
];

function stripTags(html) {
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

function h4NameFromChunk(chunk) {
  const m = chunk.match(/<h4[^>]*>([\s\S]*?)<\/h4>/i);
  if (!m) return '';
  const inner = m[1].replace(/<span[\s\S]*?<\/span>/gi, '');
  return stripTags(inner);
}

function isSkillArticle(attrs) {
  return /\bclass\s*=\s*["'][^"']*\bskill\b/.test(attrs);
}

/** Map article id -> h4 name (robust to one missing </article>). */
function collectArticles(html) {
  const articles = new Map();
  const openRe = /<article\b([^>]*)>/gi;
  const opens = [];
  let m;
  while ((m = openRe.exec(html))) {
    opens.push({ index: m.index, end: m.index + m[0].length, attrs: m[1] });
  }
  for (let i = 0; i < opens.length; i++) {
    const { attrs, end } = opens[i];
    if (!isSkillArticle(attrs)) continue;
    const idM = attrs.match(/\bid\s*=\s*["']([^"']+)["']/i);
    if (!idM) continue;
    const nextStart = i + 1 < opens.length ? opens[i + 1].index : html.length;
    const closeAt = html.indexOf('</article>', end);
    const chunkEnd =
      closeAt >= 0 && closeAt < nextStart ? closeAt : nextStart;
    const name = h4NameFromChunk(html.slice(end, chunkEnd));
    articles.set(idM[1], name);
  }
  return articles;
}

function namesMatch(linkText, articleName) {
  if (!articleName) return false;
  if (linkText === articleName) return true;
  if (linkText.startsWith(articleName + ' ·') || linkText.startsWith(articleName + '·')) {
    return 'soft';
  }
  return false;
}

function verifyPage(fileName) {
  const filePath = path.join(CLASS_DIR, fileName + '.html');
  const html = fs.readFileSync(filePath, 'utf8');
  const articles = collectArticles(html);

  const hard = [];
  const soft = [];
  const seenHref = new Map();
  const linkRe = /<a\s+class="skill-link"\s+href="#([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
  let lm;
  while ((lm = linkRe.exec(html))) {
    const id = lm[1];
    const text = stripTags(lm[2]);

    if (seenHref.has(id) && seenHref.get(id) !== text) {
      hard.push({ type: 'dup-href', id, text, other: seenHref.get(id) });
    } else if (!seenHref.has(id)) {
      seenHref.set(id, text);
    }

    if (!articles.has(id)) {
      hard.push({ type: 'missing', id, text });
      continue;
    }
    const artName = articles.get(id);
    const match = namesMatch(text, artName);
    if (match === true) continue;
    if (match === 'soft') {
      soft.push({ id, text, artName });
      continue;
    }
    hard.push({ type: 'name-mismatch', id, text, artName });
  }

  return { fileName, hard, soft, linkCount: seenHref.size, articleCount: articles.size };
}

let exitCode = 0;
let totalHard = 0;
for (const name of PAGES) {
  const r = verifyPage(name);
  if (r.hard.length) {
    exitCode = 1;
    totalHard += r.hard.length;
    console.log(`FAIL ${r.fileName}.html (${r.hard.length} hard)`);
    for (const h of r.hard) {
      if (h.type === 'missing') {
        console.log(`  missing #${h.id} ← "${h.text}"`);
      } else if (h.type === 'dup-href') {
        console.log(`  dup href #${h.id}: "${h.other}" vs "${h.text}"`);
      } else {
        console.log(`  #${h.id}: nav "${h.text}" ≠ article "${h.artName}"`);
      }
    }
  } else {
    const softNote = r.soft.length ? ` (soft ${r.soft.length})` : '';
    console.log(`OK   ${r.fileName}.html links=${r.linkCount} articles=${r.articleCount}${softNote}`);
  }
}

if (exitCode) {
  console.log(`\nHard mismatches: ${totalHard}`);
} else {
  console.log('\nALL CLEAN');
}
process.exit(exitCode);

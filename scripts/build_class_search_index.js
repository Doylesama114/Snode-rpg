#!/usr/bin/env node
/**
 * Build 职业页/search-index.json from class HTML pages (article.skill).
 * Usage: node scripts/build_class_search_index.mjs
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const CLASS_DIR = path.join(ROOT, '职业页');
const OUT = path.join(CLASS_DIR, 'search-index.json');

const PAGES = [
  '战士', '圣骑士', '猎人', '游荡者', '武僧', '法师', '术士', '牧师',
  '德鲁伊', '吟游诗人', '萨满祭司', '蛮斗士', '奇械师', '魔契师',
  '通用天赋树', '特殊专长'
];

function normHex(h) {
  if (!h) return '';
  h = String(h).trim().toUpperCase();
  if (!h.startsWith('#')) h = '#' + h;
  return h;
}

const MARK_HEX_ALIASES = {
  '#808080': '#595959', // 黑
  '#F79646': '#EE822F', // 橙
  '#FF66CC': '#FFB7E3', // 粉
  '#851321': '#843F0B', // 棕（docx 暗红）
};

function canonicalizeMarkHex(h) {
  h = normHex(h);
  return MARK_HEX_ALIASES[h] || h;
}

function stripTags(html) {
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

function extractArticles(html, classname, page) {
  const items = [];
  const re = /<article\b([^>]*)>([\s\S]*?)<\/article>/gi;
  let m;
  while ((m = re.exec(html))) {
    const attrs = m[1];
    const body = m[2];
    if (!/\bclass\s*=\s*"[^"]*\bskill\b/.test(attrs) && !/\bclass\s*=\s*'[^']*\bskill\b/.test(attrs)) {
      continue;
    }
    const idMatch = attrs.match(/\bid\s*=\s*"([^"]+)"/) || attrs.match(/\bid\s*=\s*'([^']+)'/);
    const searchMatch = attrs.match(/\bdata-search\s*=\s*"([^"]*)"/) || attrs.match(/\bdata-search\s*=\s*'([^']*)'/);
    const marksMatch = attrs.match(/\bdata-marks\s*=\s*"([^"]*)"/) || attrs.match(/\bdata-marks\s*=\s*'([^']*)'/);
    const styleMatch = attrs.match(/\bdata-style\s*=\s*"([^"]*)"/) || attrs.match(/\bdata-style\s*=\s*'([^']*)'/);
    const tierMatch = attrs.match(/\bdata-tier\s*=\s*"([^"]*)"/) || attrs.match(/\bdata-tier\s*=\s*'([^']*)'/);

    const skillId = idMatch ? idMatch[1] : '';
    if (!skillId) continue;

    const h4 = body.match(/<h4[^>]*>([\s\S]*?)<\/h4>/i);
    let skillName = '';
    if (h4) {
      skillName = stripTags(h4[1].replace(/<span[\s\S]*?<\/span>/gi, '')).trim();
    }
    if (!skillName) skillName = skillId;

    const searchText = (searchMatch ? searchMatch[1] : '').replace(/\s+/g, ' ').trim();
    const marks = marksMatch
      ? marksMatch[1].split(',').map(canonicalizeMarkHex).filter(Boolean)
      : [];

    let style = styleMatch ? styleMatch[1] : '';
    let tier = tierMatch ? tierMatch[1] : '';
    if (tier === '0') tier = '起始';

    // Prefer chip text for style/tier when available
    const chip = body.match(/<span\s+class="chip"[^>]*>([\s\S]*?)<\/span>/i);
    if (chip) {
      const chipText = stripTags(chip[1]);
      const parts = chipText.split(/[·•]/).map((s) => s.trim()).filter(Boolean);
      if (parts.length >= 2) {
        if (!style) style = parts[0].replace(/风格$/, '');
        if (!tier || tier === '起始') {
          const t = parts[1];
          if (t.indexOf('起始') >= 0) tier = '起始';
          else tier = t;
        }
      } else if (chipText.indexOf('起始') >= 0) {
        tier = '起始';
      }
    }

    const snippetSrc = searchText || skillName;
    const snippet = snippetSrc.length > 120 ? snippetSrc.slice(0, 120) + '…' : snippetSrc;

    items.push({
      classname,
      page,
      skillId,
      skillName,
      style,
      tier,
      marks,
      searchText: (classname + ' ' + skillName + ' ' + searchText).toLowerCase(),
      snippet
    });
  }
  return items;
}

function main() {
  const all = [];
  const meta = { generatedAt: new Date().toISOString(), pages: [], total: 0 };

  for (const name of PAGES) {
    const file = name + '.html';
    const full = path.join(CLASS_DIR, file);
    if (!fs.existsSync(full)) {
      console.warn('SKIP missing:', file);
      continue;
    }
    const html = fs.readFileSync(full, 'utf8');
    const items = extractArticles(html, name, file);
    meta.pages.push({ name, file, count: items.length });
    all.push(...items);
    console.log(name + ':', items.length);
  }

  meta.total = all.length;
  const out = { meta, skills: all };
  const jsonText = JSON.stringify(out, null, 0);
  fs.writeFileSync(OUT, jsonText, 'utf8');
  // file:// 兼容副本：window.__SEARCH_INDEX_DATA（转义 </script>）
  const jsText = 'window.__SEARCH_INDEX_DATA = ' + jsonText.split('</').join('<\\/') + ';';
  const JS_OUT = path.join(CLASS_DIR, 'search-index.js');
  fs.writeFileSync(JS_OUT, jsText, 'utf8');
  // 同步 electron-app
  const EL_OUT = path.join(ROOT, 'electron-app', '职业页', 'search-index.json');
  const EL_JS = path.join(ROOT, 'electron-app', '职业页', 'search-index.js');
  fs.copyFileSync(OUT, EL_OUT);
  fs.copyFileSync(JS_OUT, EL_JS);
  console.log('\nWrote', path.relative(ROOT, OUT), 'skills:', all.length);
}

main();

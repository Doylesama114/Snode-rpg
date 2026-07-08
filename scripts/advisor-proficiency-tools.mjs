/**
 * Advisor 5.0 batch9 (7073) — proficiency reverse lookup tools.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ADVISOR = path.join(__dirname, '..', 'advisor');

/** @type {object|null} */
let _profCache = null;
/** @type {object|null} */
let _bgCache = null;
/** @type {string[]|null} */
let _allProfNames = null;

function loadJson(rel) {
  return JSON.parse(fs.readFileSync(path.join(ADVISOR, rel), 'utf8'));
}

function loadProficiencies() {
  if (!_profCache) _profCache = loadJson('chargen/proficiencies.json');
  return _profCache;
}

function loadBackgroundIndex() {
  if (!_bgCache) _bgCache = loadJson('chargen/bg_personality_index.json');
  return _bgCache;
}

function buildAllProfNames() {
  if (_allProfNames) return _allProfNames;
  const doc = loadProficiencies();
  const names = new Set();
  for (const list of Object.values(doc.byAttribute || {})) {
    for (const n of list) names.add(n);
  }
  for (const list of Object.values(doc.parentCategories || {})) {
    for (const n of list) names.add(n);
  }
  names.add('宗教');
  names.add('历史');
  names.add('工程学');
  names.add('医药');
  names.add('神秘学');
  return (_allProfNames = [...names].sort((a, b) => b.length - a.length));
}

export function resetProficiencyToolsCache() {
  _profCache = null;
  _bgCache = null;
  _allProfNames = null;
}

/**
 * @param {string} query
 */
export function resolveProficiencyNameFromQuery(query) {
  const q = String(query || '');
  const names = buildAllProfNames();
  for (const name of names) {
    if (q.includes(name)) return name;
  }
  if (/知识/.test(q) && !/知识-/.test(q)) return '知识';
  if (/奥秘/.test(q) && !/奥秘-/.test(q)) return '奥秘';
  return null;
}

/**
 * @param {string} profName
 */
export function listClassesByProficiency(profName) {
  const name = String(profName || '').trim();
  const doc = loadProficiencies();
  const classes = [];

  for (const [className, pickText] of Object.entries(doc.classSkillPick || {})) {
    if (pickText.includes(name)) {
      classes.push({ className, pickText });
    }
  }

  const parentHits = [];
  for (const [parent, subs] of Object.entries(doc.parentCategories || {})) {
    if (parent === name || subs.includes(name)) {
      parentHits.push(parent);
    }
  }

  const backgrounds = [];
  for (const bg of loadBackgroundIndex().backgrounds || []) {
    const base = bg.baseProfs || '';
    const special = bg.specialProfs || '';
    if (base.includes(name) || special.includes(name)) {
      backgrounds.push({
        name: bg.name,
        baseProfs: base,
        specialProfs: special,
      });
    }
  }

  return {
    proficiency: name,
    classes: classes.sort((a, b) => a.className.localeCompare(b.className, 'zh')),
    backgrounds,
    parentCategories: parentHits,
    source: 'advisor/chargen/proficiencies.json',
  };
}

const PROF_LOOKUP_RE = /哪些|什么|哪几个|哪一些|可以选|有哪些/;
const PROF_SUBJECT_RE = /职业|初始|创建|车卡|主职|基础职业/;

/**
 * @param {string} query
 */
export function detectProficiencyLookupQuestion(query) {
  const q = String(query || '');
  if (!PROF_LOOKUP_RE.test(q) || !/熟练/.test(q)) return null;
  if (/武器熟练|武器类别|锤子|剑类|弓|斧|锤类|长柄|火器|法器|简易/.test(q)) return null;

  const prof = resolveProficiencyNameFromQuery(q);
  if (!prof) return null;
  if (!PROF_SUBJECT_RE.test(q) && !/背景/.test(q)) return null;

  const scope = /背景/.test(q) ? 'background' : 'class';
  return { intent: 'proficiency_lookup', proficiency: prof, scope, query: q };
}

/**
 * @param {{ intent: string, proficiency: string, scope?: string, query?: string }} detected
 */
export function buildProficiencyToolContext(detected) {
  if (!detected?.proficiency) return null;
  const data = listClassesByProficiency(detected.proficiency);
  const scope = detected.scope || 'class';

  const lines = [
    '### Tools 层 · 熟练项职业对照（proficiencies.json · 事实）',
    `- 目标熟练：${data.proficiency}`,
    `- 语料：${data.source}`,
  ];

  if (scope !== 'background') {
    lines.push(`- **L1 创建时可选取该熟练的职业（共 ${data.classes.length} · 须完整列出）**：`);
    for (const c of data.classes) {
      lines.push(`  · **${c.className}**：${c.pickText}`);
    }
    if (!data.classes.length) lines.push('  · （语料 classSkillPick 无匹配）');
  }

  if (data.parentCategories.length) {
    lines.push(`- 所属父类别：${data.parentCategories.join('、')}（问「${data.proficiency}」时包含子项熟练）`);
  }

  if (scope !== 'class' || /背景/.test(detected.query || '')) {
    lines.push(`- **背景授予该熟练（共 ${data.backgrounds.length} · 须完整列出）**：`);
    for (const b of data.backgrounds) {
      lines.push(`  · **${b.name}**：基础 ${b.baseProfs || '—'}${b.specialProfs && b.specialProfs !== '无' ? `；特殊 ${b.specialProfs}` : ''}`);
    }
    if (!data.backgrounds.length) lines.push('  · （语料 bg_personality_index 无直接授予）');
  }

  lines.push('- LLM 须完整枚举上述职业/背景；创建页四项熟练为「可选池」非自动获得。');

  return {
    intent: 'proficiency_lookup',
    promptProfile: 'proficiency_lookup',
    text: lines.join('\n'),
    meta: {
      proficiency: data.proficiency,
      classCount: data.classes.length,
      backgroundCount: data.backgrounds.length,
    },
  };
}

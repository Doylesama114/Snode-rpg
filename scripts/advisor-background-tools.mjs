/**
 * Advisor 5.0 batch8 (7072) — background personality lookup tools.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ADVISOR = path.join(__dirname, '..', 'advisor');

/** @type {object|null} */
let _indexCache = null;
/** @type {Map<string, object>|null} */
let _byNameCache = null;

const BG_DETAIL_RE = /背景|性格|特点|理想|牵绊|缺点|神祇|特性|装备|熟练|侍僧|骗子|学者|特质|bonds|ideals/;
const BG_LIST_RE = /哪些|可以选|有哪些|什么|列表/;

function loadIndex() {
  if (!_indexCache) {
    _indexCache = JSON.parse(fs.readFileSync(path.join(ADVISOR, 'chargen', 'bg_personality_index.json'), 'utf8'));
  }
  return _indexCache;
}

function buildByName() {
  if (_byNameCache) return _byNameCache;
  const map = new Map();
  for (const bg of loadIndex().backgrounds || []) {
    map.set(bg.name, bg);
    if (bg.id && bg.id !== bg.name) map.set(bg.id, bg);
  }
  return (_byNameCache = map);
}

export function resetBackgroundToolsCache() {
  _indexCache = null;
  _byNameCache = null;
}

/**
 * @param {string} name
 */
export function lookupBackground(name) {
  const n = String(name || '').trim();
  if (!n) return null;
  const map = buildByName();
  if (map.has(n)) return { ...map.get(n), found: true };
  for (const [key, bg] of map.entries()) {
    if (n.includes(key) || key.includes(n)) return { ...bg, found: true, matchedVia: 'partial' };
  }
  return null;
}

/**
 * @param {string} query
 */
export function resolveBackgroundNameFromQuery(query) {
  const q = String(query || '');
  const names = [...buildByName().keys()].sort((a, b) => b.length - a.length);
  for (const name of names) {
    if (q.includes(name)) return name;
  }
  return null;
}

/**
 * @param {string} query
 */
export function detectBackgroundQuestion(query) {
  const q = String(query || '');
  if (/创建角色|起始装备|种族特性|什么特性/.test(q) && !/背景.*神/.test(q)) return null;

  const bgName = resolveBackgroundNameFromQuery(q);
  if (!bgName) return null;

  const asksDeities = /神祇|神系|侍奉|信仰.*哪些|哪些神/.test(q);
  const asksPersonality = /性格|特点|理想|牵绊|缺点|traits|ideals|bonds|flaws/.test(q);
  const asksDetail = BG_DETAIL_RE.test(q) && /是什么|有什么|怎样|如何|介绍|描述/.test(q);

  if (asksDeities || (BG_LIST_RE.test(q) && /神/.test(q))) {
    return { intent: 'background_detail', backgroundName: bgName, section: 'deities', query: q };
  }
  if (asksPersonality) {
    let section = 'overview';
    if (/理想/.test(q)) section = 'ideals';
    else if (/牵绊|羁绊/.test(q)) section = 'bonds';
    else if (/缺点|缺陷/.test(q)) section = 'flaws';
    else if (/特点|性格|特质/.test(q)) section = 'traits';
    return { intent: 'background_detail', backgroundName: bgName, section, query: q };
  }
  if (asksDetail || q.trim() === bgName || q.includes(`${bgName}背景`)) {
    return { intent: 'background_detail', backgroundName: bgName, section: 'overview', query: q };
  }

  return null;
}

/**
 * @param {{ intent: string, backgroundName: string, section?: string, query?: string }} detected
 */
export function buildBackgroundToolContext(detected) {
  if (!detected?.backgroundName) return null;
  const bg = lookupBackground(detected.backgroundName);
  if (!bg) {
    return {
      intent: 'background_detail',
      promptProfile: 'background_detail',
      text: [
        '### Tools 层 · 背景详情（bg_personality_index · 事实）',
        `- 未找到背景「${detected.backgroundName}」`,
      ].join('\n'),
      meta: { backgroundName: detected.backgroundName, found: false },
    };
  }

  const section = detected.section || 'overview';
  const lines = [
    '### Tools 层 · 背景详情（bg_personality_index.json · 事实 · 勿改条目）',
    `- 背景：${bg.name}`,
    `- 语料：${bg.source || 'advisor/chargen/bg_personality_index.json'}`,
  ];

  if (section === 'deities' || (section === 'overview' && detected.query?.includes('神'))) {
    lines.push(`- **可侍奉神祇（共 ${bg.deities.length} 项 · 须完整列出）**：`);
    for (const d of bg.deities || []) lines.push(`  · ${d}`);
    if (!bg.deities?.length) lines.push('  · （语料无 deities 字段）');
  }

  if (section === 'traits' || section === 'overview') {
    lines.push(`- **性格特点（共 ${bg.traits.length} 项）**：`);
    for (const t of bg.traits || []) lines.push(`  · ${t}`);
  }
  if (section === 'ideals' || section === 'overview') {
    lines.push(`- **理想（共 ${bg.ideals.length} 项）**：`);
    for (const t of bg.ideals || []) lines.push(`  · ${t}`);
  }
  if (section === 'bonds' || section === 'overview') {
    lines.push(`- **牵绊（共 ${bg.bonds.length} 项）**：`);
    for (const t of bg.bonds || []) lines.push(`  · ${t}`);
  }
  if (section === 'flaws' || section === 'overview') {
    lines.push(`- **缺点（共 ${bg.flaws.length} 项）**：`);
    for (const t of bg.flaws || []) lines.push(`  · ${t}`);
  }

  if (bg.desc) lines.push(`- 描述：${bg.desc.slice(0, 400)}`);
  if (bg.baseProfs) lines.push(`- 基础熟练：${bg.baseProfs}`);
  if (bg.specialProfs) lines.push(`- 特殊熟练：${bg.specialProfs}`);
  if (bg.other) lines.push(`- 其他：${bg.other}`);
  if (bg.traitDesc) lines.push(`- 背景特性：${String(bg.traitDesc).replace(/\n/g, '；').slice(0, 500)}`);

  lines.push('- LLM 须完整枚举上述列表；数字/条目以 Tools 层为准。');

  return {
    intent: 'background_detail',
    promptProfile: 'background_detail',
    text: lines.join('\n'),
    meta: { backgroundName: bg.name, section, deityCount: bg.deities?.length || 0 },
  };
}

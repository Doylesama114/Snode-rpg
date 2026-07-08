/**
 * Advisor 5.0 batch10 (7074) — chargen entity bundle tools (starting gear, race, background).
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { matchClassNameFromQuery, getL2EntryByClassName } from './advisor-class-l2.mjs';
import { resolveBackgroundNameFromQuery, lookupBackground } from './advisor-background-tools.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ADVISOR = path.join(__dirname, '..', 'advisor');

/** @type {object|null} */
let _racesCache = null;

const RACE_ALIASES = {
  吸血鬼: '血族',
  血族: '血族',
};

function loadJson(rel) {
  return JSON.parse(fs.readFileSync(path.join(ADVISOR, rel), 'utf8'));
}

function loadRaces() {
  if (!_racesCache) _racesCache = loadJson('chargen/races.json');
  return _racesCache;
}

export function resetChargenEntityToolsCache() {
  _racesCache = null;
}

/**
 * @param {string} query
 */
export function resolveRaceNameFromQuery(query) {
  const q = String(query || '');
  for (const [alias, canonical] of Object.entries(RACE_ALIASES)) {
    if (q.includes(alias)) return canonical;
  }
  for (const race of loadRaces().races || []) {
    if (q.includes(race.name)) return race.name;
  }
  return null;
}

/**
 * @param {string} name
 */
export function lookupRace(name) {
  const n = RACE_ALIASES[name] || String(name || '').trim();
  if (!n) return null;
  const race = (loadRaces().races || []).find((r) => r.name === n);
  return race ? { ...race, found: true } : null;
}

/**
 * @param {string} className
 */
export function lookupStartingGear(className) {
  const cn = String(className || '').trim();
  if (!cn) return null;
  const entry = getL2EntryByClassName(cn);
  const slug = entry?.l2Slug || (cn === '法师' ? 'mage' : null);
  if (!slug) return null;
  const rel = `chargen/${slug}_starting_gear.json`;
  const fp = path.join(ADVISOR, rel);
  if (!fs.existsSync(fp)) return null;
  const doc = loadJson(rel);
  const kits = Object.values(doc.kits || {}).sort((a, b) => String(a.letter).localeCompare(String(b.letter)));
  return {
    className: cn,
    slug,
    kits,
    itemRules: doc.itemRules || {},
    kitAdvisorNotes: doc.kitAdvisorNotes || [],
    source: rel,
  };
}

const STARTING_GEAR_RE = /起始装备|起手套装|起始套装|起手装备|创建.*装备|开局装备/;
const RACE_DETAIL_RE = /种族.*特性|什么特性|属性加成|种族特性|hpBonus|生命加成/;
const BG_CHARGEN_RE = /背景.*(装备|金币|资金|熟练|起始)|起始.*背景/;

/**
 * @param {string} query
 */
export function detectChargenEntityQuestion(query) {
  const q = String(query || '');

  if (STARTING_GEAR_RE.test(q) && !/净化|活力药水|魔法武器哪些/.test(q)) {
    const className = matchClassNameFromQuery(q);
    if (className) {
      return { intent: 'starting_gear_lookup', className, query: q };
    }
  }

  if (RACE_DETAIL_RE.test(q) && !/职业|技能|背景|创建角色时/.test(q)) {
    const raceName = resolveRaceNameFromQuery(q);
    if (raceName) {
      return { intent: 'race_detail', raceName, query: q };
    }
  }

  if (BG_CHARGEN_RE.test(q) && !/神祇|侍奉/.test(q)) {
    const bgName = resolveBackgroundNameFromQuery(q);
    if (bgName) {
      return { intent: 'background_chargen', backgroundName: bgName, query: q };
    }
  }

  if (/背景/.test(q) && /起始装备|装备|金币|资金/.test(q) && !/神/.test(q)) {
    const bgName = resolveBackgroundNameFromQuery(q);
    if (bgName) return { intent: 'background_chargen', backgroundName: bgName, query: q };
  }

  return null;
}

/**
 * @param {{ intent: string, className?: string, raceName?: string, backgroundName?: string, query?: string }} detected
 */
export function buildChargenEntityToolContext(detected) {
  if (!detected) return null;

  if (detected.intent === 'starting_gear_lookup') {
    const gear = lookupStartingGear(detected.className);
    if (!gear) return null;
    const lines = [
      '### Tools 层 · 职业起始装备（starting_gear.json · 事实 · 勿改条目）',
      `- 职业：${gear.className}`,
      `- 语料：advisor/${gear.source}`,
      `- **起始套装共 ${gear.kits.length} 套（A–D · 须完整列出）**：`,
    ];
    for (const kit of gear.kits) {
      lines.push(`  · **套装 ${kit.letter}**：${kit.summary}`);
    }
    if (gear.kitAdvisorNotes?.length) {
      lines.push('- 顾问备注（取向参考，非硬性规则）：');
      for (const n of gear.kitAdvisorNotes) {
        lines.push(`  · 套装 ${n.kit}：${n.note}`);
      }
    }
    lines.push('- LLM 须完整枚举四套 summary；可比较护甲/武器/金币差异，勿编造未收录物品。');
    return {
      intent: 'starting_gear_lookup',
      promptProfile: 'starting_gear_lookup',
      text: lines.join('\n'),
      meta: { className: gear.className, kitCount: gear.kits.length },
    };
  }

  if (detected.intent === 'race_detail') {
    const race = lookupRace(detected.raceName);
    if (!race) return null;
    const lines = [
      '### Tools 层 · 种族详情（races.json · 事实）',
      `- 种族：${race.name}`,
      `- 语料：advisor/chargen/races.json`,
      `- 描述：${race.description || '—'}`,
      `- **属性加值**：${Object.entries(race.attrBonus || {}).filter(([, v]) => v).map(([k, v]) => `${k}+${v}`).join('、') || '—'}`,
      `- hpBonus：+${race.hpBonus ?? 0}；移速：${race.moveSpeed || '—'}；体型：${race.size || '—'}`,
      `- **种族特性（共 ${(race.traits || []).length} 项 · 须完整列出）**：`,
    ];
    for (const t of race.traits || []) {
      lines.push(`  · **${t.name}**：${t.desc}`);
    }
    lines.push('- LLM 须完整枚举特性；数字以 Tools 层为准。');
    return {
      intent: 'race_detail',
      promptProfile: 'race_detail',
      text: lines.join('\n'),
      meta: { raceName: race.name, traitCount: race.traits?.length || 0 },
    };
  }

  if (detected.intent === 'background_chargen') {
    const bg = lookupBackground(detected.backgroundName);
    if (!bg) return null;
    const lines = [
      '### Tools 层 · 背景车卡 bundle（bg_personality_index · 事实）',
      `- 背景：${bg.name}`,
      `- 起始金币：${bg.gold ?? '—'}`,
      `- 基础熟练：${bg.baseProfs || '—'}`,
      `- 特殊熟练：${bg.specialProfs || '—'}`,
      `- 其他：${bg.other || '—'}`,
      `- **背景装备（共 ${(bg.equipment || []).length} 项 · 须完整列出）**：`,
    ];
    for (const e of bg.equipment || []) lines.push(`  · ${e}`);
    if (bg.traitDesc) lines.push(`- 背景特性：${String(bg.traitDesc).replace(/\n/g, '；').slice(0, 500)}`);
    lines.push('- LLM 须汇总装备/熟练/金币；勿与职业起始套装混淆。');
    return {
      intent: 'background_chargen',
      promptProfile: 'background_chargen',
      text: lines.join('\n'),
      meta: { backgroundName: bg.name, equipmentCount: bg.equipment?.length || 0 },
    };
  }

  return null;
}

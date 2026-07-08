/**
 * Advisor 4.0 — unified advancement name resolution (single source of truth).
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { matchAllClassesFromQuery } from './advisor-class-l2.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ADVISOR = path.join(__dirname, '..', 'advisor');

let _advListCache = null;
let _advSkillsCache = null;

export function loadAdvancementsList() {
  if (!_advListCache) {
    const raw = JSON.parse(fs.readFileSync(path.join(ADVISOR, 'advancements.json'), 'utf8'));
    _advListCache = raw.advancements || [];
  }
  return _advListCache;
}

export function loadAdvancementSkillsByName() {
  if (!_advSkillsCache) {
    const p = path.join(ADVISOR, 'advancement_skills.json');
    if (!fs.existsSync(p)) {
      _advSkillsCache = {};
      return _advSkillsCache;
    }
    const raw = JSON.parse(fs.readFileSync(p, 'utf8'));
    _advSkillsCache = raw.byName || {};
  }
  return _advSkillsCache;
}

export function resetAdvancementResolveCache() {
  _advListCache = null;
  _advSkillsCache = null;
}

/**
 * @param {string} query
 * @returns {string|null}
 */
export function resolveAdvancementName(query) {
  const q = String(query || '');
  const skillNames = Object.keys(loadAdvancementSkillsByName());
  const advNames = loadAdvancementsList().map((a) => a.name);
  const candidates = [...new Set([...skillNames, ...advNames])].sort((a, b) => b.length - a.length);
  for (const name of candidates) {
    if (q.includes(name)) return name;
  }
  if (/冰霜/.test(q) && !q.includes('冰霜护盾')) return '冰霜法师';
  return null;
}

/** @deprecated use resolveAdvancementName */
export function pickAdvancementName(query) {
  return resolveAdvancementName(query);
}

/**
 * @param {string} name
 * @returns {object|null}
 */
export function getAdvancementMeta(name) {
  if (!name) return null;
  return loadAdvancementsList().find((a) => a.name === name) || null;
}

/**
 * @param {string} advancementName
 * @returns {string|null}
 */
export function inferSourceClassForAdvancement(advancementName) {
  const meta = getAdvancementMeta(advancementName);
  const src = meta?.sourceClasses?.[0];
  return src ? String(src) : null;
}

/**
 * Brief talent summary for roadmap context (no full ability text).
 * @param {string} advancementName
 */
export function briefAdvancementTalents(advancementName) {
  const doc = loadAdvancementSkillsByName()[advancementName];
  if (!doc) return null;

  const talents = doc.talents || [];
  const abilityNames = talents
    .filter((t) => t.kind === 'ability' || (!t.kind && !/心得/.test(t.name || '')))
    .map((t) => t.name)
    .filter(Boolean);

  const insightTalents = talents.filter(
    (t) => t.kind === 'insight' || /心得/.test(t.name || ''),
  );

  return {
    name: advancementName,
    confidence: doc.confidence || 'documented',
    abilityNames,
    insightMilestones: insightTalents.map((t) => ({
      name: t.name,
      summary: (t.summary || '').slice(0, 200),
    })),
  };
}

const ADVANCEMENT_PLANNING_RE = /怎么|如何|规划|路线|安排|成长|想玩|想进阶|成为|进阶|build/i;

/**
 * Detect advancement-like name in query that is not in corpus.
 * @param {string} query
 * @returns {{ name: string, inCorpus: false }|null}
 */
export function detectUnknownAdvancementQuery(query) {
  const q = String(query || '');
  if (!ADVANCEMENT_PLANNING_RE.test(q)) return null;
  if (resolveAdvancementName(q)) return null;
  if (matchAllClassesFromQuery(q).length > 0) return null;

  const tryName = (name) => {
    const n = String(name || '').trim();
    if (!n || n.length < 2 || n.length > 12) return null;
    if (/^(我|你|他|她|什么|如何|怎么|这个|那个|一个|角色|技能|职业)$/.test(n)) return null;
    if (resolveAdvancementName(n) || getAdvancementMeta(n) || loadAdvancementSkillsByName()[n]) return null;
    return { name: n, inCorpus: false };
  };

  const suffixM = q.match(/([^\s，,、？?！!]{2,10}(?:大师|学者|贤者|先知|守卫|使者|骑士|武士|射手|剑士|术士|魔剑士|魔弹射手))/);
  if (suffixM) {
    const hit = tryName(suffixM[1]);
    if (hit) return hit;
  }

  const planM = q.match(/([^\s，,、？?]{2,10})\s*(?:怎么规划|如何规划|成长路线|怎么安排|如何安排|怎么选)/);
  if (planM) {
    const hit = tryName(planM[1]);
    if (hit) return hit;
  }

  const becomeM = q.match(/(?:想进阶|进阶|成为|想玩(?:一个|个)?)\s*([^\s，,、？?]{2,10})/);
  if (becomeM) {
    const hit = tryName(becomeM[1]);
    if (hit) return hit;
  }

  return null;
}

/**
 * @param {string} fragment
 * @param {number} [limit]
 * @returns {string[]}
 */
export function findSimilarAdvancements(fragment, limit = 4) {
  const needle = String(fragment || '').replace(/大师|学者|贤者/g, '').trim();
  if (!needle) return [];
  const scored = loadAdvancementsList().map((a) => {
    const text = `${a.name} ${a.searchText || ''} ${a.inferenceBlurb || ''}`;
    let score = 0;
    if (a.name.includes(needle) || needle.includes(a.name)) score += 3;
    if (text.includes(needle)) score += 2;
    for (const ch of needle) {
      if (text.includes(ch)) score += 0.1;
    }
    return { name: a.name, score };
  });
  return scored
    .filter((x) => x.score > 0.5)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((x) => x.name);
}

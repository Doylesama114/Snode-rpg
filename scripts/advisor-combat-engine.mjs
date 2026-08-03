/**
 * Advisor 5.0 batch4 — combat scenario resolver (7068 MVP).
 * batch8 (7072) — AC / armor value resolver.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { flattenProfs } from './advisor-snapshot.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ADVISOR = path.join(__dirname, '..', 'advisor');

/** @type {object|null} */
let _basicsCache = null;
/** @type {object|null} */
let _skillModsCache = null;

function loadJson(rel) {
  return JSON.parse(fs.readFileSync(path.join(ADVISOR, rel), 'utf8'));
}

function loadCombatBasics() {
  if (!_basicsCache) _basicsCache = loadJson('rules/combat_basics.json');
  return _basicsCache;
}

function loadCombatSkillModifiers() {
  if (!_skillModsCache) _skillModsCache = loadJson('rules/combat_skill_modifiers.json');
  return _skillModsCache;
}

export function resetCombatEngineCache() {
  _basicsCache = null;
  _skillModsCache = null;
}

/**
 * @param {number} score
 */
export function abilityModFromScore(score) {
  const n = Number(score);
  if (Number.isNaN(n)) return 0;
  return Math.floor((n - 10) / 2);
}

const WEAPON_CAT_HINTS = ['剑类', '锤类', '斧类', '长柄', '弓箭', '火器', '法器', '简易'];

function categoryBonusApplies(bonus, attackType) {
  const when = bonus?.when;
  if (!when) return true;
  if (when === 'ranged') return attackType === 'ranged';
  if (when === 'melee') return attackType !== 'ranged';
  return true;
}

/**
 * Whether a structured buff applies in the current scenario (self / target / companion / holder).
 * @param {object} sk skill modifier row
 * @param {object} p scenario params
 */
function buffAppliesInScenario(sk, p) {
  const appliesTo = sk.appliesTo || 'self';
  const q = String(p.query || '');
  if (appliesTo === 'self') return true;
  if (appliesTo === 'target') return !!p.isTarget || /目标/.test(q);
  if (appliesTo === 'companion') return /野兽伙伴|伙伴攻击|伙伴/.test(q);
  if (appliesTo === 'holder') return /持有者|矩阵|奥术矩阵/.test(q);
  return true;
}

function parseTargetDebuffsFromQuery(query) {
  const q = String(query || '');
  if (!/目标/.test(q)) return [];
  const debuffs = [];
  for (const name of Object.keys(loadCombatSkillModifiers().skills || {})) {
    const sk = loadCombatSkillModifiers().skills[name];
    if (sk?.targetAcModifier && q.includes(name)) debuffs.push(name);
  }
  return debuffs;
}

/**
 * @param {object} p scenario params
 * @param {object} skillMods
 */
function resolveTargetAcDebuffComponents(p, skillMods) {
  const components = [];
  let flat = 0;
  const debuffs = p.targetDebuffs || [];
  for (const name of debuffs) {
    const sk = skillMods.skills?.[name];
    if (!sk?.targetAcModifier) continue;
    const tac = sk.targetAcModifier;
    if (tac.requiresTargetHeavyArmor && !/重甲|板甲/.test(p.query || '')) continue;
    if (tac.requiresTargetShield && !/盾牌|持盾/.test(p.query || '')) continue;
    let val = tac.base ?? 0;
    const ms = tac.milestones || {};
    const ml = p.milestoneLevel;
    if (ml != null) {
      for (const [level, v] of Object.entries(ms)) {
        const lv = Number(String(level).replace(/^L/, ''));
        if (ml >= lv) val = Math.min(val, v);
      }
    }
    if (val !== 0) {
      components.push({
        source: name,
        type: 'target_ac_debuff',
        value: val,
        detail: sk.note || `目标防御等级${val}`,
      });
      flat += val;
    }
  }
  return { flat, components };
}

/**
 * @param {string} query
 */
function parseActiveBuffsFromQuery(query) {
  const q = String(query || '');
  const activeBuffs = [];
  for (const name of Object.keys(loadCombatSkillModifiers().skills || {})) {
    if (q.includes(name)) activeBuffs.push(name);
  }
  return activeBuffs;
}

/**
 * @param {string} query
 */
function parseMilestoneLevelFromQuery(query) {
  const m = String(query || '').match(/(?:法师|角色|战士|猎人|牧师)?(?:等级|L)\s*(\d+)/i);
  return m ? Number(m[1]) : null;
}

/**
 * @param {object} p scenario params
 * @param {object} skillMods
 */
function resolveAcBuffComponents(p, skillMods) {
  const components = [];
  let flat = 0;
  for (const buffName of p.activeBuffs || []) {
    const sk = skillMods.skills?.[buffName];
    if (!sk?.acModifier) continue;
    if (!buffAppliesInScenario(sk, p)) continue;
    if (sk.requiresHeavyArmor && p.armorKey !== 'plate_18') continue;
    if (sk.requiresReaction && !/反应动作/.test(p.query || '')) continue;
    let acFlat = sk.acModifier.base ?? 0;
    const acCond = sk.conditionalAcModifier;
    if (acCond?.queryHint && p.query?.includes(acCond.queryHint)) {
      acFlat = acCond.value ?? acFlat;
    }
    const ms = sk.acModifier.milestones || {};
    const ml = p.milestoneLevel;
    if (ml != null) {
      for (const [level, val] of Object.entries(ms)) {
        const lv = Number(String(level).replace(/^L/, ''));
        if (ml >= lv) acFlat = Math.max(acFlat, val);
      }
    }
    if (acFlat !== 0) {
      components.push({
        source: buffName,
        type: 'buff_ac',
        value: acFlat,
        detail: sk.note || `防御等级+${acFlat}`,
        appliesTo: sk.appliesTo || 'self',
      });
      flat += acFlat;
    }
  }
  return { flat, components };
}

/**
 * Merge combat-relevant snapshot skills into activeBuffs when listed in combat_skill_modifiers.
 * @param {object} merged
 * @param {object} snapshot
 */
function mergeSnapshotCombatBuffs(merged, snapshot) {
  if (!snapshot?.skills?.length) return merged;
  const known = Object.keys(loadCombatSkillModifiers().skills || {});
  const names = snapshot.skills
    .map((s) => (typeof s === 'string' ? s : s?.name))
    .filter(Boolean);
  merged.activeBuffs = [...(merged.activeBuffs || [])];
  for (const name of names) {
    if (known.includes(name)) {
      if (!merged.activeBuffs.includes(name)) merged.activeBuffs.push(name);
      merged._buffsFromSnapshot = true;
    }
  }
  return merged;
}

/**
 * Merge L6 snapshot attrs/profs into a parsed combat scenario when query omits explicit values.
 * @param {ReturnType<typeof parseCombatScenarioFromQuery>|object} scenario
 * @param {object|null} snapshot normalized L6 snapshot
 * @param {string} [query]
 */
export function mergeSnapshotIntoCombatScenario(scenario, snapshot, query = '') {
  const base = { ...(scenario || {}) };
  if (!snapshot?.attrs) {
    return { ...base, snapshotUsed: false };
  }

  const q = String(query || '');
  const merged = {
    ...base,
    abilityMods: { ...(base.abilityMods || {}) },
    skillProfs: { ...(base.skillProfs || {}) },
  };

  const hasExplicitStr = /力量调整值[为是]?\+?\d+/.test(q);
  const hasExplicitDex = /敏捷调整值[为是]?\+?\d+/.test(q);

  if (!hasExplicitStr && snapshot.attrs.力量 != null) {
    merged.abilityMods.力量 = abilityModFromScore(snapshot.attrs.力量);
    merged._strFromSnapshot = true;
  }
  if (!hasExplicitDex && snapshot.attrs.敏捷 != null) {
    merged.abilityMods.敏捷 = abilityModFromScore(snapshot.attrs.敏捷);
    merged._dexFromSnapshot = true;
  }

  const flatProfs = flattenProfs(snapshot.profs || {});
  for (const [profName, pts] of Object.entries(flatProfs)) {
    if (pts > 0 && merged.skillProfs[profName] == null) {
      merged.skillProfs[profName] = pts;
      merged._skillProfFromSnapshot = true;
    }
  }
  if (!merged.weaponProfPoints) {
    let cat = merged.weaponCategory;
    if (!cat) {
      for (const hint of WEAPON_CAT_HINTS) {
        if (q.includes(hint) || /剑/.test(q) && hint === '剑类') {
          cat = hint;
          break;
        }
      }
    }
    if (cat && flatProfs[cat] > 0) {
      merged.weaponCategory = cat;
      merged.weaponProfPoints = flatProfs[cat];
      merged._profFromSnapshot = true;
    }
  }

  if (merged.milestoneLevel == null) {
    const mainLevel = snapshot.classes?.[0]?.level;
    if (mainLevel) merged.milestoneLevel = mainLevel;
  }

  mergeSnapshotCombatBuffs(merged, snapshot);

  merged.snapshotUsed = true;
  merged.snapshotName = snapshot.name || '';
  merged.snapshotMainClass = snapshot.classes?.[0]?.name || null;
  return merged;
}

/**
 * @param {string} query
 */
export function parseAcScenarioFromQuery(query) {
  const q = String(query || '');
  const dexM = q.match(/敏捷调整值[为是]?\+(\d+)/);
  const dexMod = dexM ? Number(dexM[1]) : null;

  const rules = loadCombatBasics().acRules || {};
  let armorKey = null;
  let armorLabel = null;
  for (const [key, tpl] of Object.entries(rules)) {
    if (key === 'shieldBonus' || key === 'formula' || key === 'source') continue;
    for (const alias of tpl.aliases || []) {
      if (q.includes(alias)) {
        armorKey = key;
        armorLabel = alias;
        break;
      }
    }
    if (armorKey) break;
  }
  if (!armorKey && /无护甲|不穿甲|未穿/.test(q)) {
    armorKey = 'unarmored';
    armorLabel = '无护甲';
  }

  const hasShield = /盾牌|小圆盾|吸矢盾|秘法盾|持盾/.test(q);
  const isTarget = /目标/.test(q);

  return {
    dexMod,
    armorKey,
    armorLabel,
    hasShield,
    isTarget,
    targetDebuffs: parseTargetDebuffsFromQuery(q),
    activeBuffs: parseActiveBuffsFromQuery(q),
    milestoneLevel: parseMilestoneLevelFromQuery(q),
    query: q,
  };
}

/**
 * @param {ReturnType<typeof parseAcScenarioFromQuery>|object} params
 */
export function resolveAcScenario(params) {
  const basics = loadCombatBasics();
  const skillMods = loadCombatSkillModifiers();
  const rules = basics.acRules || {};
  const p = params || {};
  const tpl = rules[p.armorKey] || rules.unarmored;
  const dexMod = Number(p.dexMod ?? 0);
  const dexCap = tpl.dexCap;
  const dexApplied = dexCap == null ? dexMod : Math.min(dexMod, dexCap);
  const shieldBonus = p.hasShield ? (rules.shieldBonus ?? 2) : 0;
  const acBuff = resolveAcBuffComponents(p, skillMods);
  const targetDebuff = resolveTargetAcDebuffComponents(p, skillMods);
  const totalAc = (tpl.base ?? 10) + dexApplied + shieldBonus + acBuff.flat + targetDebuff.flat;

  const components = [
    {
      source: tpl.label || p.armorLabel || '护甲基础',
      type: 'base',
      value: tpl.base ?? 10,
      detail: p.armorLabel || tpl.label,
    },
  ];
  if (dexCap == null) {
    components.push({
      source: '敏捷调整值',
      type: 'dex',
      value: dexApplied,
      detail: `+${dexMod}`,
    });
  } else if (dexCap > 0) {
    components.push({
      source: '敏捷调整值（ capped ）',
      type: 'dex',
      value: dexApplied,
      detail: `+${dexMod} → 计入 +${dexApplied}（至多 +${dexCap}）`,
    });
  } else {
    components.push({
      source: '敏捷调整值',
      type: 'dex',
      value: 0,
      detail: '重甲不计敏捷加值',
    });
  }
  if (shieldBonus) {
    components.push({
      source: '盾牌',
      type: 'shield',
      value: shieldBonus,
      detail: `+${shieldBonus} AC`,
    });
  }
  for (const c of acBuff.components) {
    components.push(c);
  }
  for (const c of targetDebuff.components) {
    components.push(c);
  }

  return {
    params: p,
    formula: rules.formula || '护甲基础 + 敏捷 + 盾牌 + Buff',
    components,
    totalAc,
    targetDebuffFlat: targetDebuff.flat,
    armorLabel: tpl.label || p.armorLabel,
    sources: [
      'advisor/rules/combat_basics.json',
      'advisor/rules/combat_skill_modifiers.json',
    ],
  };
}

/**
 * Merge L6 snapshot attrs/equipment into AC scenario when query omits explicit values.
 * @param {ReturnType<typeof parseAcScenarioFromQuery>|object} scenario
 * @param {object|null} snapshot
 * @param {string} [query]
 */
export function mergeSnapshotIntoAcScenario(scenario, snapshot, query = '') {
  const base = { ...(scenario || {}) };
  if (!snapshot) return { ...base, snapshotUsed: false };

  const q = String(query || '');
  const merged = { ...base };

  const hasExplicitDex = /敏捷调整值[为是]?\+?\d+/.test(q);
  if (!hasExplicitDex && merged.dexMod == null && snapshot.attrs?.敏捷 != null) {
    merged.dexMod = abilityModFromScore(snapshot.attrs.敏捷);
    merged._dexFromSnapshot = true;
  }

  if (!merged.armorKey) {
    const armorName = snapshot.equipment?.armor || snapshot.armor || null;
    if (armorName) {
      const fromEquip = parseAcScenarioFromQuery(`穿着${armorName}`);
      if (fromEquip.armorKey) {
        merged.armorKey = fromEquip.armorKey;
        merged.armorLabel = armorName;
        merged._armorFromSnapshot = true;
      }
    }
  }

  if (!merged.hasShield && (snapshot.equipment?.shield || snapshot.shield)) {
    merged.hasShield = true;
    merged._shieldFromSnapshot = true;
  }

  if (merged.milestoneLevel == null) {
    const mainLevel = snapshot.classes?.[0]?.level;
    if (mainLevel) merged.milestoneLevel = mainLevel;
  }

  mergeSnapshotCombatBuffs(merged, snapshot);

  merged.snapshotUsed = true;
  merged.snapshotName = snapshot.name || '';
  return merged;
}

/**
 * @param {ReturnType<typeof resolveAcScenario>} result
 */
export function formatAcScenarioText(result) {
  if (!result) return '';
  const lines = [
    '### Tools 层 · 护甲值演算（combat_basics.json · acRules · 分解式）',
    `- 公式：${result.formula}`,
    `- **防御等级（AC）合计：${result.totalAc}**`,
    `- 护甲：${result.armorLabel || result.params?.armorLabel || '—'}`,
    '- 分解（须逐项转述）：',
  ];
  for (const c of result.components || []) {
    if (c.type === 'dex' && c.value === 0) {
      lines.push(`  · ${c.source}：+0（${c.detail}）`);
    } else {
      lines.push(`  · ${c.source}：+${c.value}${c.detail ? `（${c.detail}）` : ''}`);
    }
  }
  if (result.params?.snapshotUsed) {
    lines.push(`- L6 快照联动：${result.params.snapshotName || '角色'}${result.params._armorFromSnapshot ? ' · 护甲自快照' : ''}${result.params._dexFromSnapshot ? ' · 敏捷自快照' : ''}${result.params._shieldFromSnapshot ? ' · 盾牌自快照' : ''}${result.params._buffsFromSnapshot ? ' · AC/战斗 Buff 自快照技能' : ''}`);
  }
  if (result.params?.isTarget && result.targetDebuffFlat) {
    lines.push(`- 目标 AC debuff 合计：${result.targetDebuffFlat}（腐蚀术等；作用于目标防御等级）`);
  }
  const targetBuffs = (result.components || []).filter((c) => c.type === 'buff_ac' && c.appliesTo && c.appliesTo !== 'self');
  if (targetBuffs.length) {
    lines.push(`- **appliesTo 联动**：${targetBuffs.map((c) => `${c.source}→${c.appliesTo}`).join('、')}`);
  }
  if (/持有者|奥术矩阵/.test(result.params?.query || '')) {
    lines.push('- 作用于持有者（矩阵屏障等正面施法 AC buff）');
  }
  lines.push(`- 语料：${result.sources.join('、')}`);
  lines.push('- LLM 须给出分解列表与 AC 合计；注明轻甲敏捷上限与盾牌加值。');
  return lines.join('\n');
}

export function parseCombatScenarioFromQuery(query) {
  const q = String(query || '');
  const strM = q.match(/力量调整值[为是]?\+(\d+)/);
  const dexM = q.match(/敏捷调整值[为是]?\+(\d+)/);
  // 原始属性值（如「力量18」）按 abilityModifier.formula = floor((属性值-10)/2) 换算
  const rawStrM = !strM && q.match(/力量(?:属性值)?[为是]?\s*(\d{1,2})(?!调)/);
  const rawDexM = !dexM && q.match(/敏捷(?:属性值)?[为是]?\s*(\d{1,2})(?!调)/);
  const toMod = (v) => Math.floor((Number(v) - 10) / 2);
  const weaponProfM = q.match(/(?:有)?(?:一点|1点|(\d+)点)(剑类|锤类|斧类|长柄|弓箭|火器|法器|简易)熟练度?/);
  const weaponM = q.match(/拿着一把(?:伤害为[^，,]+的)?([^，,]+剑)/)
    || q.match(/拿着(?:一把)?([^，,\s]{2,10}(?:剑|斧|锤|弓|弩))/);
  const damageM = q.match(/伤害为([^，,]+)/);

  let weaponCategory = weaponProfM?.[2] || null;
  if (!weaponCategory) {
    if (/剑类|双手剑|长剑|短剑/.test(q)) weaponCategory = '剑类';
    else if (/弓箭|长弓|短弓|手弩|弩/.test(q)) weaponCategory = '弓箭';
    else if (/锤类|锤子/.test(q)) weaponCategory = '锤类';
    else if (/斧类|斧头|双手斧|战斧/.test(q)) weaponCategory = '斧类';
  }

  const activeBuffs = parseActiveBuffsFromQuery(q);
  const milestoneLevel = parseMilestoneLevelFromQuery(q);

  const skillProfs = {};
  const skillProfRe = /([\u4e00-\u9fa5]{2,6})熟练(?:度)?(\d+)点/g;
  let spm;
  while ((spm = skillProfRe.exec(q)) !== null) {
    const name = spm[1];
    const pts = Number(spm[2]);
    if (name && pts > 0 && !WEAPON_CAT_HINTS.includes(name)) {
      skillProfs[name] = pts;
    }
  }

  const attackType = /近战/.test(q)
    ? 'melee'
    : (/远程|弓箭|长弓|短弓|手弩|弩/.test(q) ? 'ranged' : 'melee');

  return {
    attackType,
    abilityMods: {
      力量: strM ? Number(strM[1]) : (rawStrM ? toMod(rawStrM[1]) : 0),
      敏捷: dexM ? Number(dexM[1]) : (rawDexM ? toMod(rawDexM[1]) : 0),
    },
    weaponCategory,
    weaponProfPoints: weaponProfM ? (Number(weaponProfM[1]) || 1) : (weaponCategory && /熟练/.test(q) ? 1 : 0),
    weaponName: weaponM?.[1] || null,
    weaponDamage: damageM?.[1]?.trim() || null,
    activeBuffs,
    milestoneLevel,
    skillProfs,
    query: q,
  };
}

/**
 * @param {ReturnType<typeof parseCombatScenarioFromQuery>|object} params
 */
export function resolveCombatScenario(params) {
  const basics = loadCombatBasics();
  const skillMods = loadCombatSkillModifiers();
  const p = params || {};
  const lines = [];
  const components = [];
  const rollModifiers = [];

  const strMod = Number(p.abilityMods?.力量 ?? p.strengthMod ?? 0);
  const dexMod = Number(p.abilityMods?.敏捷 ?? p.dexterityMod ?? 0);
  let effectiveStr = strMod;
  let effectiveDex = dexMod;

  const weaponProf = Number(p.weaponProfPoints ?? 0);
  const perPoint = basics.weaponProficiency?.perPointHitBonus ?? 1;
  if (weaponProf > 0) {
    components.push({
      source: `${p.weaponCategory || '武器'}熟练`,
      type: 'hit',
      value: weaponProf * perPoint,
      detail: `${weaponProf} 点 × 每点 +${perPoint}`,
    });
  }

  const catHitBonuses = basics.weaponProficiency?.categoryHitBonuses || {};
  const cat = p.weaponCategory;
  if (cat && catHitBonuses[cat]) {
    const bonus = catHitBonuses[cat];
    if (categoryBonusApplies(bonus, p.attackType) && bonus.hit) {
      components.push({
        source: `${cat}类别增益`,
        type: 'hit',
        value: bonus.hit,
        detail: bonus.note || basics.weaponProficiency?.categoryBonuses?.[cat],
      });
    }
  }

  const categoryNotes = [];
  const critComponents = [];
  const catCritBonuses = basics.weaponProficiency?.categoryCritBonuses || {};
  if (cat && catCritBonuses[cat]) {
    const bonus = catCritBonuses[cat];
    if (categoryBonusApplies(bonus, p.attackType) && bonus.crit) {
      critComponents.push({
        source: `${cat}类别增益`,
        type: 'crit',
        value: bonus.crit,
        detail: bonus.note || basics.weaponProficiency?.categoryBonuses?.[cat],
      });
      categoryNotes.push({ category: cat, note: bonus.note || `暴击率+${bonus.crit}`, type: 'crit' });
    }
  }
  const catText = basics.weaponProficiency?.categoryBonuses?.[cat];
  if (cat && catText && !catHitBonuses[cat]?.hit && !catCritBonuses[cat]?.crit) {
    categoryNotes.push({ category: cat, note: catText });
  }
  if (cat === '剑类' && p.weaponDamage) {
    categoryNotes.push({ category: '剑类', note: '近战伤害骰=1可重掷（不计入 flat 伤害加值）' });
  }

  for (const buffName of p.activeBuffs || []) {
    const sk = skillMods.skills?.[buffName];
    if (!sk) continue;
    if (!buffAppliesInScenario(sk, p)) continue;
    if (sk.requiresRanged && p.attackType !== 'ranged') continue;
    if (sk.requiresMelee && p.attackType === 'ranged') continue;
    if (sk.requiresReaction && !/反应动作/.test(p.query || '')) continue;

    if (sk.attrModifier) {
      for (const [attr, delta] of Object.entries(sk.attrModifier)) {
        if (attr === '力量') effectiveStr += delta;
        if (attr === '敏捷') effectiveDex += delta;
        if (delta !== 0) {
          components.push({
            source: buffName,
            type: 'attr',
            attribute: attr,
            value: delta,
            detail: sk.note || `${attr}调整值 ${delta >= 0 ? '+' : ''}${delta}`,
          });
        }
      }
    }

    const hitBase = sk.hitModifier?.base ?? 0;
    let hitFlat = hitBase;
    const cond = sk.conditionalHitModifier;
    if (cond?.queryHint && p.query?.includes(cond.queryHint)) {
      hitFlat = cond.value ?? hitFlat;
    }
    const ms = sk.hitModifier?.milestones || {};
    const ml = p.milestoneLevel;
    if (ml != null && sk.hitModifier) {
      for (const [level, val] of Object.entries(ms)) {
        const lv = Number(String(level).replace(/^L/, ''));
        if (ml >= lv) hitFlat = Math.max(hitFlat, val);
      }
    }
    if (sk.hitViaProficiency) {
      const profPts = Number(p.skillProfs?.[sk.hitViaProficiency] ?? 0);
      if (profPts > 0) {
        hitFlat = profPts;
      }
    }
    if (sk.hitRollModifier === 'advantage' || sk.hitRollModifier === 'disadvantage') {
      rollModifiers.push({
        source: buffName,
        type: sk.hitRollModifier,
        detail: sk.note || `攻击命中检定具有${sk.hitRollModifier === 'advantage' ? '优势' : '劣势'}`,
      });
    }
    if (hitFlat !== 0) {
      components.push({
        source: buffName,
        type: 'hit',
        value: hitFlat,
        detail: sk.note || `攻击命中检定值+${hitFlat}`,
      });
    } else if ((sk.hitModifier && !sk.attrModifier) || sk.hitViaProficiency) {
      components.push({
        source: buffName,
        type: 'hit',
        value: 0,
        detail: `${sk.note || '基础无命中加值'}${Object.keys(ms).length ? `（${Object.keys(ms).join('/')} 里程碑另计）` : ''}`,
      });
    }
  }

  const useStr = p.attackType !== 'ranged' && (strMod > 0 || p.query?.includes('力量'));
  const attrMod = useStr ? effectiveStr : Math.max(effectiveStr, effectiveDex);
  components.unshift({
    source: useStr ? '力量调整值' : 'max(力量,敏捷)调整值',
    type: 'attr_base',
    value: attrMod,
    detail: useStr
      ? `问句指定力量 +${strMod}${effectiveStr !== strMod ? ` → 有效 +${effectiveStr}（含 Buff）` : ''}`
      : `max(+${effectiveStr}, +${effectiveDex})`,
  });

  const hitFlatSum = components
    .filter((c) => c.type === 'hit' && typeof c.value === 'number')
    .reduce((s, c) => s + c.value, 0);
  const totalHit = attrMod + hitFlatSum;

  const damageBasics = basics.damageRoll || {};
  const useStrDmg = p.attackType !== 'ranged' && (strMod > 0 || p.query?.includes('力量'));
  const dmgAbility = useStrDmg ? effectiveStr : Math.max(effectiveStr, effectiveDex);
  const damageComponents = [];
  if (p.weaponDamage) {
    damageComponents.push({
      source: '武器伤害骰',
      type: 'dice',
      value: p.weaponDamage,
      detail: 'flat 加值不含骰面',
    });
  }
  damageComponents.push({
    source: useStrDmg ? '力量调整值' : 'max(力量,敏捷)调整值',
    type: 'damage_flat',
    value: dmgAbility,
    detail: useStrDmg
      ? `有效 +${dmgAbility}${effectiveStr !== strMod ? '（含 Buff）' : ''}`
      : `max(+${effectiveStr}, +${effectiveDex})`,
  });
  const totalDamageBonus = dmgAbility;
  const totalCritBonus = critComponents.reduce((s, c) => s + (c.value || 0), 0);

  return {
    params: p,
    formula: basics.attackRoll?.formula || 'D20 + 攻击命中检定值',
    damageFormula: damageBasics.formula || '武器伤害骰 + 属性调整值',
    components,
    damageComponents,
    critComponents,
    categoryNotes,
    rollModifiers,
    totalHitBonus: totalHit,
    totalDamageBonus,
    totalCritBonus,
    assumptions: [
      p.milestoneLevel == null && (p.activeBuffs || []).includes('锐化武器')
        ? '未指定法师等级：锐化武器按基础效果计（命中 +0；L5 里程碑为 +3）'
        : null,
      p.snapshotUsed
        ? `L6 快照联动：${p.snapshotName || '角色'}${p.snapshotMainClass ? `（${p.snapshotMainClass}）` : ''}${p._strFromSnapshot ? ' · 力量自快照' : ''}${p._profFromSnapshot ? ' · 武器熟练自快照' : ''}${p._buffsFromSnapshot ? ' · 战斗 Buff 自快照技能' : ''}`
        : null,
      '武器类别特殊增益（如剑类伤害骰重掷）不计入命中加值',
    ].filter(Boolean),
    sources: [
      'advisor/rules/combat_basics.json',
      'advisor/rules/combat_skill_modifiers.json',
    ],
  };
}

/**
 * Hit + damage combined wrapper for full combat breakdown queries.
 * @param {ReturnType<typeof parseCombatScenarioFromQuery>|object} params
 */
export function resolveFullCombatScenario(params) {
  const result = resolveCombatScenario(params);
  return {
    ...result,
    mode: 'both',
    summary: {
      totalHitBonus: result.totalHitBonus,
      totalDamageBonus: result.totalDamageBonus,
      weaponDamage: result.params?.weaponDamage || null,
    },
  };
}

/**
 * @param {ReturnType<typeof resolveCombatScenario>} result
 * @param {{ mode?: 'hit'|'damage'|'both'|'ac' }} [opts]
 */
export function formatCombatScenarioText(result, opts = {}) {
  if (!result) return '';
  const mode = opts.mode || (result.totalAc != null ? 'ac' : result.params?.query?.includes('伤害加值') && !result.params?.query?.includes('命中')
    ? 'damage'
    : result.params?.query?.includes('伤害加值') && result.params?.query?.includes('命中')
      ? 'both'
      : 'hit');

  const lines = [];

  if (mode === 'ac') {
    return formatAcScenarioText(result);
  }

  if (mode === 'hit' || mode === 'both') {
    const display = result.components.filter((c) => {
      if (c.type === 'attr_base' || c.type === 'hit') return true;
      if (c.type === 'attr' && c.attribute === '力量') return true;
      return false;
    });
    lines.push(
      '### Tools 层 · 战斗命中演算（combat_basics.json · 分解式）',
      `- 公式：${result.formula}`,
      `- **攻击命中检定值合计：+${result.totalHitBonus}**（=D20 掷骰之外的加值总和）`,
      '- 分解（须逐项转述，勿合并或遗漏）：',
    );
    for (const c of display) {
      const sign = c.value >= 0 ? '+' : '';
      if (c.type === 'hit' && c.value === 0) {
        lines.push(`  · ${c.source}：+0（${c.detail}）`);
      } else {
        lines.push(`  · ${c.source}：${sign}${c.value}${c.detail ? `（${c.detail}）` : ''}`);
      }
    }
    for (const n of result.categoryNotes || []) {
      lines.push(`  · ${n.category}特殊规则（信息）：${n.note}`);
    }
    if (result.totalCritBonus > 0) {
      lines.push(`- **暴击率加值合计：+${result.totalCritBonus}**（类别规则，不计入命中 flat 加值）`);
      for (const c of result.critComponents || []) {
        lines.push(`  · ${c.source}：+${c.value}（${c.detail}）`);
      }
    }
    if (result.rollModifiers?.length) {
      lines.push('- **掷骰修正（不计入 flat 加值）**：');
      for (const r of result.rollModifiers) {
        const label = r.type === 'advantage' ? '优势' : '劣势';
        lines.push(`  · ${r.source}：攻击命中检定具有**${label}**（${r.detail}）`);
      }
    }
    const companionHits = (result.components || []).filter((c) => c.type === 'hit' && /独行伙伴|野兽伙伴/.test(c.source));
    if (/野兽伙伴|伙伴/.test(result.params?.query || '') && companionHits.length) {
      lines.push(`- **appliesTo: companion**（${companionHits.map((c) => c.source).join('、')}；作用于野兽伙伴攻击）`);
    }
  }

  if (mode === 'damage' || mode === 'both') {
    if (mode === 'both') lines.push('');
    lines.push(
      '### Tools 层 · 战斗伤害 flat 加值（combat_basics.json · 分解式）',
      `- 公式：${result.damageFormula || '武器伤害骰 + 属性调整值'}`,
      `- **伤害 flat 加值合计：+${result.totalDamageBonus}**（不含武器骰面）`,
      '- 分解：',
    );
    for (const c of result.damageComponents || []) {
      if (c.type === 'dice') {
        lines.push(`  · ${c.source}：**${c.value}**（${c.detail}）`);
      } else {
        lines.push(`  · ${c.source}：+${c.value}${c.detail ? `（${c.detail}）` : ''}`);
      }
    }
  }

  for (const a of result.assumptions || []) lines.push(`- 假设：${a}`);
  lines.push(`- 语料：${result.sources.join('、')}`);
  if (mode === 'damage') {
    lines.push('- LLM 须给出 flat 加值与武器骰面；注明 Buff 对有效力量的影响。');
  } else {
    lines.push('- LLM 须给出分解列表与合计；注明锐化武器 L5、双手剑专长等未在问句中的变量。');
  }
  return lines.join('\n');
}

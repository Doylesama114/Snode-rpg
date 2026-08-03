/**
 * Advisor 5.0 — structured query tools (skill, weapon, chargen HP, proficiency, status, feats, unknown gate).
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { matchAllClassesFromQuery, matchClassNameFromQuery } from './advisor-class-l2.mjs';
import {
  detectUnknownAdvancementQuery,
  findSimilarAdvancements,
} from './advisor-advancement-resolve.mjs';
import {
  parseCombatScenarioFromQuery,
  resolveCombatScenario,
  formatCombatScenarioText,
  mergeSnapshotIntoCombatScenario,
  parseAcScenarioFromQuery,
  resolveAcScenario,
  formatAcScenarioText,
  resolveFullCombatScenario,
  mergeSnapshotIntoAcScenario,
} from './advisor-combat-engine.mjs';
import { flattenProfs, listNonZeroProfs } from './advisor-snapshot.mjs';
import { detectEquipmentQuestion, buildEquipmentToolContext } from './advisor-equipment-tools.mjs';
import { detectChargenCalcQuestion, buildChargenToolContext } from './advisor-chargen-tools.mjs';
import { detectBackgroundQuestion, buildBackgroundToolContext } from './advisor-background-tools.mjs';
import {
  detectProficiencyLookupQuestion,
  buildProficiencyToolContext,
} from './advisor-proficiency-tools.mjs';
import {
  detectChargenEntityQuestion,
  buildChargenEntityToolContext,
} from './advisor-chargen-entity-tools.mjs';
import { buildBuildReviewToolContext } from './advisor-build-review-tools.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ADVISOR = path.join(__dirname, '..', 'advisor');
const MAGE_L2 = 'L2-mage';

/** @type {Map<string, string[]>|null} */
let _weaponProfsCache = null;
/** @type {{ byName: Map<string, object[]>, allNames: string[] }|null} */
let _skillIndexCache = null;

const WEAPON_CATEGORY_ALIASES = {
  锤类: ['锤子', '轻锤', '战锤', '重锤', '锤'],
  剑类: ['剑', '短剑', '长剑', '巨剑', '刺剑', '匕首', '弯刀', '军刀'],
  斧类: ['斧', '手斧', '战斧', '巨斧'],
  长柄: ['长柄', '长矛', '长棍', '木杖'],
  弓箭: ['弓', '长弓', '短弓', '手弩', '轻弩', '重弩', '箭', '弩'],
  火器: ['火枪', '步枪', '枪', '弹药'],
  法器: ['法杖', '魔棒', '短杖', '法器'],
  简易: ['简易', '投石索', '飞镖'],
};

const SKILL_DETAIL_RE = /这个技能|收益|代价|效果|总共|一共|支付|获得|损失|多少|机制|详细|怎么用|是什么|有什么|可以学|一样吗|哪些职业.*学/;
const CROSS_CLASS_RE = /相同|共同|同名|重合|一样|都有|重复/;
const WEAPON_PROF_QUERY_RE = /哪些|什么|哪几个|哪一些/;
const WEAPON_PROF_SUBJECT_RE = /职业|初始|主职|基础职业/;
const COMBAT_MATH_RE = /命中加值|攻击加值|伤害加值|护甲值|防御等级|暴击率|调整值.*\+|拿着一把|开启.*开启|攻击命中|命中.*公式|公式.*命中|命中.*怎么算/;
const CHARGEN_HP_RE = /初始血量|起始生命|起始hp|创建.*血量|血量.*最大|生命.*最大|hp.*最大/i;
const PROF_ROADMAP_PARENT_RE = /运动|巧手|奥秘|知识|表演/;
const PROF_ROADMAP_LEAF_RE = /宗教|自然|欺瞒|洞悉|逻辑|隐匿|威逼|驯兽|医药|调查|专注|体操|运动|耐力|威力|说服|表演|探索|决策|机遇|求生|导航|聆听|察觉|感悟|激励|估价|伪造|读唇|欺瞒|恐吓|威逼/;
const PROF_ROADMAP_RE = new RegExp(
  `(?:${PROF_ROADMAP_PARENT_RE.source}|${PROF_ROADMAP_LEAF_RE.source}).*熟练`
  + `|熟练.*(?:${PROF_ROADMAP_PARENT_RE.source}|${PROF_ROADMAP_LEAF_RE.source})`
  + `|几乎所有.*(?:${PROF_ROADMAP_PARENT_RE.source}|${PROF_ROADMAP_LEAF_RE.source})`
  + `|我还缺.*熟练`,
);
const FEAT_TIMING_RE = /特殊专长|专长窗口|专长.*(等级|哪些级)/;
const STATUS_RULES_RE = /状态|异常|效果|造成|哪些技能/;
const SKILL_AGGREGATE_RE = /哪些职业|哪些.*学|可以学|效果一样|一样吗|不同职业/;

function loadJson(rel) {
  return JSON.parse(fs.readFileSync(path.join(ADVISOR, rel), 'utf8'));
}

function loadPanelWeaponProfs() {
  if (_weaponProfsCache) return _weaponProfsCache;
  const panelPath = path.join(__dirname, '..', 'electron-app', '斯诺德跑团', 'panel_data.js');
  if (!fs.existsSync(panelPath)) {
    _weaponProfsCache = new Map();
    return _weaponProfsCache;
  }
  const text = fs.readFileSync(panelPath, 'utf8');
  const m = text.match(/var CLASS_WEAPON_PROFS=(\{[^;]+\});/);
  const obj = m ? JSON.parse(m[1]) : {};
  _weaponProfsCache = new Map(Object.entries(obj));
  return _weaponProfsCache;
}

function addSkillOccurrence(byName, name, className, layer, skill) {
  if (!name) return;
  if (!byName.has(name)) byName.set(name, []);
  byName.get(name).push({ className, layer, skill });
}

function buildSkillIndexFromDisk() {
  if (_skillIndexCache) return _skillIndexCache;
  const byName = new Map();

  const mageIdx = loadJson('skills/mage_index.json');
  for (const s of mageIdx.skills || []) {
    addSkillOccurrence(byName, s.name, '法师', MAGE_L2, s);
  }

  const universalIdx = loadJson('skills/universal_index.json');
  for (const s of universalIdx.skills || []) {
    addSkillOccurrence(byName, s.name, '通用', 'L2-universal', s);
  }

  const registry = loadJson('chargen/class_registry.json');
  for (const [className, row] of Object.entries(registry.classes || {})) {
    const slug = className === '法师' ? 'mage' : row.l2Slug;
    if (!slug) continue;
    const rel = `skills/${slug}_index.json`;
    const full = path.join(ADVISOR, rel);
    if (!fs.existsSync(full)) continue;
    const idx = loadJson(rel);
    const layer = row.l2Layer || `L2-${slug}`;
    for (const s of idx.skills || []) {
      addSkillOccurrence(byName, s.name, className, layer, s);
    }
  }

  const allNames = [...byName.keys()].sort((a, b) => b.length - a.length);
  _skillIndexCache = { byName, allNames };
  return _skillIndexCache;
}

export function resetAdvisorQueryToolsCache() {
  _weaponProfsCache = null;
  _skillIndexCache = null;
  _statusNamesCache = null;
  _statusAppliersCache = null;
}

function parseHpBase(formulaFirst) {
  const m = String(formulaFirst || '').match(/^(\d+)/);
  return m ? Number(m[1]) : 8;
}

function loadClassDoc(className) {
  const registry = loadJson('chargen/class_registry.json');
  const slug = className === '法师' ? 'mage' : registry.classes?.[className]?.l2Slug;
  if (!slug) return null;
  const rel = `chargen/${slug}_class.json`;
  if (!fs.existsSync(path.join(ADVISOR, rel))) return null;
  return loadJson(rel);
}

/**
 * L1 初始 HP 对照：职业基底 + 体质调整值 + 种族 hpBonus
 */
export function summarizeChargenHp() {
  const races = loadJson('chargen/races.json').races || [];
  const registry = loadJson('chargen/class_registry.json');
  const pointBuy = loadJson('chargen/point_buy.json');

  const classes = [];
  for (const className of Object.keys(registry.classes || {})) {
    const doc = loadClassDoc(className);
    if (!doc) continue;
    const base = parseHpBase(doc.hpFormula?.first);
    classes.push({
      className,
      base,
      formula: doc.hpFormula?.first || '8+体质调整值',
    });
  }
  classes.sort((a, b) => b.base - a.base);

  const raceHp = races
    .map((r) => ({
      name: r.name,
      hpBonus: r.hpBonus,
      conBonus: r.attrBonus?.体质 || 0,
    }))
    .filter((r) => typeof r.hpBonus === 'number')
    .sort((a, b) => b.hpBonus - a.hpBonus);

  let best = {
    hp: 0,
    className: '',
    raceName: '',
    conTotal: 0,
    conMod: 0,
    formula: '',
    hpBonus: 0,
  };

  for (const c of classes) {
    for (const r of raceHp) {
      const conPurchased = 15;
      const conTotal = conPurchased + (r.conBonus || 0);
      const conMod = Math.floor((conTotal - 10) / 2);
      const total = c.base + conMod + r.hpBonus;
      if (total > best.hp) {
        best = {
          hp: total,
          className: c.className,
          raceName: r.name,
          conTotal,
          conMod,
          formula: c.formula,
          hpBonus: r.hpBonus,
        };
      }
    }
  }

  return {
    classes,
    topRaces: raceHp.slice(0, 8),
    best,
    pointBuyRules: pointBuy.rules || [],
    maxConPurchase: 15,
    maxConModifierAtCreation: 2,
  };
}

/**
 * @param {string} query
 * @returns {string[]}
 */
export function parseProficiencyTargetsFromQuery(query) {
  const prof = loadJson('chargen/proficiencies.json');
  const parents = Object.keys(prof.parentCategories || {});
  const q = String(query || '');
  const found = [];

  for (const p of parents) {
    if (q.includes(p)) found.push(p);
  }

  const leafSet = new Set();
  for (const arr of Object.values(prof.byAttribute || {})) {
    for (const item of arr) {
      if (item === '豁免' || item.includes('-')) continue;
      leafSet.add(item);
    }
  }
  for (const leaf of leafSet) {
    if (!q.includes(leaf)) continue;
    const coveredByParent = parents.find((p) => found.includes(p) && (leaf === p || leaf.startsWith(`${p}-`)));
    if (!coveredByParent && !found.includes(leaf)) found.push(leaf);
  }

  if (!found.length && /知识|奥秘/.test(q)) return ['知识', '奥秘'];
  return [...new Set(found)];
}

/**
 * @param {string[]} targets
 * @param {object} prof
 */
function resolveProficiencyTargetGroups(targets, prof) {
  const groups = [];
  for (const t of targets) {
    const subs = prof.parentCategories?.[t];
    if (subs?.length) {
      groups.push({ parent: t, subs, count: subs.length, isLeaf: false });
    } else {
      groups.push({ parent: t, subs: [t], count: 1, isLeaf: true });
    }
  }
  return groups;
}

/**
 * @param {string} className
 * @param {object|null} classDoc
 * @param {object} prof
 * @param {string[]} targets
 * @param {{ parent: string, subs: string[], count: number, isLeaf: boolean }[]} targetGroups
 */
function buildProficiencyL1Sources(className, classDoc, prof, targets, targetGroups) {
  const sources = [];
  sources.push(prof.classSkillPick?.[className] || classDoc?.skills || '—');

  if (className === '法师' && targets.some((t) => ['知识', '奥秘'].includes(t))) {
    sources.push('L1 法师三项专精均获得（非三选一）：奥法学者、知识传承、魔法学派。');
  } else if (classDoc?.specializations?.length) {
    sources.push(`L1 专精（${className}）：${classDoc.specializations.map((s) => s.name).join('、')}。`);
  }

  for (const spec of classDoc?.specializations || []) {
    const text = `${spec.effect || ''}${spec.buildHint || ''}`;
    const related = targets.some((t) => text.includes(t) || (spec.profChoices || []).some((p) => p.includes(t)));
    if (!related && !spec.profChoices?.length) continue;
    if (spec.profChoices?.length) {
      sources.push(`${spec.name}：${spec.effect || ''} 可选 ${spec.profChoices.join('、')}`);
    } else {
      sources.push(`${spec.name}：${spec.effect}${spec.buildHint ? `（${spec.buildHint}）` : ''}`);
    }
  }

  for (const g of targetGroups) {
    if (g.subs.length > 1) {
      sources.push(`${g.parent}子项全集（${g.count}）：${g.subs.join('、')}`);
    } else if (g.isLeaf) {
      sources.push(`目标「${g.parent}」为单项熟练；via L1 八选四、背景、升级熟练窗口与 L2 技能前置。`);
    }
  }

  return sources;
}

/**
 * @param {string} className
 * @param {string[]} targets
 * @param {{ parent: string, subs: string[], count: number }[]} targetGroups
 * @param {string[]} levelBullets
 * @param {object} prof
 */
function buildProficiencyEstimateNotes(className, targets, targetGroups, levelBullets, prof) {
  const totalSubs = targetGroups.reduce((s, g) => s + g.count, 0);
  const notes = [
    `目标：覆盖 ${targets.join('、')} 相关熟练（共 ${totalSubs} 个子项/单项）。`,
  ];

  if (className === '法师' && targets.some((t) => ['知识', '奥秘'].includes(t))) {
    notes.push(
      'L1 固定：奥法学者 +1 奥秘子项、知识传承 +1 知识子项；八选四可同时选 逻辑/奥秘/知识 父项。',
      '奥法学者：法师每升 1 级再 +1 奥秘子项（分配至未达 prof_cap 的子项）。',
    );
  } else {
    notes.push(`L1：${prof.classSkillPick?.[className] || '见职业创建页八选四熟练'}。`);
  }

  notes.push(
    `升级：${levelBullets.slice(0, 4).join('；')}${levelBullets.length > 4 ? '…' : ''}（见 L0 升级表）。`,
    '其余来源：背景基础熟练、L4/L8/L13 专长（如技巧专家）、幕间物语、部分 L2 技能前置（见具体技能）。',
  );

  const low = className === '法师' && totalSubs >= 12 ? 10 : Math.max(4, Math.ceil(totalSubs / 2));
  const high = className === '法师' && totalSubs >= 12 ? 15 : Math.max(8, totalSubs + 2);
  notes.push(
    `粗估：要「几乎全部」覆盖 ${totalSubs} 项各至少 +1，通常需主职约 **${low}～${high} 级** 并配合背景/专长；单项上限见各级 prof_cap。`,
  );
  return notes;
}

/**
 * @param {string} className
 * @param {string[]} [targets]
 * @param {object|null} [snapshot]
 */
export function outlineProficiencyRoadmap(className, targets = ['知识', '奥秘'], snapshot = null) {
  const prof = loadJson('chargen/proficiencies.json');
  const classDoc = loadClassDoc(className);
  const leveling = loadJson('rules/leveling.json');

  const targetGroups = resolveProficiencyTargetGroups(targets, prof);
  const profGainLevels = (leveling.mainClass?.levels || [])
    .filter((r) => r.proficiency && r.level <= 20)
    .map((r) => ({
      level: r.level,
      gain: r.proficiency,
      profCap: r.prof_cap,
    }));

  const l1Sources = buildProficiencyL1Sources(className, classDoc, prof, targets, targetGroups);
  const levelBullets = profGainLevels.slice(0, 10).map(
    (r) => `L${r.level} 熟练+${r.gain}（该级单项熟练上限 ${r.profCap}）`,
  );
  const estimateNote = buildProficiencyEstimateNotes(className, targets, targetGroups, levelBullets, prof);
  const snapshotProfContext = snapshot ? summarizeSnapshotProfContext(snapshot, targets) : null;

  const arcanaSubs = targetGroups.find((g) => g.parent === '奥秘')?.subs || prof.parentCategories?.奥秘 || [];
  const knowledgeSubs = targetGroups.find((g) => g.parent === '知识')?.subs || prof.parentCategories?.知识 || [];

  return {
    className,
    targets,
    targetGroups,
    arcanaSubs,
    knowledgeSubs,
    l1Sources,
    levelBullets,
    estimateNote,
    mageMulticlassNote: className === '法师' ? prof.mageMulticlassNote : null,
    snapshotProfContext,
  };
}

/**
 * @param {object} snapshot normalized L6 snapshot
 * @param {string[]} targets
 */
export function summarizeSnapshotProfContext(snapshot, targets = ['知识', '奥秘']) {
  const flat = flattenProfs(snapshot.profs || {});
  const highlights = listNonZeroProfs(snapshot.profs, 32);
  const targetHits = Object.entries(flat)
    .filter(([k, v]) => v > 0 && targets.some((t) => k.includes(t) || k.startsWith(`${t}-`)))
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'zh'))
    .map(([k, v]) => `${k}+${v}`);
  const main = snapshot.classes?.[0];
  return {
    name: snapshot.name || '',
    mainClass: main?.name || '',
    mainLevel: main?.level || 0,
    highlights,
    targetHits,
    attrs: snapshot.attrs || {},
  };
}

/** @type {string[]|null} */
let _statusNamesCache = null;
/** @type {Map<string, object[]>|null} */
let _statusAppliersCache = null;

function loadStatusNames() {
  if (_statusNamesCache) return _statusNamesCache;
  const doc = loadJson('rules/status_conditions.json');
  _statusNamesCache = (doc.conditions || []).map((c) => c.name);
  return _statusNamesCache;
}

function resolveStatusNameFromQuery(query) {
  const q = String(query || '');
  for (const name of [...loadStatusNames()].sort((a, b) => b.length - a.length)) {
    if (q.includes(name)) return name;
  }
  return null;
}

function classNameFromSkillIndexFile(filename) {
  const slug = filename.replace('_index.json', '');
  if (slug === 'mage') return '法师';
  if (slug === 'universal') return '通用';
  const registry = loadJson('chargen/class_registry.json');
  for (const [className, row] of Object.entries(registry.classes || {})) {
    const s = className === '法师' ? 'mage' : row.l2Slug;
    if (s === slug) return className;
  }
  return slug;
}

function buildStatusAppliersIndex() {
  if (_statusAppliersCache) return _statusAppliersCache;
  _statusAppliersCache = new Map();
  const skillsDir = path.join(ADVISOR, 'skills');
  for (const file of fs.readdirSync(skillsDir)) {
    if (!file.endsWith('_index.json')) continue;
    const className = classNameFromSkillIndexFile(file);
    const idx = JSON.parse(fs.readFileSync(path.join(skillsDir, file), 'utf8'));
    for (const skill of idx.skills || []) {
      for (const status of skill.appliesStatuses || []) {
        if (!_statusAppliersCache.has(status)) _statusAppliersCache.set(status, []);
        _statusAppliersCache.get(status).push({
          className,
          skillName: skill.name,
          style: skill.style || null,
          tier: skill.tier || (skill.type === 'starting' ? '起手' : null),
          summary: (skill.summary || '').slice(0, 160),
        });
      }
    }
  }
  for (const [, list] of _statusAppliersCache) {
    list.sort((a, b) => a.className.localeCompare(b.className, 'zh') || a.skillName.localeCompare(b.skillName, 'zh'));
  }
  return _statusAppliersCache;
}

/**
 * @param {string} name
 */
export function lookupStatus(name) {
  const n = String(name || '').trim();
  const doc = loadJson('rules/status_conditions.json');
  const condition = (doc.conditions || []).find((c) => c.name === n);
  if (!condition) return null;
  const appliers = buildStatusAppliersIndex().get(n) || [];
  return {
    ...condition,
    appliers,
    sourceFile: 'advisor/rules/status_conditions.json',
  };
}

/**
 * @param {string} name
 */
export function aggregateSkillByName(name) {
  const detail = lookupSkill(name);
  if (!detail) return null;
  const byClass = new Map();
  for (const occ of detail.occurrences) {
    if (!byClass.has(occ.className)) byClass.set(occ.className, occ);
  }
  const entries = [...byClass.values()];
  const norm = (s) => String(s || '').replace(/\s+/g, '').slice(0, 80);
  const signatures = entries.map((e) => norm(e.summary));
  const sameEffect = new Set(signatures).size <= 1;
  return {
    name: detail.name,
    entries,
    classCount: entries.length,
    classNames: entries.map((e) => e.className),
    sameEffect,
    effectNote: sameEffect
      ? '各职业摘要一致（同名同效）'
      : '各职业摘要不同——须分职业说明差异，不可笼统说「效果一样」',
  };
}

/** L4/L8/L13 特殊专长窗口（L0 事实） */
export function summarizeFeatWindows() {
  const leveling = loadJson('rules/leveling.json');
  const milestones = (leveling.featMilestones || []).map((m) => ({
    level: m.level,
    label: `L${m.level}`,
    reward: m.reward,
  }));
  return {
    milestones,
    labels: milestones.map((m) => m.label),
    note: '主职 4 / 8 / 13 级各获取一项特殊专长（见 L0 升级表 other 列）',
    sourceFile: 'advisor/rules/leveling.json',
  };
}

/**
 * @param {string} query
 */
export function resolveSkillNameFromQuery(query) {
  const { allNames, byName } = buildSkillIndexFromDisk();
  const q = String(query || '');
  for (const name of allNames) {
    if (q.includes(name)) {
      return { name, occurrences: byName.get(name) || [] };
    }
  }
  return null;
}

/**
 * @param {string} name
 */
export function lookupSkill(name) {
  const { byName } = buildSkillIndexFromDisk();
  const n = String(name || '').trim();
  const occurrences = byName.get(n) || [];
  if (!occurrences.length) return null;
  return {
    name: n,
    occurrences: occurrences.map(({ className, layer, skill }) => ({
      className,
      layer,
      style: skill.style || null,
      tier: skill.tier || (skill.type === 'starting' ? '起手' : null),
      type: skill.type || null,
      summary: skill.summary || '',
      prerequisite: skill.prerequisite || null,
      choicesFrom: skill.choicesFrom || null,
      fp: skill.fp ?? null,
      spCost: skill.spCost ?? null,
    })),
  };
}

function getClassSkillNames(className) {
  const registry = loadJson('chargen/class_registry.json');
  const row = registry.classes?.[className];
  if (!row) return [];
  const slug = className === '法师' ? 'mage' : row.l2Slug;
  if (!slug) return [];
  const rel = `skills/${slug}_index.json`;
  if (!fs.existsSync(path.join(ADVISOR, rel))) return [];
  const idx = loadJson(rel);
  return (idx.skills || []).map((s) => s.name);
}

/**
 * @param {string} classA
 * @param {string} classB
 */
export function intersectSkills(classA, classB) {
  const namesA = getClassSkillNames(classA);
  const setB = new Set(getClassSkillNames(classB));
  return namesA.filter((n) => setB.has(n)).sort((a, b) => a.localeCompare(b, 'zh'));
}

/**
 * @param {string} term
 * @returns {string|null}
 */
export function resolveWeaponCategory(term) {
  const q = String(term || '');
  for (const [cat, aliases] of Object.entries(WEAPON_CATEGORY_ALIASES)) {
    if (q.includes(cat)) return cat;
    for (const alias of aliases) {
      if (alias.length >= 2 && q.includes(alias)) return cat;
    }
  }
  return null;
}

/**
 * @param {string} [queryOrCategory]
 */
export function listClassesByWeaponProf(queryOrCategory = '') {
  const q = String(queryOrCategory || '');
  const category = resolveWeaponCategory(q);
  if (!category) return { category: null, classes: [], creationPageNotes: {} };

  const profs = loadPanelWeaponProfs();
  const classes = [];
  const creationPageNotes = {};

  for (const [className, cats] of profs.entries()) {
    if (!cats.includes(category)) continue;
    classes.push(className);
    try {
      const slug = className === '法师' ? 'mage' : loadJson('chargen/class_registry.json').classes?.[className]?.l2Slug;
      if (slug) {
        const clsPath = path.join(ADVISOR, 'chargen', `${slug}_class.json`);
        if (fs.existsSync(clsPath)) {
          const doc = JSON.parse(fs.readFileSync(clsPath, 'utf8'));
          if (doc.weapons) creationPageNotes[className] = doc.weapons;
        }
      }
    } catch { /* skip */ }
  }

  return { category, classes: classes.sort((a, b) => a.localeCompare(b, 'zh')), creationPageNotes };
}

/**
 * @param {string} query
 */
export function detectStructuredQuestion(query) {
  const q = String(query || '');
  const skillHit = resolveSkillNameFromQuery(q);
  const classes = matchAllClassesFromQuery(q);

  // 同时问防御等级(AC) 与 命中/攻击 公式：无快照也应附带两份通用公式
  if (COMBAT_MATH_RE.test(q) && /护甲值|防御等级|\bAC\b/i.test(q) && /命中|攻击/.test(q) && /公式|怎么算|是什么|多少/.test(q)) {
    return { intent: 'combat_math', mode: 'ac_hit', query: q };
  }

  if (COMBAT_MATH_RE.test(q) && /护甲值|防御等级|\bAC\b/i.test(q) && /多少|是多少|怎么算|当前|我的|开启|公式|是什么/.test(q)) {
    const acScenario = parseAcScenarioFromQuery(q);
    return { intent: 'combat_math', mode: 'ac', scenario: acScenario, query: q };
  }

  if (COMBAT_MATH_RE.test(q) && !/护甲值|防御等级|\bAC\b/i.test(q) && /开启|拿着|调整值|熟练度|命中加值|攻击加值|伤害加值|暴击|公式|攻击命中|怎么算/.test(q)) {
    const scenario = parseCombatScenarioFromQuery(q);
    const asksDamage = /伤害加值/.test(q);
    const asksHit = /命中加值|攻击加值|攻击命中|命中.*加值|命中.*公式|公式.*命中|命中.*怎么算/.test(q);
    const asksCrit = /暴击/.test(q);
    if (
      ((scenario.activeBuffs?.length || scenario.weaponProfPoints || scenario.weaponDamage || scenario.weaponCategory) && /多少|分别是多少/.test(q))
      || (asksDamage && (scenario.weaponDamage || /力量|敏捷/.test(q)))
      || (asksHit && (scenario.activeBuffs?.length || scenario.weaponProfPoints || scenario.weaponCategory))
      || (asksHit && /公式|怎么算|是什么/.test(q))
      || (asksHit && asksCrit && scenario.weaponCategory)
    ) {
      return {
        intent: 'combat_math',
        scenario,
        query: q,
        mode: asksDamage && asksHit ? 'both' : asksDamage && !asksHit ? 'damage' : 'hit',
      };
    }
  }

  const unknownAdv = detectUnknownAdvancementQuery(q);
  if (unknownAdv && /怎么|如何|规划|路线|安排|成长|想玩|想成为/.test(q)) {
    return { intent: 'unknown_entity', advancementName: unknownAdv.name, query: q };
  }

  if (FEAT_TIMING_RE.test(q) && /哪些|什么|等级|窗口|获取|在.*级/.test(q)) {
    return { intent: 'feat_timing', query: q };
  }

  const statusName = resolveStatusNameFromQuery(q);
  if (statusName && STATUS_RULES_RE.test(q)) {
    return { intent: 'status_rules', statusName, query: q };
  }

  const bgQ = detectBackgroundQuestion(q);
  if (bgQ) return bgQ;

  if (CHARGEN_HP_RE.test(q) && /最大|最高|尽量|怎样|如何|构筑/.test(q)) {
    return { intent: 'chargen_hp_optimize', query: q };
  }

  const chargenCalc = detectChargenCalcQuestion(q);
  if (chargenCalc) return chargenCalc;

  const classesInQ = matchAllClassesFromQuery(q);
  if (
    PROF_ROADMAP_RE.test(q)
    && /多少级|最少|哪些技能|怎么|怎样|升到|我还缺/.test(q)
  ) {
    const className = matchClassNameFromQuery(q) || classesInQ[0];
    const targets = parseProficiencyTargetsFromQuery(q);
    if (className && targets.length) {
      return {
        intent: 'proficiency_roadmap',
        className,
        targets,
        query: q,
      };
    }
  }

  if (skillHit) {
    const asksAggregate = SKILL_AGGREGATE_RE.test(q)
      && /哪些职业|可以学|效果一样|一样吗/.test(q);
    if (asksAggregate) {
      return { intent: 'skill_aggregate', skillName: skillHit.name, query: q };
    }
    const asksAboutSkill = SKILL_DETAIL_RE.test(q)
      || q.trim() === skillHit.name
      || (skillHit.name.length >= 4 && !CROSS_CLASS_RE.test(q) && !/哪些.*技能/.test(q));
    if (asksAboutSkill && !(classes.length >= 2 && CROSS_CLASS_RE.test(q))) {
      return { intent: 'skill_detail', skillName: skillHit.name, query: q };
    }
  }

  if (classes.length >= 2 && CROSS_CLASS_RE.test(q) && /技能|法术|战技|戏法/.test(q)) {
    return { intent: 'cross_class_compare', classes: classes.slice(0, 2), query: q };
  }

  if (
    (WEAPON_PROF_QUERY_RE.test(q) && WEAPON_PROF_SUBJECT_RE.test(q) && /武器熟练|熟练度|熟练项/.test(q))
    || (/武器熟练/.test(q) && /包含|含有|包括/.test(q))
  ) {
    const cat = resolveWeaponCategory(q);
    if (cat || /武器熟练|熟练度/.test(q)) {
      return { intent: 'class_weapon_prof', category: cat, query: q };
    }
  }

  const profLookup = detectProficiencyLookupQuestion(q);
  if (profLookup) return profLookup;

  const chargenEntity = detectChargenEntityQuestion(q);
  if (chargenEntity) return chargenEntity;

  const equipQ = detectEquipmentQuestion(q);
  if (equipQ) return equipQ;

  return null;
}

function formatSkillOccurrence(occ) {
  const lines = [`### ${occ.className} · ${occ.name}`];
  lines.push(`- 位阶/类型：${[occ.tier, occ.type, occ.style].filter(Boolean).join(' · ') || '—'}`);
  if (occ.prerequisite) lines.push(`- 前置：${String(occ.prerequisite).slice(0, 200)}`);
  if (occ.summary) lines.push(`- 摘要：${occ.summary.slice(0, 600)}`);
  if (occ.choicesFrom) lines.push(`- 抉择：${occ.choicesFrom}`);
  return lines.join('\n');
}

/**
 * @param {ReturnType<typeof detectStructuredQuestion>} detected
 * @param {{ store?: object }} [opts]
 */
export function buildStructuredToolContext(detected, opts = {}) {
  if (!detected) return null;

  if (detected.intent === 'skill_detail') {
    const detail = lookupSkill(detected.skillName);
    if (!detail) return null;
    const lines = [
      '### Tools 层 · 技能详情（事实 · 勿改数字/代价）',
      `- 技能名：${detail.name}`,
      `- 收录于 ${detail.occurrences.length} 个职业/来源`,
      '- LLM 须完整枚举下列摘要中的收益与代价条目，勿遗漏里程碑数字。',
    ];
    for (const occ of detail.occurrences) {
      lines.push(formatSkillOccurrence(occ));
    }
    return {
      intent: 'skill_detail',
      promptProfile: 'skill_detail',
      text: lines.join('\n'),
      meta: { skillName: detail.name, classCount: detail.occurrences.length },
    };
  }

  if (detected.intent === 'cross_class_compare') {
    const [classA, classB] = detected.classes;
    const names = intersectSkills(classA, classB);
    const lines = [
      '### Tools 层 · 跨职业同名技能（server-side 交集 · 完整列表）',
      `- 职业 A：${classA}；职业 B：${classB}`,
      `- 同名技能共 ${names.length} 项（须完整列出，不可只给示例）`,
      '- LLM 只负责组织语言；**不得删减**下列任一技能名。',
    ];
    for (const n of names) {
      lines.push(`- ${n}`);
    }
    if (!names.length) lines.push('- （语料交集为空 — 如实说明）');
    return {
      intent: 'cross_class_compare',
      promptProfile: 'cross_class_compare',
      text: lines.join('\n'),
      meta: { classA, classB, count: names.length, names },
    };
  }

  if (detected.intent === 'class_weapon_prof') {
    const { category, classes, creationPageNotes } = listClassesByWeaponProf(detected.query);
    const lines = [
      '### Tools 层 · 武器熟练对照（面板类别 · 事实）',
      category ? `- 解析类别：${category}（含别名：${(WEAPON_CATEGORY_ALIASES[category] || []).join('、')}）` : '- 未能解析具体武器类别，请据下列全表作答',
      `- 面板「${category || '？'}」熟练的职业（共 ${classes.length}）：${classes.join('、') || '—'}`,
      '- 创建页具体武器类型（若与面板类别不同，须一并说明）：',
    ];
    for (const cn of classes) {
      const w = creationPageNotes[cn];
      lines.push(w ? `- ${cn}：创建页 ${w}` : `- ${cn}：见职业基础卡片`);
    }
    lines.push('- mage-only / 面板类别 ≠ 仅法师可进阶；以 sourceClasses / weaponProfCategories 为准。');
    return {
      intent: 'class_weapon_prof',
      promptProfile: 'class_weapon_prof',
      text: lines.join('\n'),
      meta: { category, classes },
    };
  }

  if (detected.intent === 'chargen_hp_optimize') {
    const hp = summarizeChargenHp();
    const lines = [
      '### Tools 层 · L1 初始 HP 最优化（server-side 事实）',
      '- 公式：L1 生命值 = 职业 hpFormula.first + 体质调整值 + 种族 hpBonus（购点与种族加值规则见下）',
      `- 购点：32 点；单项至多 9 点费用 → 属性 15（体质调整值 +2）；种族体质加值在购点后叠加。`,
      `- **推荐组合（语料演算最高）**：${hp.best.className} + ${hp.best.raceName} → ${hp.best.hp} HP`,
      `  · 职业：${hp.best.formula}`,
      `  · 假设购点体质 15 + 种族体质 +${hp.best.conTotal - 15} = 有效体质 ${hp.best.conTotal}（调整值 +${hp.best.conMod}）`,
      `  · 种族 hpBonus：+${hp.best.hpBonus}`,
      '- 职业 L1 基底（降序）：',
    ];
    for (const c of hp.classes.slice(0, 8)) {
      lines.push(`  · ${c.className}：${c.formula}（基底 ${c.base}）`);
    }
    lines.push('- 种族 hpBonus 前列：');
    for (const r of hp.topRaces.slice(0, 6)) {
      lines.push(`  · ${r.name}：hpBonus +${r.hpBonus}${r.conBonus ? `，体质种族 +${r.conBonus}` : ''}`);
    }
    lines.push('- LLM 须说明：最大化 HP 需优先高基底职业 + 高 hpBonus 种族 + 购点体质 15；仍须满足关键属性/职业取向 trade-off。');
    return {
      intent: 'chargen_hp_optimize',
      promptProfile: 'chargen_hp_optimize',
      text: lines.join('\n'),
      meta: { best: hp.best },
    };
  }

  if (detected.intent === 'proficiency_roadmap') {
    const roadmap = outlineProficiencyRoadmap(
      detected.className || '法师',
      detected.targets || ['知识', '奥秘'],
      detected.snapshot || null,
    );
    const lines = [
      '### Tools 层 · 熟练项获取路线（server-side 事实 · 勿改数字）',
      `- 职业：${roadmap.className}；目标：${roadmap.targets.join('、')} 几乎全部子熟练`,
    ];
    for (const g of roadmap.targetGroups || []) {
      if (g.subs.length > 1) {
        lines.push(`- ${g.parent}子项（${g.count}）：${g.subs.join('、')}`);
      }
    }
    if (roadmap.snapshotProfContext) {
      const sp = roadmap.snapshotProfContext;
      lines.push(`- **L6 快照联动**：${sp.name || '角色'} · 主职 ${sp.mainClass} L${sp.mainLevel}`);
      if (sp.targetHits.length) {
        lines.push(`  · 已有目标熟练：${sp.targetHits.join('、')}`);
      } else if (sp.highlights.length) {
        lines.push(`  · 已有熟练：${sp.highlights.join('、')}`);
      } else {
        lines.push('  · 快照中目标熟练均为 0 — 须从 L1 专精/升级开始规划');
      }
    }
    lines.push('- L1 来源：');
    for (const b of roadmap.l1Sources) lines.push(`  · ${b}`);
    lines.push('- 升级熟练窗口：');
    for (const b of roadmap.levelBullets) lines.push(`  · ${b}`);
    for (const n of roadmap.estimateNote) lines.push(`- ${n}`);
    if (roadmap.mageMulticlassNote) lines.push(`- 备注：${roadmap.mageMulticlassNote}`);
    lines.push('- LLM 须给出最少等级粗估与 L1/L2 技能/专精方向，勿编造未收录技能名。');
    return {
      intent: 'proficiency_roadmap',
      promptProfile: 'proficiency_roadmap',
      text: lines.join('\n'),
      meta: roadmap,
    };
  }

  if (detected.intent === 'status_rules') {
    const status = lookupStatus(detected.statusName);
    if (!status) return null;
    const lines = [
      '### Tools 层 · 异常状态（status_conditions.json · 事实）',
      `- 语料来源：${status.sourceFile}`,
      `- 状态名：${status.name}（${status.category || '—'} · ${status.controlTier || '—'}）`,
      `- 效果摘要：${status.summary || status.fullEffect || '—'}`,
    ];
    if (status.fullEffect && status.fullEffect !== status.summary) {
      lines.push(`- 完整效果：${String(status.fullEffect).replace(/\n/g, '；')}`);
    }
    if (status.buildHints?.length) {
      lines.push(`- 构建提示：${status.buildHints.join('；')}`);
    }
    lines.push(`- 可造成「${status.name}」的技能（appliesStatuses · 共 ${status.appliers.length} 项 · 须完整列出）：`);
    for (const a of status.appliers) {
      lines.push(`  · ${a.className} · ${a.skillName}（${[a.style, a.tier].filter(Boolean).join(' · ') || '—'}）`);
    }
    if (!status.appliers.length) lines.push('  · （语料 appliesStatuses 为空 — 如实说明）');
    lines.push('- LLM 须先说明状态效果，再列全部施加技能；勿编造未收录技能名。');
    return {
      intent: 'status_rules',
      promptProfile: 'status_rules',
      text: lines.join('\n'),
      meta: { statusName: status.name, applierCount: status.appliers.length },
    };
  }

  if (detected.intent === 'skill_aggregate') {
    const agg = aggregateSkillByName(detected.skillName);
    if (!agg) return null;
    const lines = [
      '### Tools 层 · 跨职业同名技能聚合（server-side · 事实）',
      `- 技能名：${agg.name}`,
      `- 收录职业（共 ${agg.classCount}）：${agg.classNames.join('、')}`,
      `- 效果是否一致：${agg.effectNote}`,
      '- 各职业摘要（须分职业说明，比较差异）：',
    ];
    for (const e of agg.entries) {
      lines.push(`  · **${e.className}**（${[e.tier, e.type, e.style].filter(Boolean).join(' · ') || '—'}）`);
      if (e.summary) lines.push(`    ${e.summary.slice(0, 500)}`);
      if (e.prerequisite) lines.push(`    前置：${String(e.prerequisite).slice(0, 120)}`);
    }
    lines.push('- LLM 须列出全部可学职业并说明效果是否相同；数字/机制以摘要为准。');
    return {
      intent: 'skill_aggregate',
      promptProfile: 'skill_aggregate',
      text: lines.join('\n'),
      meta: agg,
    };
  }

  if (detected.intent === 'feat_timing') {
    const feats = summarizeFeatWindows();
    const lines = [
      '### Tools 层 · 特殊专长获取窗口（L0 升级表 · 事实）',
      `- 语料来源：${feats.sourceFile}`,
      `- ${feats.note}`,
      '- 主职专长里程碑（须完整列出）：',
    ];
    for (const m of feats.milestones) {
      lines.push(`  · **${m.label}**：${m.reward}`);
    }
    lines.push('- LLM 须明确写出 L4、L8、L13 三个窗口；勿编造其他等级专长窗。');
    return {
      intent: 'feat_timing',
      promptProfile: 'feat_timing',
      text: lines.join('\n'),
      meta: feats,
    };
  }

  if (detected.intent === 'combat_math') {
    if (detected.mode === 'ac_hit') {
      const acScenario = parseAcScenarioFromQuery(detected.query);
      const acResult = resolveAcScenario(acScenario);
      const acText = formatAcScenarioText(acResult);
      const scenario = parseCombatScenarioFromQuery(detected.query);
      const hitResult = resolveCombatScenario(scenario);
      const hitText = formatCombatScenarioText(hitResult, { mode: 'hit' });
      return {
        intent: 'combat_math',
        promptProfile: 'combat_math',
        text: `${acText}\n\n${hitText}`,
        meta: { ac: acResult, hit: hitResult },
      };
    }
    if (detected.mode === 'ac') {
      let acScenario = detected.scenario || parseAcScenarioFromQuery(detected.query);
      if (detected.snapshot) {
        acScenario = mergeSnapshotIntoAcScenario(acScenario, detected.snapshot, detected.query);
      }
      const acResult = resolveAcScenario(acScenario);
      return {
        intent: 'combat_math',
        promptProfile: 'combat_math',
        text: formatAcScenarioText(acResult),
        meta: acResult,
      };
    }
    let scenario = detected.scenario || parseCombatScenarioFromQuery(detected.query);
    if (detected.snapshot) {
      scenario = mergeSnapshotIntoCombatScenario(scenario, detected.snapshot, detected.query);
    }
    const result = detected.mode === 'both'
      ? resolveFullCombatScenario(scenario)
      : resolveCombatScenario(scenario);
    const text = formatCombatScenarioText(result, { mode: detected.mode });
    return {
      intent: 'combat_math',
      promptProfile: 'combat_math',
      text,
      meta: result,
    };
  }

  if (detected.intent === 'point_buy_optimize' || detected.intent === 'leveling_summary') {
    return buildChargenToolContext(detected);
  }

  if (detected.intent === 'background_detail') {
    return buildBackgroundToolContext(detected);
  }

  if (detected.intent === 'proficiency_lookup') {
    return buildProficiencyToolContext(detected);
  }

  if (
    detected.intent === 'starting_gear_lookup'
    || detected.intent === 'race_detail'
    || detected.intent === 'background_chargen'
  ) {
    return buildChargenEntityToolContext(detected);
  }

  if (detected.intent === 'equipment_lookup' || detected.intent === 'equipment_search') {
    return buildEquipmentToolContext(detected);
  }

  if (detected.intent === 'build_review' && detected.snapshot) {
    return buildBuildReviewToolContext({ ...detected, store: opts.store });
  }

  if (detected.intent === 'unknown_entity') {
    const name = detected.advancementName || '未知进阶';
    const similar = findSimilarAdvancements(name);
    const lines = [
      '### Tools 层 · 未收录实体闸门（server-side · 事实）',
      `- **「${name}」不在当前资料库**（未收录进阶/实体）`,
      '- LLM **必须**明确告知用户该名称不在资料库；**禁止**编造属性门槛、标识消耗、天赋或技能列表。',
      similar.length
        ? `- 相近 documented 进阶（仅供参考）：${similar.join('、')}`
        : '- 无相近 documented 进阶可推荐',
      '- 可给出一般性 L1–4 主职升级 / L5 开进阶框架，但不得假装已知该进阶具体规则。',
      '- 结尾须写「仅作参考」免责声明。',
    ];
    return {
      intent: 'unknown_entity',
      promptProfile: 'unknown_entity',
      text: lines.join('\n'),
      meta: { advancementName: name, similar },
    };
  }

  return null;
}

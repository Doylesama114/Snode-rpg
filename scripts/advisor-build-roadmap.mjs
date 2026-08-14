/**
 * Advisor 3.0+ — generic build roadmap (L2 抽样 + 快照分析；kit 仅作可选参考).
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { resolveL2LayerForClass, MAGE_L2, matchAllClassesFromQuery } from './advisor-class-l2.mjs';
import { getMainClass } from './advisor-snapshot.mjs';
import {
  resolveAdvancementName,
  getAdvancementMeta,
  inferSourceClassForAdvancement,
  briefAdvancementTalents,
  detectUnknownAdvancementQuery,
  findSimilarAdvancements,
} from './advisor-advancement-resolve.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ADVISOR = path.join(__dirname, '..', 'advisor');
const KITS_DIR = path.join(ADVISOR, 'build_kits');

export const ROADMAP_DISCLAIMER = '以上建议由 AI 根据当前资料整理，仅作参考；具体 build 请结合角色实际情况、规则书与 DM 沟通。';

/** Required answer sections for build_roadmap (7062). */
export const ROADMAP_ANSWER_SECTIONS = [
  '目标确认',
  '基础阶段（主职 L1–4）',
  '进阶门槛与时机',
  '进阶后节点',
  '技能与专长方向',
  '免责声明',
];

const KIT_ALIASES = {
  magic_sword: ['魔剑士', '魔武', 'gish'],
  magic_bullet: ['魔弹射手', '魔弹'],
};

const BUILD_ROADMAP_RE = /怎么选|如何选择|想玩|想成为|打算玩|怎么玩|规划|路线|成长|安排|build|配点|该怎么选|如何选|进阶.*怎么|怎么.*进阶|怎么规划|如何规划/;
const ROADMAP_SKILL_RE = /技能|build|配|路线|规划|流派|风格|专长|天赋|进阶|成长|安排|怎么玩/;
const ADVANCEMENT_PLAY_RE = /想玩|想成为|打算玩|怎么玩/;
const BASE_CLASS_PICK_RE = /基础职业|基础.*(选|选择|选哪个|选什么)|应该选.*(什么|哪个|哪)|选什么.*(职业|主职)|哪个.*(职业|主职)|什么.*(职业|主职).*选|(职业|主职).*应该选/;
const CATALOG_LIST_RE = /有哪些|能学|哪些|什么技能|什么法术|什么战技|除了.*初始|除.*起手/;
const PANEL_REVIEW_RE = /怎么评价|评价.*build|当前的build|当前.*build|build.*评价/;
const PANEL_SKILL_RE = /技能|适合|缺口|学什么|点什么|推荐|build/i;

const TIER_BY_BAND = {
  early: ['起手', '一阶', '二阶', '-'],
  mid: ['三阶', '四阶'],
  late: ['五阶', '六阶', '七阶', '八阶', '九阶'],
};

let _kitCache = null;
let _levelingCache = null;

function loadKitIndex() {
  if (_kitCache) return _kitCache;
  _kitCache = {};
  if (!fs.existsSync(KITS_DIR)) return _kitCache;
  for (const file of fs.readdirSync(KITS_DIR)) {
    if (!file.endsWith('.json')) continue;
    try {
      const kit = JSON.parse(fs.readFileSync(path.join(KITS_DIR, file), 'utf8'));
      if (kit.id) _kitCache[kit.id] = kit;
    } catch {
      /* skip */
    }
  }
  return _kitCache;
}

function loadLevelingRules() {
  if (!_levelingCache) {
    _levelingCache = JSON.parse(fs.readFileSync(path.join(ADVISOR, 'rules', 'leveling.json'), 'utf8'));
  }
  return _levelingCache;
}

export function buildLevelingHints() {
  const leveling = loadLevelingRules();
  const levels = (leveling.mainClass?.levels || [])
    .filter((row) => row.level >= 1 && row.level <= 5)
    .map((row) => ({
      level: row.level,
      proficiency: row.proficiency,
      attr_gain: row.attr_gain,
      skill_slots: row.skill_slots,
      other: row.other,
      rank: row.rank,
    }));

  return {
    mainLevels1to5: levels,
    featWindows: leveling.featMilestones || [],
    advancementUnlock: (leveling.advancementMilestones || []).find((m) => m.level === 5) || null,
    levelUpChecklist: (leveling.levelUpAnswerChecklist || []).slice(0, 6),
  };
}

export { resolveAdvancementName };

export function loadBuildKit(kitId) {
  if (!kitId) return null;
  return loadKitIndex()[kitId] || null;
}

export function detectRoadmapKitId(query) {
  const q = String(query || '');
  for (const [kitId, aliases] of Object.entries(KIT_ALIASES)) {
    if (aliases.some((a) => q.includes(a))) return kitId;
  }
  return null;
}

export function isAdvancementBaseClassPickQuery(query) {
  return BASE_CLASS_PICK_RE.test(String(query || ''));
}

/**
 * @param {string} query
 * @param {object|null} snapshot
 * @param {object|null} [goalOverride]
 */
export function parseRoadmapGoal(query, snapshot = null, goalOverride = null) {
  const q = String(query || '');
  const classesFromQuery = matchAllClassesFromQuery(q);
  let mainClass = classesFromQuery[0] || null;
  let subClass = classesFromQuery[1] || null;

  const mainM = q.match(/主职(?:业)?[：:\s]*([^，,、\s]{2,8})/);
  const subM = q.match(/子职(?:业)?[：:\s]*([^，,、\s]{2,8})/);
  if (mainM?.[1]) mainClass = mainM[1].replace(/的.*$/, '');
  if (subM?.[1]) subClass = subM[1].replace(/的.*$/, '');

  if (snapshot?.classes?.length) {
    const main = getMainClass(snapshot);
    mainClass = main.name || mainClass;
    const sub = snapshot.classes.slice(1).find((c) => c?.name && (c.level || 0) > 0);
    if (sub?.name) subClass = sub.name;
  }

  const aspiration = snapshot?.aspirationPath || null;
  let advancementName = resolveAdvancementName(q);
  const unknownAdvancement = advancementName ? null : detectUnknownAdvancementQuery(q);
  const kitId = detectRoadmapKitId(q);
  const baseClassPick = !!(advancementName && isAdvancementBaseClassPickQuery(q));

  // 期望进阶路线（aspirationPath）作为无显式目标时的默认方向
  if (!advancementName && aspiration?.picks?.length) {
    advancementName = String(aspiration.picks[0]).trim() || null;
  }

  if (goalOverride) {
    if (goalOverride.advancementName) advancementName = goalOverride.advancementName;
    if (goalOverride.mainClass) {
      if (!goalOverride.dropClasses?.includes(goalOverride.mainClass)) {
        mainClass = goalOverride.mainClass;
      } else if (goalOverride.advancementName) {
        mainClass = inferSourceClassForAdvancement(goalOverride.advancementName);
      }
    }
    if (goalOverride.dropClasses?.length && mainClass && goalOverride.dropClasses.includes(mainClass)) {
      mainClass = goalOverride.mainClass
        || (advancementName ? inferSourceClassForAdvancement(advancementName) : null);
    }
    if (goalOverride.sessionFocus === 'reject_prior' && goalOverride.advancementName) {
      mainClass = goalOverride.mainClass || inferSourceClassForAdvancement(goalOverride.advancementName);
      subClass = null;
    }
  }

  if (baseClassPick) {
    if (!mainM?.[1]) mainClass = classesFromQuery[0] || null;
  } else if (!mainClass && advancementName) {
    mainClass = inferSourceClassForAdvancement(advancementName);
  }
  if (!mainClass && !unknownAdvancement) {
    const mageOriented = /法师|塑能|咒法|奥法|法术|戏法|高输出.*法|法.*输出/.test(q);
    if (mageOriented || classesFromQuery.includes('法师')) {
      mainClass = '法师';
    }
  }

  const roadmapMode = inferRoadmapMode({
    query: q,
    advancementName,
    unknownAdvancement: unknownAdvancement?.name || null,
    subClass,
    mainClass,
    baseClassPick,
  });

  return {
    mainClass: mainClass || null,
    subClass: subClass || null,
    advancementName,
    unknownAdvancement: unknownAdvancement?.name || null,
    kitId,
    roadmapMode,
    baseClassPick,
    goalOverride: goalOverride || null,
    aspiration: aspiration || null,
  };
}

export function inferRoadmapMode(goal = {}) {
  if (goal.unknownAdvancement) return 'unknown_advancement';
  if (goal.baseClassPick && goal.advancementName) return 'advancement_base_class_pick';
  if (goal.roadmapMode) return goal.roadmapMode;
  if (goal.advancementName && !goal.subClass && !(/主职|子职|主职业|子职业/.test(goal.query || ''))) {
    return 'advancement_primary';
  }
  if (/法师|塑能|咒法|高输出.*法|法.*输出/.test(goal.query || '') && !goal.advancementName) {
    return 'orientation_only';
  }
  return 'dual_class_or_orientation';
}

export function isBuildRoadmapQuery(query) {
  const q = String(query || '');
  if (/怎么评价|评价.*build|当前的build|当前.*build|build.*评价/.test(q)) return false;
  if (CATALOG_LIST_RE.test(q) && !/进阶|规划|路线|想玩|怎么规划|如何规划/.test(q)) return false;

  const planning = BUILD_ROADMAP_RE.test(q) && ROADMAP_SKILL_RE.test(q);
  const advancementPlan = /进阶/.test(q) && /怎么|规划|路线|选|build|技能/i.test(q);
  const dualClassPlan = /主职|子职|主职业|子职业/.test(q) && planning;
  const advancementOnlyPlan = !!resolveAdvancementName(q) && ADVANCEMENT_PLAY_RE.test(q);
  const sessionFocusPlan = !!resolveAdvancementName(q) && /只说|只问|只谈|只关心|现在只|就只|没问|不是问/.test(q);
  const unknownPlan = !!detectUnknownAdvancementQuery(q);

  return planning || advancementPlan || dualClassPlan || advancementOnlyPlan || sessionFocusPlan || unknownPlan;
}

export function isBuildReviewQuery(query, ctx = {}) {
  if (!ctx.snapshot) return false;
  return PANEL_REVIEW_RE.test(query) && PANEL_SKILL_RE.test(query);
}

const WORLDVIEW_TRAVEL_RE = /君冠城|白霜城|冬怒堡|嚎叫湾|洛克镇|箭谷镇|寒鸦镇|边陲镇|绿河谷镇|银烛城|砰砰城|威斯威尔|烬铁镇|布雷泽火焰-能源集团|灰隼镇|纺锤镇|金穗城|鹅湾|晴风郡|紫藤堡|绿野镇|河谷镇|暖径镇|赤戟城|阳葵城|牛堡|旧城|跳鼠镇|狼毒镇|红杈三角洲|沙枣镇与怪柳镇|道路系统|关卡与登记|交通方式|怎么走|如何前往|从.*出发|前往.*(?:城|镇|堡|湾)|行程|旅途|旅行|环游|旅游|观光|值得去|游玩|游览|目的地|名胜|景点|这个世界|世界.*介绍|讲讲.*世界|世界.*什么样|神秘.*(?:地方|地点|区域)|危险.*(?:地方|地点|区域)|传说.*(?:地方|地点)|吃什么|饮食|美食|食物|料理|祭拜|祈祷|礼拜|信仰.*仪式|这个游戏怎么玩|游戏怎么玩|怎么玩这个游戏/;

export function isPanelRoadmapQuery(query, ctx = {}) {
  if (isBuildReviewQuery(query, ctx)) return false;
  // 地理/旅行问题（路线、城镇、关卡等）不属于车卡规划，交给世界观检索
  if (WORLDVIEW_TRAVEL_RE.test(String(query || ''))) return false;
  if (isBuildRoadmapQuery(query)) return true;
  if (!ctx.snapshot) return false;
  return PANEL_REVIEW_RE.test(query) && PANEL_SKILL_RE.test(query);
}

export function getRoadmapRouteConfig(goal = {}) {
  const mainClass = goal.mainClass
    || (goal.advancementName ? inferSourceClassForAdvancement(goal.advancementName) : null)
    || '法师';
  const mainLayer = mainClass === '法师' ? MAGE_L2 : resolveL2LayerForClass(mainClass);
  const mode = goal.roadmapMode || inferRoadmapMode(goal);
  const layers = ['L3'];
  const topK = { L3: 12, 'L2-universal': 14, L4: 12, L0: 5 };

  if (mode === 'advancement_base_class_pick') {
    topK.L0 = 8;
    topK.L3 = 16;
    topK.L4 = 8;
    topK['L2-universal'] = 4;
    layers.push('L4', 'L0');
    const adv = getAdvancementMeta(goal.advancementName);
    for (const cls of (adv?.sourceClasses || []).slice(0, 6)) {
      const layer = cls === '法师' ? MAGE_L2 : resolveL2LayerForClass(cls);
      if (layer && !layers.includes(layer)) {
        layers.push(layer);
        topK[layer] = 8;
      }
    }
    if (!layers.includes('L2-universal')) layers.push('L2-universal');
    return { layers, topK, subLayer: null, goal: { ...goal, roadmapMode: mode } };
  }

  if (mode === 'advancement_primary') {
    topK.L0 = 8;
    topK.L3 = 14;
    topK.L4 = 10;
    topK['L2-universal'] = 4;
    if (mainLayer) {
      layers.push(mainLayer);
      topK[mainLayer] = 22;
    }
    layers.push('L4', 'L0', 'L2-universal');
    return { layers, topK, subLayer: null, goal: { ...goal, roadmapMode: mode } };
  }

  if (mode === 'unknown_advancement') {
    layers.push('L0');
    topK.L0 = 6;
    topK.L3 = 8;
    return { layers, topK, subLayer: null, goal: { ...goal, roadmapMode: mode } };
  }

  if (mainLayer) {
    layers.push(mainLayer);
    topK[mainLayer] = 18;
  }

  if (goal.subClass) {
    const subLayer = resolveL2LayerForClass(goal.subClass);
    if (subLayer && !layers.includes(subLayer)) {
      layers.push(subLayer);
      topK[subLayer] = 18;
    }
  }

  layers.push('L2-universal', 'L4', 'L0');

  return { layers, topK, subLayer: goal.subClass ? resolveL2LayerForClass(goal.subClass) : null, goal };
}

export function getBuildPhaseBand(mainLevel) {
  const lv = Number(mainLevel) || 1;
  if (lv <= 3) return 'early';
  if (lv <= 8) return 'mid';
  return 'late';
}

export function getBuildPhaseLabel(band) {
  if (band === 'early') return '前期（主职约 L1–3，技能重心在一–二阶）';
  if (band === 'mid') return '中期（主职约 L4–8，技能重心在三–四阶）';
  return '后期（主职 L9+，技能重心在五阶及以上）';
}

function getSkillsForClass(store, className) {
  if (className === '法师') return store.mageSkills?.skills || [];
  const layer = resolveL2LayerForClass(className);
  if (layer && store.classSkillIndexes?.[layer]) {
    return store.classSkillIndexes[layer].skills || [];
  }
  return [];
}

function listStylesForClass(store, className) {
  const skills = getSkillsForClass(store, className);
  const styles = new Set();
  for (const s of skills) {
    if (s.style) styles.add(s.style);
  }
  return [...styles].sort((a, b) => a.localeCompare(b, 'zh'));
}

function skillTier(s) {
  return s.tier || (s.type === 'starting' ? '起手' : '-');
}

export function sampleSkillsForStyle(store, className, style, band, limit = 4) {
  const tiers = TIER_BY_BAND[band] || TIER_BY_BAND.early;
  const skills = getSkillsForClass(store, className).filter((s) => {
    const tier = skillTier(s);
    return s.style === style && tiers.includes(tier);
  });
  return skills.slice(0, limit).map((s) => ({
    name: s.name,
    tier: skillTier(s),
    style: s.style || '',
    summary: (s.summary || '').slice(0, 90),
  }));
}

function buildClassPhaseCatalog(store, className) {
  const styles = listStylesForClass(store, className);
  const phases = {};
  for (const band of ['early', 'mid', 'late']) {
    const byStyle = {};
    for (const style of styles.slice(0, 6)) {
      const samples = sampleSkillsForStyle(store, className, style, band, 3);
      if (samples.length) byStyle[style] = samples;
    }
    phases[band] = {
      label: getBuildPhaseLabel(band),
      tierLabels: TIER_BY_BAND[band],
      byStyle,
    };
  }
  return { className, styles, phases };
}

function findAdvancementMeta(name) {
  return getAdvancementMeta(name);
}

function sampleFeats(store, limit = 10) {
  return (store.feats?.feats || [])
    .filter((f) => f.mageRelevance === 'high' || f.mageRelevance === 'medium')
    .slice(0, limit)
    .map((f) => ({ name: f.name, summary: (f.summary || '').slice(0, 100) }));
}

function sampleUniversalTalents(store, band, limit = 4) {
  const skills = store.universalSkills?.skills || [];
  const tierMap = { early: ['一阶', '二阶', '-'], mid: ['三阶', '四阶'], late: ['五阶', '六阶', '七阶', '八阶', '九阶'] };
  const tiers = tierMap[band] || tierMap.early;
  return skills
    .filter((s) => tiers.includes(s.tier || '-'))
    .slice(0, limit)
    .map((s) => ({ name: s.name, tier: s.tier || '-', summary: (s.summary || '').slice(0, 80) }));
}

function briefKitHint(kit) {
  if (!kit) return null;
  return {
    note: '以下为历史模板参考，可能不完整或有误，勿当作唯一标准答案。',
    id: kit.id,
    name: kit.name,
    styleHints: {
      main: [kit.mage?.primaryStyle, kit.mage?.secondaryStyle].filter(Boolean),
      sub: [kit.warrior?.primaryStyle, kit.warrior?.secondaryStyle].filter(Boolean),
    },
  };
}

function findSkillByName(store, className, name) {
  return getSkillsForClass(store, className).find((s) => s.name === name) || null;
}

export function analyzeSnapshotGeneric(snapshot, goal, store) {
  const main = getMainClass(snapshot);
  const phaseBand = getBuildPhaseBand(main.level || 1);
  const learned = (snapshot.skills || []).map((s) => (typeof s === 'string' ? s : s.name)).filter(Boolean);

  const strengths = [];
  const gaps = [];
  const mainEntry = (snapshot.classes || []).find((c) => c.name === main.name);
  const subEntry = goal.subClass
    ? (snapshot.classes || []).find((c) => c.name === goal.subClass)
    : (snapshot.classes || []).slice(1).find((c) => c?.name);

  const mainStyles = (mainEntry?.styles || []).filter(Boolean);
  if (mainStyles.length) strengths.push(`主职已选流派：${mainStyles.join('、')}`);
  else gaps.push(`主职「${main.name}」尚未在快照中锁定战斗风格，可先明确 1～2 条流派方向`);

  if (subEntry?.name) {
    const subStyles = (subEntry.styles || []).filter(Boolean);
    if ((subEntry.level || 0) > 0 && !subStyles.length) {
      gaps.push(`子职「${subEntry.name}」已开启但未选战斗风格`);
    } else if (subStyles.length) {
      strengths.push(`子职 ${subEntry.name} L${subEntry.level || 0}，流派：${subStyles.join('、')}`);
    }
  }

  if (learned.length) {
    strengths.push(`已学技能 ${learned.length} 项：${learned.slice(0, 8).join('、')}${learned.length > 8 ? '…' : ''}`);
  } else {
    gaps.push('快照中尚无已学技能记录，可结合创角起手与前期规划');
  }

  const styleCounts = {};
  for (const name of learned) {
    const sk = findSkillByName(store, main.name, name)
      || (subEntry?.name ? findSkillByName(store, subEntry.name, name) : null);
    const st = sk?.style || '（未知流派）';
    styleCounts[st] = (styleCounts[st] || 0) + 1;
  }
  const styleSummary = Object.entries(styleCounts).map(([k, v]) => `${k}×${v}`).join('、');
  if (styleSummary) strengths.push(`已学技能流派分布：${styleSummary}`);

  const takenFeats = snapshot.special_feats || [];
  const nextFeatLevel = main.level >= 13 ? null : main.level >= 8 ? 13 : main.level >= 4 ? 8 : 4;

  return {
    phaseBand,
    phaseLabel: getBuildPhaseLabel(phaseBand),
    learned,
    strengths,
    gaps,
    takenFeats,
    nextFeatWindow: nextFeatLevel ? `L${nextFeatLevel} 专长窗口` : '暂无即将开放的专长窗口',
  };
}

/**
 * @param {object} store
 * @param {object} goal parseRoadmapGoal result
 * @param {{ snapshot?: object }} options
 */
export function buildGenericRoadmapContext(store, goal, options = {}) {
  const snapshot = options.snapshot || null;
  const main = snapshot ? getMainClass(snapshot) : { name: goal.mainClass, level: 1 };
  const mainLevel = main.level || 1;
  const effectiveMainClass = goal.baseClassPick
    ? null
    : goal.mainClass || main.name
      || (goal.advancementName ? inferSourceClassForAdvancement(goal.advancementName) : null)
      || '法师';
  const advancement = findAdvancementMeta(goal.advancementName);
  const kit = goal.kitId ? loadBuildKit(goal.kitId) : null;
  const advancementBrief = goal.advancementName ? briefAdvancementTalents(goal.advancementName) : null;
  const unknownAdvancement = goal.unknownAdvancement || null;
  const similarAdvancements = unknownAdvancement
    ? findSimilarAdvancements(unknownAdvancement)
    : [];

  return {
    mode: 'generic',
    disclaimer: ROADMAP_DISCLAIMER,
    roadmapMode: goal.roadmapMode || null,
    unknownAdvancement,
    similarAdvancements,
    goalOverride: goal.goalOverride || null,
    goal: {
      advancementName: goal.advancementName || advancement?.name || null,
      mainClass: effectiveMainClass,
      subClass: goal.subClass || null,
    },
    advancement: advancement ? {
      name: advancement.name,
      scope: advancement.scope,
      sourceClasses: advancement.sourceClasses || [],
      attrsRequired: advancement.attrsRequired,
      inferenceBlurb: advancement.inferenceBlurb,
      confidence: advancement.confidence,
      conditions: (advancement.conditions || []).slice(0, 4),
    } : null,
    advancementBrief,
    levelingHints: buildLevelingHints(),
    scenario: snapshot ? 'panel' : 'planning',
    mainLevel,
    phaseBand: getBuildPhaseBand(mainLevel),
    phaseLabel: getBuildPhaseLabel(getBuildPhaseBand(mainLevel)),
    mainClassCatalog: effectiveMainClass ? buildClassPhaseCatalog(store, effectiveMainClass) : null,
    subClassCatalog: goal.subClass ? buildClassPhaseCatalog(store, goal.subClass) : null,
    universalTalents: {
      early: sampleUniversalTalents(store, 'early'),
      mid: sampleUniversalTalents(store, 'mid'),
      late: sampleUniversalTalents(store, 'late'),
    },
    featSamples: sampleFeats(store, 12),
    kitHint: briefKitHint(kit),
    analysis: snapshot ? analyzeSnapshotGeneric(snapshot, goal, store) : null,
  };
}

/** @deprecated use buildGenericRoadmapContext */
export function buildRoadmapContext(store, kit, options = {}) {
  const goal = {
    mainClass: kit.mainClass,
    subClass: kit.subClass,
    advancementName: kit.advancementName,
    kitId: kit.id,
  };
  return buildGenericRoadmapContext(store, goal, options);
}

export function formatRoadmapContext(ctx) {
  const lines = [];
  lines.push('## Build 路线图（build_roadmap · 通用）');
  lines.push('- 说明：以下为资料库抽样与检索摘要，供 AI 组织分阶段建议；**非固定配点表**，须结合玩家取向灵活发挥。');
  lines.push(`- 免责声明（回答末尾须复述）：${ctx.disclaimer || ROADMAP_DISCLAIMER}`);

  const g = ctx.goal || {};
  const goalParts = [
    g.advancementName ? `进阶「${g.advancementName}」` : null,
    g.mainClass ? `主职 ${g.mainClass}` : (ctx.roadmapMode === 'advancement_base_class_pick' ? '主职（待选 · 见兼容列表）' : null),
    g.subClass ? `子职 ${g.subClass}` : null,
  ].filter(Boolean);
  lines.push(`- 目标：${goalParts.join(' · ')}`);
  lines.push(`- 场景：${ctx.scenario === 'panel' ? '面板（含快照）' : '规划（无快照）'}`);
  lines.push(`- 当前阶段：${ctx.phaseLabel || ''}${ctx.mainLevel ? `（主职 L${ctx.mainLevel}）` : ''}`);
  if (ctx.roadmapMode) lines.push(`- 路线模式：${ctx.roadmapMode}`);
  lines.push('');

  if (ctx.goalOverride?.sessionFocus === 'reject_prior') {
    lines.push('### 会话目标重置（硬约束）');
    lines.push('- 用户已否定此前对话中的职业/build 假设；**勿引用**被否定的主职或兼职建议。');
    if (ctx.goalOverride.dropClasses?.length) {
      lines.push(`- 勿再提及：${ctx.goalOverride.dropClasses.join('、')}`);
    }
    if (ctx.goal?.advancementName) {
      lines.push(`- 当前仅讨论进阶「${ctx.goal.advancementName}」及其兼容主职路线。`);
    }
    lines.push('');
  }

  if (ctx.unknownAdvancement) {
    lines.push('### 未收录进阶（硬约束）');
    lines.push(`- 「${ctx.unknownAdvancement}」**不在当前资料库**；不得编造属性门槛、标识消耗或天赋列表。`);
    lines.push('- 须明确告知用户「未收录」，建议向 DM 或规则书确认；可列出下方相近 documented 进阶作方向参考（注明不确定）。');
    if (ctx.similarAdvancements?.length) {
      lines.push(`- 相近 documented 进阶（仅供参考）：${ctx.similarAdvancements.join('、')}`);
    }
    lines.push('');
  }

  if (ctx.advancement) {
    const a = ctx.advancement;
    lines.push('### L3 进阶参考');
    lines.push(`- ${a.name}（${a.scope || ''}，confidence=${a.confidence || '?'})`);
    if (a.sourceClasses?.length) lines.push(`- 兼容主职：${a.sourceClasses.join('、')}`);
    if (a.scope === 'mage-only' && a.sourceClasses?.length) {
      lines.push('- **scope 说明**：mage-only 为「法师系进阶」分类，**不等于仅法师**；以上兼容主职均可作为基础选择');
    }
    if (a.inferenceBlurb) lines.push(`- 方向：${a.inferenceBlurb}`);
    if (a.attrsRequired) lines.push(`- 属性门槛：${JSON.stringify(a.attrsRequired)}`);
    if (a.conditions?.length) lines.push(`- 剧情/行为条件（摘要）：${a.conditions.join('；')}`);
    lines.push('');
  }

  if (ctx.advancementBrief) {
    const b = ctx.advancementBrief;
    lines.push('### 进阶天赋索引（路线模式：仅列名与心得节点，勿展开机制全文）');
    if (b.abilityNames?.length) {
      lines.push(`- 天赋名（供优先级参考，勿逐条解释）：${b.abilityNames.join('、')}`);
    }
    for (const ins of b.insightMilestones || []) {
      lines.push(`- 等级奖励·${ins.name}：${ins.summary}`);
    }
    lines.push('');
  }

  if (ctx.levelingHints) {
    const lh = ctx.levelingHints;
    lines.push('### L0 主职升级摘要（L1–5，供路线分段）');
    for (const row of lh.mainLevels1to5 || []) {
      const parts = [`L${row.level}`];
      if (row.proficiency) parts.push(`熟练+${row.proficiency}`);
      if (row.attr_gain) parts.push(`属性+${row.attr_gain}`);
      if (row.skill_slots) parts.push(`技能槽+${row.skill_slots}`);
      if (row.other && row.other !== '-') parts.push(String(row.other).slice(0, 60));
      lines.push(`- ${parts.join(' · ')}`);
    }
    if (lh.featWindows?.length) {
      lines.push(`- 专长窗口：${lh.featWindows.map((f) => `L${f.level}`).join('、')}`);
    }
    if (lh.advancementUnlock) {
      lines.push(`- ${lh.advancementUnlock.reward}（L${lh.advancementUnlock.level}）`);
    }
    lines.push('');
  }

  function formatClassCatalog(catalog) {
    if (!catalog) return;
    lines.push(`### ${catalog.className} — 流派与分阶段候选示例（从 L2 索引抽样，非完整列表）`);
    lines.push(`- 可用战斗风格：${catalog.styles.join('、') || '见 L2 上下文'}`);
    for (const band of ['early', 'mid', 'late']) {
      const ph = catalog.phases[band];
      if (!ph) continue;
      lines.push(`\n#### ${catalog.className} · ${ph.label}`);
      for (const [style, skills] of Object.entries(ph.byStyle || {})) {
        const items = skills.map((s) => `${s.name}(${s.tier})`).join('、');
        lines.push(`- ${style} 例：${items}`);
      }
    }
    lines.push('');
  }

  formatClassCatalog(ctx.mainClassCatalog);
  formatClassCatalog(ctx.subClassCatalog);

  lines.push('### 通用天赋（L2-universal 抽样）');
  for (const band of ['early', 'mid', 'late']) {
    const talents = ctx.universalTalents?.[band];
    if (!talents?.length) continue;
    const label = band === 'early' ? '前期' : band === 'mid' ? '中期' : '后期';
    lines.push(`- ${label}：${talents.map((t) => t.name).join('、')}`);
  }
  lines.push('');

  if (ctx.featSamples?.length) {
    lines.push('### 专长候选（L4 上下文抽样，须结合 build 自选）');
    lines.push(`- 例：${ctx.featSamples.slice(0, 8).map((f) => f.name).join('、')}`);
    lines.push('');
  }

  if (ctx.kitHint) {
    lines.push('### 可选模板参考（非强制、可能有误）');
    lines.push(`- ${ctx.kitHint.note}`);
    if (ctx.kitHint.styleHints?.main?.length) {
      lines.push(`- 主职风格参考：${ctx.kitHint.styleHints.main.map((s) => s.name).join('、')}`);
    }
    if (ctx.kitHint.styleHints?.sub?.length) {
      lines.push(`- 子职风格参考：${ctx.kitHint.styleHints.sub.map((s) => s.name).join('、')}`);
    }
    lines.push('');
  }

  if (ctx.analysis) {
    const a = ctx.analysis;
    lines.push('### 快照 build 观察（供评价，非扣分清单）');
    lines.push(`- 阶段：${a.phaseLabel}`);
    if (a.strengths.length) lines.push(`- 现状：${a.strengths.join('；')}`);
    if (a.gaps.length) lines.push(`- 可思考方向：${a.gaps.join('；')}`);
    if (a.takenFeats?.length) lines.push(`- 已选专长：${a.takenFeats.join('、')}`);
    lines.push(`- 下一专长窗口：${a.nextFeatWindow}`);
    lines.push('');
  }

  lines.push('### 作答形态（硬约束 · build_roadmap）');
  lines.push('- 本问是**成长路线**，不是进阶能力百科。须按顺序写出以下章节标题（可微调措辞，内容不得缺失）：');
  ROADMAP_ANSWER_SECTIONS.forEach((sec, i) => {
    lines.push(`  ${i + 1}. ${sec}`);
  });
  lines.push('- **禁止**：逐条粘贴 L3 天赋 summary 全文；引入上下文未出现的主职（尤其默认法师）；把进阶与 L7 兼职混为一谈。');
  if (ctx.roadmapMode === 'advancement_base_class_pick') {
    lines.push('- **advancement_base_class_pick**：用户在选择基础主职；须列出 L3 全部兼容主职并比较，勿默认法师/术士，勿把 mage-only 理解成仅法师。');
  }
  if (ctx.roadmapMode === 'advancement_primary') {
    lines.push('- **advancement_primary**：L1–4 写源主职（兼容主职）升级与技能方向；L5 写进阶门槛；进阶后只列心得节点。');
  }
  if (ctx.unknownAdvancement) {
    lines.push('- **unknown_advancement**：不得输出具体配点表；只谈一般规划框架 + 未收录声明。');
  }
  lines.push('- 用户若问「有哪些能力/效果」才列天赋机制；本问只写等级节点与技能/专长方向。');
  lines.push('');

  lines.push('### 作答要求（给模型）');
  lines.push('- 根据用户取向与 L2/L3/L4 检索内容组织路线，可提出多条流派思路，勿机械照搬上文示例清单。');
  lines.push('- 有快照时：推荐技能不得超出「可学技能位阶」；进阶≠兼职。');
  lines.push(`- 结尾单独一行：${ctx.disclaimer || ROADMAP_DISCLAIMER}`);

  return lines.join('\n');
}

export function planBuildRoadmapFromRules(query, ctx = {}) {
  if (!isPanelRoadmapQuery(query, ctx)) return null;
  const goalOverride = ctx.goalOverride || null;
  const goal = parseRoadmapGoal(query, ctx.snapshot || null, goalOverride);
  let scenario = 'mixed';
  if (ctx.mode === 'wizard') scenario = 'chargen';
  else if (ctx.snapshot) scenario = 'build';

  const promptProfile = goal.unknownAdvancement ? 'unknown_entity' : 'build_roadmap';
  const intent = goal.unknownAdvancement ? 'unknown_entity' : 'build_roadmap';

  return {
    source: 'rules',
    scenario,
    answerStyle: 'roadmap',
    tasks: [{
      type: 'build_roadmap',
      generic: true,
      mainClass: goal.mainClass,
      subClass: goal.subClass,
      advancementName: goal.advancementName,
      unknownAdvancement: goal.unknownAdvancement,
      roadmapMode: goal.roadmapMode,
      baseClassPick: goal.baseClassPick,
      goal: goal.advancementName || goal.unknownAdvancement || goal.mainClass,
      kitId: goal.kitId || null,
    }],
    intent,
    promptProfile,
  };
}
